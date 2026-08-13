import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

type InterestRow = {
  id: string;
  name: string;
};

export function useProfileInterests(profileId: string | undefined) {
  const [allInterests, setAllInterests] = useState<InterestRow[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
    refresh();
  }, [refresh]);

  async function save(nextSelectedNames: string[]) {
    if (!profileId) return;

    const previous = selectedNames;
    setSelectedNames(nextSelectedNames);

    const nameToId = new Map(allInterests.map((i) => [i.name, i.id]));

    const toAddIds = nextSelectedNames
      .filter((name) => !previous.includes(name))
      .map((name) => nameToId.get(name))
      .filter((id): id is string => !!id);

    const toRemoveIds = previous
      .filter((name) => !nextSelectedNames.includes(name))
      .map((name) => nameToId.get(name))
      .filter((id): id is string => !!id);

    if (toAddIds.length > 0) {
      const { error } = await supabase
        .from("profile_interests")
        .insert(toAddIds.map((interestId) => ({ profile_id: profileId, interest_id: interestId })));

      if (error) {
        console.error("[useProfileInterests] insert failed:", error);
        setSelectedNames(previous);
        return;
      }
    }

    if (toRemoveIds.length > 0) {
      const { error } = await supabase
        .from("profile_interests")
        .delete()
        .eq("profile_id", profileId)
        .in("interest_id", toRemoveIds);

      if (error) {
        console.error("[useProfileInterests] delete failed:", error);
        setSelectedNames(previous);
        return;
      }
    }
  }

  return {
    allInterestNames: allInterests.map((i) => i.name),
    selectedNames,
    loading,
    save,
  };
}
