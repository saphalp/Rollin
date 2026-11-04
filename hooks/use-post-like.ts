import { useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuthContext } from "./use-auth-context";

export function usePostLike(
  postId: string,
  initiallyLiked: boolean,
  initialCount: number,
) {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  const [overrideLiked, setOverrideLiked] = useState<boolean | null>(null);
  const [countOffset, setCountOffset] = useState(0);
  const [prevProps, setPrevProps] = useState({ initiallyLiked, initialCount });
  const [isMutating, setIsMutating] = useState(false);

  // If server props change, reset local optimistic overrides
  const propsChanged =
    prevProps.initiallyLiked !== initiallyLiked ||
    prevProps.initialCount !== initialCount;

  if (propsChanged) {
    setPrevProps({ initiallyLiked, initialCount });
    setOverrideLiked(null);
    setCountOffset(0);
  }

  const liked = propsChanged
    ? initiallyLiked
    : overrideLiked !== null
      ? overrideLiked
      : initiallyLiked;
  const currentOffset = propsChanged ? 0 : countOffset;
  const count = Math.max(0, initialCount + currentOffset);

  async function toggle() {
    if (!currentUserId || isMutating) return;

    const previousLiked = liked;
    const previousOffset = currentOffset;

    setIsMutating(true);
    setOverrideLiked(!previousLiked);
    setCountOffset(previousLiked ? previousOffset - 1 : previousOffset + 1);

    const { error } = previousLiked
      ? await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUserId)
      : await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: currentUserId });

    if (error) {
      console.error("[usePostLike] toggle failed:", error);
      setOverrideLiked(previousLiked);
      setCountOffset(previousOffset);
    }

    setIsMutating(false);
  }

  return { liked, count, isMutating, toggle };
}
