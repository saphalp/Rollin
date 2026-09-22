import { createClient } from "jsr:@supabase/supabase-js@2";

/*
 * These must match the interests available
 * in the Rollin' profile interest picker.
 */
const ALLOWED_INTERESTS = [
    "Art",
    "Basketball",
    "Board Games",
    "Coding",
    "Coffee",
    "Concerts",
    "Cooking",
    "Cycling",
    "Dance",
    "Gaming",
    "Hiking",
    "Movies",
    "Music",
    "Photography",
    "Reading",
    "Running",
    "Soccer",
    "Study Nights",
    "Volunteering",
    "Yoga",
];

/*
 * Standard JSON response helper.
 */
function jsonResponse(
    body: Record<string, unknown>,
    status = 200
) {
    return new Response(
        JSON.stringify(body),
        {
            status,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
}

Deno.serve(async (req) => {
    try {
        /*
         * =====================================================
         * 1. Read request body
         * =====================================================
         */

        const { activityId } = await req.json();

        if (!activityId) {
            return jsonResponse(
                {
                    error: "activityId is required",
                },
                400
            );
        }

        /*
         * =====================================================
         * 2. Load environment variables
         * =====================================================
         */

        const supabaseUrl =
            Deno.env.get("SUPABASE_URL");

        const anonKey =
            Deno.env.get("SUPABASE_ANON_KEY");

        const serviceRoleKey =
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        const geminiApiKey =
            Deno.env.get("GEMINI_API_KEY");

        if (
            !supabaseUrl ||
            !anonKey ||
            !serviceRoleKey ||
            !geminiApiKey
        ) {
            throw new Error(
                "Missing required environment variables."
            );
        }

        const authHeader =
            req.headers.get("Authorization");

        if (!authHeader) {
            return jsonResponse(
                {
                    error: "Not authenticated",
                },
                401
            );
        }

        /*
         * Logged-in user's Supabase client.
         */
        const userSupabase = createClient(
            supabaseUrl,
            anonKey,
            {
                global: {
                    headers: {
                        Authorization: authHeader,
                    },
                },
            }
        );

        /*
         * Backend/admin client.
         */
        const adminSupabase = createClient(
            supabaseUrl,
            serviceRoleKey
        );

        /*
         * Get logged-in user.
         */
        const {
            data: { user },
            error: authError,
        } = await userSupabase.auth.getUser();

        if (authError || !user) {
            return jsonResponse(
                {
                    error: "Invalid user",
                },
                401
            );
        }
        /*
         * =====================================================
         * 4. Load activity
         * =====================================================
         */

        const {
            data: activity,
            error: activityError,
        } = await userSupabase
            .from("activities")
            .select(`
                id,
                title,
                category,
                description,
                location,
                host_id
  `)
            .eq("id", activityId)
            .single();

        if (activityError || !activity) {
            console.log(
                "Activity ID received:",
                activityId
            );

            console.log(
                "Activity query error:",
                activityError
            );

            return jsonResponse(
                {
                    error: "Activity not found",
                    activityId,
                    databaseError:
                        activityError?.message ?? null,
                },
                404
            );
        }

        /*
         * =====================================================
         * 5. Only the host can boost
         * =====================================================
         */

        if (activity.host_id !== user.id) {
            return jsonResponse(
                {
                    error:
                        "Only the activity host can boost this activity.",
                },
                403
            );
        }

        /*
         * =====================================================
         * 6. Build Gemini prompt
         * =====================================================
         */

        const prompt = `
You classify activities for a university social app called Rollin'.

Determine which user interests genuinely match this activity.

You MUST ONLY choose from these interests:

${ALLOWED_INTERESTS.join(", ")}

Rules:

- Return between 1 and 3 interests.
- Only choose interests that are genuinely relevant.
- Do not invent new interests.
- Do not return explanations.
- Do not return markdown.
- Return ONLY a JSON array of strings.

Examples:

Activity:
Soccer game at the lower field

Return:
["Soccer"]

Activity:
Programming study session for CS students

Return:
["Coding", "Study Nights"]

Activity:
Basketball pickup game

Return:
["Basketball"]

Now classify this activity:

Title:
${activity.title}

Category:
${activity.category ?? ""}

Description:
${activity.description ?? ""}

Location:
${activity.location ?? ""}
`;

        /*
         * =====================================================
         * 7. Ask Gemini to classify the activity
         * =====================================================
         */

        const geminiResponse =
            await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-goog-api-key":
                            geminiApiKey,
                    },

                    body: JSON.stringify({
                        contents: [
                            {
                                role: "user",

                                parts: [
                                    {
                                        text: prompt,
                                    },
                                ],
                            },
                        ],

                        generationConfig: {
                            temperature: 0.1,
                            responseMimeType:
                                "application/json",
                        },
                    }),
                }
            );

        /*
         * =====================================================
         * 8. Handle Gemini errors
         * =====================================================
         */

        if (!geminiResponse.ok) {
            const errorText =
                await geminiResponse.text();

            console.log(
                "Gemini API error:",
                errorText
            );

            return jsonResponse(
                {
                    error:
                        "Gemini classification failed",
                    geminiError: errorText,
                },
                500
            );
        }

        const geminiData =
            await geminiResponse.json();

        let raw =
            geminiData
                ?.candidates?.[0]
                ?.content?.parts?.[0]
                ?.text?.trim();

        if (!raw) {
            return jsonResponse(
                {
                    error:
                        "Gemini returned an empty response.",
                },
                500
            );
        }

        console.log(
            "Gemini raw response:",
            raw
        );

        /*
         * Remove markdown fences just in case
         * Gemini ever returns them.
         */
        raw = raw
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        /*
         * =====================================================
         * 9. Convert Gemini response into array
         * =====================================================
         */

        let interests: string[];

        try {
            interests = JSON.parse(raw);
        } catch {
            return jsonResponse(
                {
                    error:
                        "Gemini returned invalid JSON.",
                    raw,
                },
                500
            );
        }

        if (!Array.isArray(interests)) {
            return jsonResponse(
                {
                    error:
                        "Gemini response was not an array.",
                    raw,
                },
                500
            );
        }

        /*
         * Security / validation:
         *
         * Gemini can ONLY return interests that
         * exist in Rollin'.
         */
        interests = interests
            .filter(
                (interest):
                    interest is string =>
                    typeof interest === "string"
            )
            .filter((interest) =>
                ALLOWED_INTERESTS.includes(
                    interest
                )
            );

        /*
         * Remove duplicate interests.
         */
        interests = [
            ...new Set(interests),
        ];

        console.log(
            "Validated interests:",
            interests
        );

        /*
         * =====================================================
         * 10. Find matching interest IDs
         * =====================================================
         */

        if (interests.length === 0) {
            return jsonResponse({
                success: true,
                activityId: activity.id,
                interests: [],
                matchedUsers: [],
                matchedUserCount: 0,
            });
        }

        const {
            data: interestRows,
            error: interestLookupError,
        } = await adminSupabase
            .from("interests")
            .select("id, name")
            .in("name", interests);

        if (interestLookupError) {
            console.log(
                "Interest lookup error:",
                interestLookupError
            );

            return jsonResponse(
                {
                    error:
                        "Could not look up matching interests.",
                    databaseError:
                        interestLookupError.message,
                },
                500
            );
        }

        const matchedInterestIds =
            (interestRows ?? []).map(
                (interest) => interest.id
            );

        console.log(
            "Matched interest IDs:",
            matchedInterestIds
        );

        /*
         * =====================================================
         * 11. Find users who selected those interests
         * =====================================================
         */

        let matchingProfileIds:
            string[] = [];

        if (
            matchedInterestIds.length > 0
        ) {
            const {
                data: profileMatches,
                error: profileMatchError,
            } = await adminSupabase
                .from("profile_interests")
                .select("profile_id")
                .in(
                    "interest_id",
                    matchedInterestIds
                );

            if (profileMatchError) {
                console.log(
                    "Profile matching error:",
                    profileMatchError
                );

                return jsonResponse(
                    {
                        error:
                            "Could not find users with matching interests.",
                        databaseError:
                            profileMatchError.message,
                    },
                    500
                );
            }

            /*
             * Remove:
             *
             * - duplicate users
             * - the activity host
             */
            matchingProfileIds = [
                ...new Set(
                    (profileMatches ?? [])
                        .map(
                            (row) =>
                                row.profile_id as string
                        )
                        .filter(
                            (profileId) =>
                                profileId &&
                                profileId !==
                                activity.host_id
                        )
                ),
            ];
        }

        console.log(
            "Matching users:",
            matchingProfileIds
        );

        /*
         * =====================================================
         * 12. Final successful response
         * =====================================================
         *
         * Push notifications will be added
         * after this matching step is verified.
         */

        return jsonResponse({
            success: true,

            activityId:
                activity.id,

            activityTitle:
                activity.title,

            interests,

            matchedUsers:
                matchingProfileIds,

            matchedUserCount:
                matchingProfileIds.length,
        });
    } catch (error) {
        console.log(
            "boost-activity unexpected error:",
            error
        );

        return jsonResponse(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown server error",
            },
            500
        );
    }
});