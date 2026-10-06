import { createClient } from "npm:@supabase/supabase-js@2";
import {
  XMLParser,
  XMLValidator,
} from "npm:fast-xml-parser@4.5.3";

const FEED_URL =
  "https://api.calendar.moderncampus.net/pubcalendar/" +
  "9a424096-0a54-475e-a112-ec2fb41d5fa1/rss" +
  "?url=https%3A%2F%2Fwww.latech.edu%2Fevents.php&hash=true";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  return text(value) || null;
}

function toArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const milliseconds = Date.parse(value);

  return (
    !Number.isNaN(milliseconds) &&
    new Date(milliseconds).toISOString().slice(0, 10) === value
  );
}

function isValidTimestamp(value: string): boolean {
  return (
    /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function httpsUrl(value: unknown): string | null {
  const input = text(value);
  if (!input) return null;

  try {
    const url = new URL(input);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

type CampusEvent = {
  campus: string;
  source_id: string;
  title: string;
  description: string | null;
  official_url: string;
  category: string | null;
  tags: string[];
  location: string | null;
  room: string | null;
  organizer: string | null;
  image_url: string | null;
  status: string;
  featured: boolean;
  date_only: boolean;
  start_date: string | null;
  end_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  synced_at: string;
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "POST required" }, 405);
  }

  const syncSecret = Deno.env.get("CAMPUS_SYNC_SECRET");

  if (!syncSecret) {
    return jsonResponse(
      { error: "CAMPUS_SYNC_SECRET is not configured" },
      500,
    );
  }

  if (
    request.headers.get("x-campus-sync-secret") !== syncSecret
  ) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing backend configuration");
    }

    const feedResponse = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(20_000),
    });

    if (!feedResponse.ok) {
      throw new Error(`Feed HTTP ${feedResponse.status}`);
    }

    const xml = await feedResponse.text();

    if (xml.length > 5_000_000) {
      throw new Error("Feed exceeds size limit");
    }

    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
      throw new Error("Unsupported XML declarations");
    }

    if (XMLValidator.validate(xml) !== true) {
      throw new Error("Invalid RSS XML");
    }

    const parser = new XMLParser({
      parseTagValue: false,
      trimValues: true,
    });

    const document = parser.parse(xml);
    const channel = document?.rss?.channel;

    if (
      !channel ||
      text(channel.title) !== "Louisiana Tech University"
    ) {
      throw new Error("Unexpected feed");
    }

    const items = toArray(channel.item);

    if (items.length === 0) {
      throw new Error("Empty feed; existing events retained");
    }

    const rowsById = new Map<string, CampusEvent>();
    const syncedAt = new Date().toISOString();

    let skipped = 0;
    let duplicates = 0;

    for (const rawItem of items) {
      if (!isRecord(rawItem)) {
        skipped++;
        console.warn("Skipping malformed event entry");
        continue;
      }

      const sourceId = text(rawItem["cal:guid"]);
      const title = text(rawItem.title);

      // An incomplete event should not stop other imports.
      if (!sourceId || !title) {
        skipped++;
        console.warn("Skipping incomplete event", {
          sourceId: sourceId || null,
          title: title || null,
        });
        continue;
      }

      const start = text(rawItem["cal:start"]);
      const end = text(rawItem["cal:end"]);
      const dateOnly = isValidDate(start);

      const validRange = dateOnly
        ? isValidDate(end) && end >= start
        : (
          isValidTimestamp(start) &&
          isValidTimestamp(end) &&
          Date.parse(end) >= Date.parse(start)
        );

      if (!validRange) {
        skipped++;
        console.warn("Skipping event with invalid dates", {
          sourceId,
          start,
          end,
        });
        continue;
      }

      const officialUrl = httpsUrl(rawItem.link);

      if (
        !officialUrl ||
        new URL(officialUrl).hostname !== "www.latech.edu"
      ) {
        skipped++;
        console.warn("Skipping event with invalid URL", {
          sourceId,
        });
        continue;
      }

      // Deduplicate only after validating the entry.
      // Similar titles with different IDs remain separate.
      if (rowsById.has(sourceId)) {
        duplicates++;
        console.warn("Skipping repeated event ID:", sourceId);
        continue;
      }

      const tagContainer = rawItem["cal:tags"];
      const tags = isRecord(tagContainer)
        ? toArray(tagContainer["cal:tag"])
          .map(text)
          .filter(Boolean)
        : [];

      rowsById.set(sourceId, {
        campus: "latech",
        source_id: sourceId,
        title,
        description: optionalText(rawItem.description),
        official_url: officialUrl,

        category: optionalText(rawItem["cal:calendar"]),
        tags: [...new Set(tags)],
        location: optionalText(rawItem["cal:location"]),
        room: optionalText(rawItem["cal:locationRoom"]),
        organizer: optionalText(rawItem["cal:organizer"]),
        image_url: httpsUrl(rawItem["cal:image"]),

        status:
          text(rawItem["cal:status"]).toUpperCase() ||
          "CONFIRMED",

        featured:
          text(rawItem["cal:featured"]).toLowerCase() ===
          "true",

        date_only: dateOnly,
        start_date: dateOnly ? start : null,
        end_date: dateOnly ? end : null,

        starts_at: dateOnly
          ? null
          : new Date(start).toISOString(),

        ends_at: dateOnly
          ? null
          : new Date(end).toISOString(),

        synced_at: syncedAt,
      });
    }

    const rows = [...rowsById.values()];

    if (rows.length === 0) {
      throw new Error(
        "No valid events found; inspect skipped-event logs",
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // Update existing official IDs or insert new ones.
    // Events absent from this feed are not deleted.
    const { error } = await supabase
      .from("campus_events")
      .upsert(rows, {
        onConflict: "campus,source_id",
      });

    if (error) {
      throw new Error(`Database upsert failed: ${error.message}`);
    }

    console.log("Campus sync completed", {
      received: items.length,
      imported: rows.length,
      skipped,
      duplicates,
    });

    return jsonResponse({
      success: true,
      received: items.length,
      imported: rows.length,
      skipped,
      duplicates,
      synced_at: syncedAt,
    });
  } catch (error) {
    console.error(
      "Campus sync failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      {
        error:
          "Sync failed; inspect function logs. Existing events retained.",
      },
      500,
    );
  }
});