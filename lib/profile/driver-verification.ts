import { FunctionsHttpError } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";

export async function startLicenseVerification(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("didit-create-session", {
    body: {},
  });

  if (error) {
    let message = "Could not start license verification. Please try again.";

    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === "string") message = body.error;
    }

    throw new Error(message);
  }

  if (typeof data?.url !== "string") {
    throw new Error("License verification did not return a valid link.");
  }

  await WebBrowser.openBrowserAsync(data.url);
}
