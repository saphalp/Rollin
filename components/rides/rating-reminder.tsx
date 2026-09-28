import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useAuthContext } from '@/hooks/use-auth-context';
import { router, usePathname } from 'expo-router';
import { ratingTargets } from '@/services/ride-ratings-service';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Check on return as well as while the tabs are open, so offline completions are not lost.
export function RatingReminder() {
  const { profile } = useAuthContext();
  const pathname = usePathname();
  const prompted = useRef(new Set<string>());
  const checking = useRef(false);
  const alertOpen = useRef(false);
  useEffect(() => {
    let active = true;
    async function check() {
      if (!active || !profile?.id || pathname.startsWith('/ride/ratings/') || checking.current || alertOpen.current || AppState.currentState !== 'active') return;
      checking.current = true;
      try {
        const targets = await ratingTargets();
        let target: (typeof targets)[number] | undefined;
        let reminderKey = '';
        for (const candidate of targets) {
          const key = `rollin:rating-reminder:v1:${profile.id}:${candidate.ride_id}`;
          if (prompted.current.has(key)) continue;
          if (await AsyncStorage.getItem(key)) { prompted.current.add(key); continue; }
          target = candidate;
          reminderKey = key;
          break;
        }
        if (!active || !target || AppState.currentState !== 'active') return;
        // Save before displaying so reloads cannot repeat this ride's reminder.
        await AsyncStorage.setItem(reminderKey, 'shown');
        if (!active || AppState.currentState !== 'active') return;
        prompted.current.add(reminderKey);
        alertOpen.current = true;
        const rideId = target.ride_id;
        const close = () => { alertOpen.current = false; };
        Alert.alert('How was your ride?', `Your trip to ${target.destination} is complete. Rate the people you rode with.`, [
          { text: 'Not now', style: 'cancel', onPress: close },
          { text: 'Rate ride', onPress: () => { close(); router.push({ pathname: '/ride/ratings/[id]', params: { id: rideId } }); } },
        ], { cancelable: true, onDismiss: close });
      } catch { /* History remains available; retry on the next foreground check. */ }
      finally { checking.current = false; }
    }
    void check();
    const timer = setInterval(() => void check(), 30_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [profile?.id, pathname]);
  return null;
}
