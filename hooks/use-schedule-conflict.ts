import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuthContext } from '@/hooks/use-auth-context';
import type { ScheduleWarning } from '@/lib/schedule-conflicts';
import { checkScheduleConflicts } from '@/services/schedule-conflicts-service';

type Check = { controller: AbortController; resolve?: (continueJoining: boolean) => void };

export function useScheduleConflict(activityId: string, userId: string | null) {
  const { claims } = useAuthContext();
  const sessionUserId = claims?.sub;
  const [warning, setWarning] = useState<ScheduleWarning | null>(null);
  const active = useRef(false);
  const pending = useRef<Check | null>(null);

  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => {
      active.current = false;
      pending.current?.controller.abort();
      pending.current?.resolve?.(false);
      pending.current = null;
      setWarning(null);
    };
  }, [activityId, userId, sessionUserId]));

  function decide(continueJoining: boolean) {
    const check = pending.current;
    if (!check || !active.current) return;
    check.resolve?.(continueJoining);
    setWarning(null);
  }

  async function confirmSchedule(): Promise<boolean> {
    if (!active.current || !userId || userId !== sessionUserId || pending.current) return false;
    const check: Check = { controller: new AbortController() };
    pending.current = check;
    try {
      const result = await checkScheduleConflicts(activityId, userId, check.controller.signal);
      if (pending.current !== check || check.controller.signal.aborted) return false;
      if (!result.conflicts.length) return true;
      const approved = await new Promise<boolean>(resolve => {
        check.resolve = resolve;
        setWarning(result);
      });
      return approved && active.current && pending.current === check && !check.controller.signal.aborted;
    } catch (error) {
      if (check.controller.signal.aborted) return false;
      throw error;
    } finally {
      if (pending.current === check) pending.current = null;
    }
  }

  return { warning, confirmSchedule, goBack: () => decide(false), continueJoining: () => decide(true) };
}
