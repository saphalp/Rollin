import { useCallback, useEffect, useState } from "react";

import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";

export type StandaloneRide = {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatarUri: string;
  pickupLocation: string;
  destination: string;
  dateLabel?: string;
  availableSeats: number;
  notes?: string;
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

// Rides offered by a driver that aren't tied to a specific activity —
// e.g. shown on the Home page's "Rides Offered" section.
export function useStandaloneRides() {
  const [rides, setRides] = useState<StandaloneRide[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRides = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("rides_offered")
      .select("id, driver_id, pickup_location, destination, date_time, available_seats, notes")
      .is("activity_id", null)
      .eq("status", "open")
      .gte("date_time", new Date().toISOString())
      .order("date_time", { ascending: true });

    if (error) {
      console.error("[useStandaloneRides] fetch failed:", error);
    }

    if (error || !data || data.length === 0) {
      setRides([]);
      setLoading(false);
      return;
    }

    const driverIds = [...new Set(data.map((r: any) => r.driver_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, profile_picture")
      .in("id", driverIds);

    const profileById: Record<string, any> = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id, p]),
    );

    setRides(
      data.map((r: any) => {
        const profile = profileById[r.driver_id];
        return {
          id: r.id,
          driverId: r.driver_id,
          driverName: profile?.full_name ?? "Rollin' User",
          driverAvatarUri: resolveAvatarUri(profile?.profile_picture),
          pickupLocation: r.pickup_location,
          destination: r.destination,
          dateLabel: formatDateLabel(r.date_time),
          availableSeats: r.available_seats,
          notes: r.notes ?? undefined,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  return { rides, loading, refresh: fetchRides };
}
