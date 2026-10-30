import { usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { routePattern, startAppTracking, trackScreen } from '@/lib/analytics';

/** Session, screen-view and uncaught-error tracking for `app_events`. Mount once in the root layout. */
export function useAppAnalytics() {
  const pathname = usePathname();
  const segments = useSegments();
  const lastPath = useRef<string | null>(null);

  useEffect(() => startAppTracking(), []);

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;
    // Log the route pattern (/activity/[id]), never the concrete path with its ids.
    trackScreen(routePattern(segments));
    // segments changes along with pathname; keying on pathname alone avoids double logging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
