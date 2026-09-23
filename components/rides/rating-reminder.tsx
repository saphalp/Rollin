import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useAuthContext } from '@/hooks/use-auth-context';
import { router, usePathname } from 'expo-router';
import { ratingTargets } from '@/services/ride-ratings-service';

// Check on return as well as while the tabs are open, so offline completions are not lost.
export function RatingReminder() {
  const { profile } = useAuthContext();
  const pathname = usePathname();
  const prompted = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    let busy = false;
    async function check() {
      if (!profile?.id || pathname.startsWith('/ride/ratings/') || busy || AppState.currentState !== 'active') return;
      busy = true;
      try {
        const targets = await ratingTargets();
        const target = targets.find(t => !prompted.current.has(profile.id + t.ride_id));
        if (!active || !target) return;
        prompted.current.add(profile.id + target.ride_id);
        Alert.alert('How was your ride?', `Your trip to ${target.destination} is complete. Rate the people you rode with.`, [
          { text: 'Later', style: 'cancel' },
          { text: 'Rate ride', onPress: () => router.push({ pathname: '/ride/ratings/[id]', params: { id: target.ride_id } }) },
        ]);
      } catch { /* History remains available; retry on the next foreground check. */ }
      finally { busy = false; }
    }
    void check();
    const timer = setInterval(() => void check(), 30_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [profile?.id, pathname]);
  return null;
}
