import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuthContext } from "./use-auth-context";

export type AttendingActivity = {
  id: string;
  title: string;
  category: string;
  dateLabel?: string;
  location?: string;
  dateTime: string | null;
};

function formatDateLabel(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function useAttendingActivities() {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  const [activities, setActivities] = useState<AttendingActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);

      const [rsvpResult, hostedResult] = await Promise.all([
        supabase
          .from("rsvps")
          .select("activities(id, title, category, date_time, location)")
          .eq("user_id", currentUserId),
        supabase
          .from("activities")
          .select("id, title, category, date_time, location")
          .eq("host_id", currentUserId),
      ]);

      if (cancelled) return;

      if (rsvpResult.error || hostedResult.error) {
        console.error(
          "[useAttendingActivities] fetch failed:",
          rsvpResult.error ?? hostedResult.error,
        );
        setActivities([]);
        setLoading(false);
        return;
      }

      const rsvpActivities = (rsvpResult.data ?? []).map((row: any) => row.activities);
      const hostedActivities = hostedResult.data ?? [];

      const byId = new Map<string, any>();
      for (const activity of [...rsvpActivities, ...hostedActivities]) {
        if (activity) byId.set(activity.id, activity);
      }

      const now = Date.now();

      const rows = Array.from(byId.values())
        .filter(
          (activity: any) =>
            !activity.date_time || new Date(activity.date_time).getTime() >= now,
        )
        .sort((a: any, b: any) => {
          if (!a.date_time) return 1;
          if (!b.date_time) return -1;
          return new Date(a.date_time).getTime() - new Date(b.date_time).getTime();
        })
        .map((activity: any) => ({
          id: activity.id,
          title: activity.title,
          category: activity.category ?? "social",
          dateLabel: formatDateLabel(activity.date_time),
          location: activity.location ?? undefined,
          dateTime: activity.date_time,
        }));

      setActivities(rows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  return { activities, loading, currentUserId };
}
