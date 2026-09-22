import { createClient } from "jsr:@supabase/supabase-js@2";

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

function jsonResponse(
    body: Record<string, unknown>,
    status = 200
) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

function sleep(ms: number) {
    return new Promise((resolve) =>
        setTimeout(resolve, ms)
    );
}

async function callGeminiWithRetry(
    apiKey: string,
    prompt: string,
    maxAttempts = 4
): Promise<Response> {
    const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {
        console.log(
            `Gemini request attempt ${attempt}/${maxAttempts}`
        );

        const response = await fetch(url, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
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
                    responseMimeType: "application/json",
                },
            }),
        });

        if (response.ok) {
            console.log(
                `Gemini succeeded on attempt ${attempt}`
            );

            return response;
        }

        const errorText =
            await response.text();

        console.log(
            `Gemini attempt ${attempt} failed:`,
            response.status,
            errorText
        );

        const shouldRetry =
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500;

        if (
            !shouldRetry ||
            attempt === maxAttempts
        ) {
            return new Response(errorText, {
                status: response.status,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }

        const baseDelay =
            Math.pow(2, attempt - 1) * 1000;

        const jitter =
            Math.floor(Math.random() * 500);

        const waitTime =
            baseDelay + jitter;

        console.log(
            `Waiting ${waitTime}ms before retry...`
        );

        await sleep(waitTime);
    }

    throw new Error(
        "Gemini retry process unexpectedly ended."
    );
}

