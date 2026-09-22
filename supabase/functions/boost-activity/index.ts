import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
    try {
        const { activityId } = await req.json();

        if (!activityId) {
            return new Response(
                JSON.stringify({ error: "activityId is required" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

        if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
            throw new Error("Missing Supabase or Gemini environment variables.");
        }

        const supabase = createClient(
            supabaseUrl,
            serviceRoleKey
        );

        const authHeader = req.headers.get("Authorization");

        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Not authenticated" }),
                {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const token = authHeader.replace("Bearer ", "");

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid user" }),
                {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const { data: activity, error: activityError } =
            await supabase
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
            console.log("Activity ID received:", activityId);
            console.log("Activity query error:", activityError);
            console.log("Activity data:", activity);

            return new Response(
                JSON.stringify({
                    error: "Activity not found",
                    activityId,
                    databaseError: activityError?.message ?? null,
                }),
                {
                    status: 404,
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        if (activity.host_id !== user.id) {
            return new Response(
                JSON.stringify({
                    error: "Only the activity host can boost this activity.",
                }),
                {
                    status: 403,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const prompt = `
You classify activities for a university social app.

Choose only interests that genuinely match this activity.

You MUST ONLY choose from this list:

${ALLOWED_INTERESTS.join(", ")}

Rules:
- Return 1 to 3 interests.
- Do not invent interests.
- Return ONLY a JSON array.
- No explanation.

Activity title:
${activity.title}

Category:
${activity.category}

Description:
${activity.description ?? ""}

Location:
${activity.location ?? ""}
`;

        const geminiResponse = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": geminiApiKey,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt,
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.1,
                    },
                }),
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini error:", errorText);

            throw new Error("Gemini request failed.");
        }

        const geminiData = await geminiResponse.json();

        const raw =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!raw) {
            throw new Error("Gemini returned no result.");
        }

        let interests: string[] = [];

        try {
            interests = JSON.parse(raw);
        } catch {
            throw new Error(
                `Gemini returned invalid JSON: ${raw}`
            );
        }

        interests = interests.filter((interest) =>
            ALLOWED_INTERESTS.includes(interest)
        );

        return new Response(
            JSON.stringify({
                activityId: activity.id,
                interests,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error(error);

        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
});