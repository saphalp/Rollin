import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "./use-auth-context";
import { useNotificationRealtime } from "./use-notification-realtime";

export type FollowState = "not_following" | "requested" | "following";

type DbStatus = "pending" | "accepted" | "rejected";

function statusToState(status: DbStatus | null | undefined): FollowState {
  if (status === "pending") return "requested";
  if (status === "accepted") return "following";
  return "not_following";
}

export function useFollow(targetUserId: string | undefined) {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  const isOwnProfile =
    !!currentUserId && !!targetUserId && targetUserId === currentUserId;
  const canQuery =
    !!currentUserId && !!targetUserId && !isOwnProfile;

  const [followState, setFollowState] = useState<FollowState>("not_following");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    if (!canQuery) return;
    setIsLoading(true);

    const { data } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", currentUserId!)
      .eq("following_id", targetUserId!)
      .maybeSingle();

    setFollowState(statusToState(data?.status as DbStatus | undefined));
    setIsLoading(false);
  }, [canQuery, currentUserId, targetUserId]);

  useEffect(() => {
    if (!canQuery) {
      setFollowState("not_following");
      return;
    }
    refresh();
  }, [canQuery, refresh]);

  useNotificationRealtime((n) => {
    if (!canQuery) return;
    if (n.actor_id !== targetUserId) return;
    if (n.type === "follow_accepted" || n.type === "follow_rejected") {
      refresh();
    }
  });

  async function follow() {
    if (!canQuery) return;
    const previous = followState;
    setIsMutating(true);
    setFollowState("requested");

    const { error: deleteError } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", currentUserId!)
      .eq("following_id", targetUserId!);

    if (deleteError) {
      console.error("[useFollow] delete before insert failed:", deleteError);
      setFollowState(previous);
      setIsMutating(false);
      return;
    }

    const { error: insertError } = await supabase.from("follows").insert({
      follower_id: currentUserId!,
      following_id: targetUserId!,
      status: "pending",
    });

    if (insertError) {
      console.error("[useFollow] insert follow failed:", insertError);
      setFollowState(previous);
    }
    setIsMutating(false);
  }

  async function unfollowOrCancel() {
    if (!canQuery) return;
    const previous = followState;
    setIsMutating(true);
    setFollowState("not_following");

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", currentUserId!)
      .eq("following_id", targetUserId!);

    if (error) {
      console.error("[useFollow] unfollow/cancel failed:", error);
      setFollowState(previous);
    }
    setIsMutating(false);
  }

  async function toggle() {
    if (followState === "not_following") return follow();
    return unfollowOrCancel();
  }

  return {
    followState,
    isLoading,
    isMutating,
    toggle,
    refresh,
    isOwnProfile,
  };
}
