import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

type InterestRow = {
  id: string;
  name: string;
};

export function useProfileInterests(profileId: string | undefined) {
  const [allInterests, setAllInterests] = useState<InterestRow[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const savingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setAllInterests([]);
      setSelectedNames([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [{ data: interests }, { data: selections }] = await Promise.all([
      supabase.from("interests").select("id, name").order("name"),
      supabase
        .from("profile_interests")
        .select("interest_id, interests(name)")
        .eq("profile_id", profileId),
    ]);

    setAllInterests(interests ?? []);
    setSelectedNames(
      (selections ?? [])
        .map((row: any) => row.interests?.name as string | undefined)
        .filter((name): name is string => !!name),
    );
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (nextSelectedNames: string[]): Promise<boolean> => {
      if (!profileId) return false;
      if (savingRef.current) return false;

      savingRef.current = true;

      // Optimistic local update
      setSelectedNames(nextSelectedNames);

      try {
        // Ensure interest catalog is available
        let currentInterests = allInterests;
        if (currentInterests.length === 0) {
          const { data } = await supabase.from("interests").select("id, name").order("name");
          if (data && data.length > 0) {
            currentInterests = data;
            setAllInterests(data);
          }
        }

        const nameToId = new Map(currentInterests.map((i) => [i.name, i.id]));
        const targetIds = nextSelectedNames
          .map((name) => nameToId.get(name))
          .filter((id): id is string => !!id);

        // 1. Primary: Use atomic server RPC so adding and removing interests occurs
        // in a single database transaction.
        const { error: rpcError } = await supabase.rpc("set_profile_interests", {
          p_interest_ids: targetIds,
        });

        if (!rpcError) {
          return true;
        }

        console.warn(
          "[useProfileInterests] RPC failed or unavailable, falling back to client-side sync:",
          rpcError
        );

        // 2. Fallback: Client-side synchronized execution with rollback protection
        const { data: currentSelections, error: fetchError } = await supabase
          .from("profile_interests")
          .select("interest_id")
          .eq("profile_id", profileId);

        if (fetchError) {
          throw new Error(`Failed to load existing interests: ${fetchError.message}`);
        }

        const existingIds = new Set(
          (currentSelections ?? []).map((r: { interest_id: string }) => r.interest_id)
        );

        const toAddIds = targetIds.filter((id) => !existingIds.has(id));
        const toRemoveIds = [...existingIds].filter((id) => !targetIds.includes(id));

        let insertedIds: string[] = [];

        // Insert new interests
        if (toAddIds.length > 0) {
          const { error: insertError } = await supabase
            .from("profile_interests")
            .insert(toAddIds.map((interestId) => ({ profile_id: profileId, interest_id: interestId })));

          if (insertError) {
            throw new Error(`Insert failed: ${insertError.message}`);
          }
          insertedIds = toAddIds;
        }

        // Delete removed interests
        if (toRemoveIds.length > 0) {
          const { error: deleteError } = await supabase
            .from("profile_interests")
            .delete()
            .eq("profile_id", profileId)
            .in("interest_id", toRemoveIds);

          if (deleteError) {
            // Roll back the inserts from this transaction to maintain consistency
            if (insertedIds.length > 0) {
              await supabase
                .from("profile_interests")
                .delete()
                .eq("profile_id", profileId)
                .in("interest_id", insertedIds);
            }
            throw new Error(`Delete failed: ${deleteError.message}`);
          }
        }

        return true;
      } catch (err) {
        console.error("[useProfileInterests] Save failed:", err);
        // CRITICAL: Always re-fetch the true state from Supabase on failure so
        // the app never displays an inconsistent state.
        await refresh();
        return false;
      } finally {
        savingRef.current = false;
      }
    },
    [allInterests, profileId, refresh]
  );

  return {
    allInterestNames: allInterests.map((i) => i.name),
    selectedNames,
    loading,
    save,
    refresh,
  };
}