Deno.serve(async (req) => {
    try {
        /*
         * =====================================================
         * 1. READ REQUEST
         * =====================================================
         */

        const { activityId } =
            await req.json();

        if (!activityId) {
            return jsonResponse(
                {
                    error:
                        "activityId is required",
                },
                400
            );
        }

        console.log(
            "Boosting activity:",
            activityId
        );

        /*
         * =====================================================
         * 2. ENVIRONMENT VARIABLES
         * =====================================================
         */

        const supabaseUrl =
            Deno.env.get(
                "SUPABASE_URL"
            );

        const anonKey =
            Deno.env.get(
                "SUPABASE_ANON_KEY"
            );

        const serviceRoleKey =
            Deno.env.get(
                "SUPABASE_SERVICE_ROLE_KEY"
            );

        const geminiApiKey =
            Deno.env.get(
                "GEMINI_API_KEY"
            );

        if (!supabaseUrl) {
            throw new Error(
                "SUPABASE_URL is missing."
            );
        }

        if (!anonKey) {
            throw new Error(
                "SUPABASE_ANON_KEY is missing."
            );
        }

        if (!serviceRoleKey) {
            throw new Error(
                "SUPABASE_SERVICE_ROLE_KEY is missing."
            );
        }

        if (!geminiApiKey) {
            throw new Error(
                "GEMINI_API_KEY is missing."
            );
        }

        /*
         * =====================================================
         * 3. AUTH HEADER
         * =====================================================
         */

        const authHeader =
            req.headers.get(
                "Authorization"
            );

        if (!authHeader) {
            return jsonResponse(
                {
                    error:
                        "Not authenticated",
                },
                401
            );
        }

        /*
         * =====================================================
         * 4. CREATE SUPABASE CLIENTS
         * =====================================================
         */

        const userSupabase =
            createClient(
                supabaseUrl,
                anonKey,
                {
                    global: {
                        headers: {
                            Authorization:
                                authHeader,
                        },
                    },
                }
            );

        const adminSupabase =
            createClient(
                supabaseUrl,
                serviceRoleKey
            );

        /*
         * =====================================================
         * 5. VERIFY USER
         * =====================================================
         */

        const {
            data: { user },
            error: authError,
        } =
            await userSupabase.auth.getUser();

        if (
            authError ||
            !user
        ) {
            console.log(
                "Authentication error:",
                authError
            );

            return jsonResponse(
                {
                    error:
                        "Invalid user",
                },
                401
            );
        }

        console.log(
            "Authenticated user:",
            user.id
        );

        /*
         * =====================================================
         * 6. LOAD ACTIVITY
         * =====================================================
         */

        const {
            data: activity,
            error: activityError,
        } =
            await userSupabase
                .from("activities")
                .select(`
          id,
          title,
          category,
          description,
          location,
          host_id
        `)
                .eq(
                    "id",
                    activityId
                )
                .single();

        if (activityError) {
            console.log(
                "Activity query error:",
                activityError
            );

            return jsonResponse(
                {
                    error:
                        "Could not read activity",
                    activityId,
                    databaseError:
                        activityError.message,
                },
                500
            );
        }

        if (!activity) {
            return jsonResponse(
                {
                    error:
                        "Activity not found",
                    activityId,
                },
                404
            );
        }

        console.log(
            "Activity found:",
            activity.title
        );

        /*
         * =====================================================
         * 7. VERIFY HOST
         * =====================================================
         */

        if (
            activity.host_id !==
            user.id
        ) {
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
         * 8. BOOST RATE LIMIT
         * One successful boost every 10 minutes per user
         * =====================================================
         */

        const {
            data: latestBoost,
            error: boostLookupError,
        } =
            await adminSupabase
                .from("activity_boosts")
                .select("boosted_at")
                .eq(
                    "user_id",
                    user.id
                )
                .order(
                    "boosted_at",
                    {
                        ascending: false,
                    }
                )
                .limit(1)
                .maybeSingle();

        if (boostLookupError) {
            console.log(
                "Boost rate limit lookup error:",
                boostLookupError
            );

            return jsonResponse(
                {
                    error:
                        "Could not check boost rate limit.",
                    databaseError:
                        boostLookupError.message,
                },
                500
            );
        }

        if (latestBoost) {
            const lastBoostTime =
                new Date(
                    latestBoost.boosted_at
                ).getTime();

            const now =
                Date.now();

            const cooldownMs =
                10 * 60 * 1000;

            const elapsed =
                now - lastBoostTime;

            if (
                elapsed <
                cooldownMs
            ) {
                const remainingMs =
                    cooldownMs - elapsed;

                const remainingSeconds =
                    Math.ceil(
                        remainingMs / 1000
                    );

                const remainingMinutes =
                    Math.ceil(
                        remainingSeconds / 60
                    );

                console.log(
                    "Boost blocked by cooldown."
                );

                return jsonResponse(
                    {
                        error:
                            "BOOST_RATE_LIMIT",

                        message:
                            `You can boost again in ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.`,

                        retryAfterSeconds:
                            remainingSeconds,
                    },
                    429
                );
            }
        }

        /*
         * =====================================================
         * 9. BUILD GEMINI PROMPT
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

Activity:
Movie night with friends

Return:
["Movies"]

Activity:
Morning hiking trip

Return:
["Hiking"]

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
         * 10. CALL GEMINI
         * =====================================================
         */

        const geminiResponse =
            await callGeminiWithRetry(
                geminiApiKey,
                prompt
            );

        if (!geminiResponse.ok) {
            const errorText =
                await geminiResponse.text();

            console.log(
                "Final Gemini error:",
                errorText
            );

            return jsonResponse(
                {
                    error:
                        "Gemini classification failed",
                    geminiError:
                        errorText,
                },
                geminiResponse.status
            );
        }

        /*
         * =====================================================
         * 11. READ GEMINI RESPONSE
         * =====================================================
         */

        const geminiData =
            await geminiResponse.json();

        let raw =
            geminiData
                ?.candidates?.[0]
                ?.content?.parts?.[0]
                ?.text?.trim();

        console.log(
            "Gemini raw response:",
            raw
        );

        if (!raw) {
            return jsonResponse(
                {
                    error:
                        "Gemini returned an empty response.",
                },
                500
            );
        }

        raw = raw
            .replace(
                /```json/g,
                ""
            )
            .replace(
                /```/g,
                ""
            )
            .trim();

        /*
         * =====================================================
         * 12. PARSE GEMINI INTERESTS
         * =====================================================
         */

        let interests: string[];

        try {
            interests =
                JSON.parse(raw);
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

        if (
            !Array.isArray(
                interests
            )
        ) {
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
         * =====================================================
         * 13. VALIDATE INTERESTS
         * =====================================================
         */

        interests =
            interests
                .filter(
                    (
                        interest
                    ): interest is string =>
                        typeof interest ===
                        "string"
                )
                .filter(
                    (interest) =>
                        ALLOWED_INTERESTS.includes(
                            interest
                        )
                );

        interests = [
            ...new Set(
                interests
            ),
        ];

        console.log(
            "Validated interests:",
            interests
        );

        /*
         * =====================================================
         * 14. NO VALID INTERESTS
         * =====================================================
         */

        if (
            interests.length ===
            0
        ) {
            return jsonResponse({
                success: true,
                activityId:
                    activity.id,
                activityTitle:
                    activity.title,
                interests: [],
                matchedUsers: [],
                matchedUserCount: 0,
            });
        }

        /*
         * =====================================================
         * 15. LOOK UP INTEREST IDS
         * =====================================================
         */

        const {
            data: interestRows,
            error:
            interestLookupError,
        } =
            await adminSupabase
                .from(
                    "interests"
                )
                .select(
                    "id, name"
                )
                .in(
                    "name",
                    interests
                );

        if (
            interestLookupError
        ) {
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
            (
                interestRows ?? []
            ).map(
                (interest) =>
                    interest.id
            );

        console.log(
            "Matched interest IDs:",
            matchedInterestIds
        );

        /*
         * =====================================================
         * 16. FIND MATCHING USERS
         * =====================================================
         */

        let matchingProfileIds:
            string[] = [];

        if (
            matchedInterestIds.length >
            0
        ) {
            const {
                data:
                profileMatches,
                error:
                profileMatchError,
            } =
                await adminSupabase
                    .from(
                        "profile_interests"
                    )
                    .select(
                        "profile_id"
                    )
                    .in(
                        "interest_id",
                        matchedInterestIds
                    );

            if (
                profileMatchError
            ) {
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

            matchingProfileIds =
                [
                    ...new Set(
                        (
                            profileMatches ??
                            []
                        )
                            .map(
                                (row) =>
                                    row.profile_id as string
                            )
                            .filter(
                                (
                                    profileId
                                ) =>
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
         * 17. RECORD SUCCESSFUL BOOST
         * =====================================================
         *
         * Important:
         * We only record this AFTER Gemini and
         * matching both succeed.
         *
         * A Gemini 503 will NOT consume the user's cooldown.
         */

        const {
            error: saveBoostError,
        } =
            await adminSupabase
                .from(
                    "activity_boosts"
                )
                .insert({
                    user_id:
                        user.id,

                    activity_id:
                        activity.id,
                });

        if (
            saveBoostError
        ) {
            console.log(
                "Save boost error:",
                saveBoostError
            );

            return jsonResponse(
                {
                    error:
                        "Could not save boost history.",
                    databaseError:
                        saveBoostError.message,
                },
                500
            );
        }

        /*
         * =====================================================
         * 18. SUCCESS
         * =====================================================
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

            cooldownMinutes: 10,
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