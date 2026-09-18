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

  const [liked, setLiked] = useState(initiallyLiked);
  const [count, setCount] = useState(initialCount);
  const [isMutating, setIsMutating] = useState(false);

  async function toggle() {
    if (!currentUserId || isMutating) return;

    const previousLiked = liked;
    const previousCount = count;

    setIsMutating(true);
    setLiked(!previousLiked);
    setCount(previousLiked ? previousCount - 1 : previousCount + 1);

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
      setLiked(previousLiked);
      setCount(previousCount);
    }

    setIsMutating(false);
  }

  return { liked, count, isMutating, toggle };
}
