import { requireVerifiedLogin } from '../_shared/login-verification.ts';
import { createClient } from "npm:@supabase/supabase-js@2.110.2";

// Not a secret — Didit's own docs say to treat workflow_id as per-session
// config, not an env var. "Compliance workflow" from the console.
const DIDIT_WORKFLOW_ID = "26d3d3fb-da0b-49e4-87fc-011fb151dadb";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return reply({ error: "Sign in to verify your license." }, 401);
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user)
      return reply({ error: "Sign in again to verify your license." }, 401);
    if (!(await requireVerifiedLogin(client))) return reply({ error: 'Complete email login verification first.' }, 403);

    // Use the caller's RLS permissions, never a service-role key.
    const { data: driverProfile, error: driverError } = await client
      .from("driver_profiles")
      .select("profile_id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (driverError)
      return reply({ error: "Could not load your driver profile." }, 500);
    if (!driverProfile)
      return reply(
        { error: "Register as a driver before verifying your license." },
        422,
      );

    const apiKey = Deno.env.get("DIDIT_API_KEY");
    if (!apiKey) {
      console.error("didit-create-session: missing DIDIT_API_KEY secret", {
        deployment: Deno.env.get("DENO_DEPLOYMENT_ID") ?? "unknown",
      });
      return reply(
        { error: "License verification has not been configured yet." },
        503,
      );
    }

    const sessionResponse = await fetch(
      "https://verification.didit.me/v3/session/",
      {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: DIDIT_WORKFLOW_ID,
          vendor_data: user.id,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!sessionResponse.ok) {
      console.error("didit-create-session: Didit API error", {
        status: sessionResponse.status,
      });
      return reply(
        { error: "Could not start license verification. Try again later." },
        502,
      );
    }

    const session = await sessionResponse.json();
    if (
      typeof session?.url !== "string" ||
      typeof session?.session_id !== "string"
    ) {
      return reply(
        { error: "License verification returned an invalid response." },
        502,
      );
    }

    const { error: updateError } = await client
      .from("driver_profiles")
      .update({
        verification_session_id: session.session_id,
        verification_status: "pending",
      })
      .eq("profile_id", user.id);
    if (updateError)
      return reply({ error: "Could not save your verification session." }, 500);

    return reply({ url: session.url, sessionId: session.session_id });
  } catch (err) {
    console.error("didit-create-session: unexpected error", err);
    return reply(
      { error: "Could not start license verification. Please try again." },
      502,
    );
  }
});
