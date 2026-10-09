export type TourStep = {
  target?: string;
  anchor?: string;
  placement?: 'below';
  destination?: TourStep['route'];
  route: '/' | '/explore' | '/calendar' | '/post' | '/rides' | '/chats' | '/notifications' | '/profile';
  title: string;
  description: string;
};

// A target-free step introduces the whole page; its details follow in sequence.
export const TUTORIAL_STEPS: readonly TourStep[] = [
  { anchor: 'tab-home', route: '/', title: 'Home: find a plan', description: 'Discover activities, join or host a plan, arrange a ride, and coordinate with others. Home is where you start.' },
  { target: 'home-search', route: '/', title: 'Find something that interests you', description: 'Search by activity title. Open an activity to see its time, location, host, and participation options.' },
  { target: 'home-categories', route: '/', title: 'Turn discovery into a plan', description: 'Categories narrow the feed. Open an activity to join or request access, or bookmark it for later.' },
  { target: 'tab-explore', route: '/', destination: '/explore', title: 'Try it: open Explore tab', description: 'Tap the highlighted Explore tab.' },
  { anchor: 'tab-explore', route: '/explore', title: 'Explore: see the community', description: 'Explore shows photos and posts from activities. See what people have been doing and discover shared experiences.' },
  { target: 'explore-heading', route: '/explore', title: 'Follow a shared experience', description: 'Browse activity photos and captions. Open a post or profile to learn more about the people behind it.' },
  { target: 'header-calendar', route: '/explore', destination: '/calendar', title: 'Try it: open calendar icon', description: 'Tap the highlighted calendar icon.' },
  { anchor: 'calendar-grid-and-legend', placement: 'below', route: '/calendar', title: 'Calendar: put plans in context', description: 'Browse activities by date. Select a day to see its activities, then open one for details.' },
  { target: 'calendar-grid-and-legend', route: '/calendar', title: 'Read the activity markers', description: 'Dots mark dates with activities. The legend separates your events from others. Select a day to see its list.' },
  { anchor: 'tab-post', route: '/post', title: 'Post: host your own activity', description: 'Create a plan others can join. Add the details, location, time, and capacity, then review before publishing.' },
  { target: 'post-title', route: '/post', title: 'Start with a clear invitation', description: 'Start with a recognizable title, then complete the form below. The tour will not publish an activity.' },
  { target: 'tab-rides', route: '/post', destination: '/rides', title: 'Try it: open Rides tab', description: 'Tap the highlighted Rides tab.' },
  { anchor: 'tab-rides', route: '/rides', title: 'Rides: get to the plan', description: 'Find a seat or offer a ride. Drivers review passenger requests. You can also track your requests and ride history here.' },
  { target: 'ride-actions', route: '/rides', title: 'Choose your role for the trip', description: 'Choose Find a ride or Offer a ride. Connect it to an activity and review pickup details before confirming.' },
  { target: 'tab-chats', route: '/rides', destination: '/chats', title: 'Try it: open Chats tab', description: 'Tap the highlighted Chats tab.' },
  { anchor: 'tab-chats', route: '/chats', title: 'Chats: coordinate with people', description: 'Use direct conversations or activity group chats to discuss plans and keep everyone informed.' },
  { target: 'chat-heading', route: '/chats', title: 'Find the right conversation', description: 'Open a conversation from Messages. Activity groups help participants coordinate; direct chats connect two people.' },
  { target: 'header-notifications', route: '/chats', destination: '/notifications', title: 'Try it: open notification bell', description: 'Tap the highlighted notification bell.' },
  { anchor: 'header-notifications', route: '/notifications', title: 'Notifications: keep plans moving', description: 'Review updates, follow requests, and activity requests here. Some requests need your response.' },
  { target: 'notification-heading', route: '/notifications', title: 'Review and respond', description: 'Read updates below. Requests may offer Accept or Decline. The tour will not respond for you.' },
  { target: 'tab-profile', route: '/notifications', destination: '/profile', title: 'Try it: open Profile tab', description: 'Tap the highlighted Profile tab.' },
  { anchor: 'tab-profile', route: '/profile', title: 'Profile: return to your plans', description: 'Your profile brings your identity and activities together. Return here to find plans you created or joined.' },
  { target: 'profile-activities', route: '/profile', title: 'Separate hosting from attending', description: 'Switch between activities you created and joined. Open an activity to return to its details.' },
  { target: 'header-profile', route: '/profile', title: 'Your account options stay close', description: 'Your avatar opens saved activities and account options. Choose App Tutorial there to replay this guide.' },
];

export function tourHref(route: TourStep['route']) {
  return route === '/calendar' ? '/calendar' : route === '/' ? '/(tabs)' : `/(tabs)${route}`;
}

export type TourRect = { x: number; y: number; width: number; height: number };

// Only clip the cutout to the physical viewport. Safe-area insets constrain notes, not icon geometry.
export function spotlightLayout(rect: TourRect | null, width: number, height: number, top: number, bottom: number) {
  const safeTop = top + 12;
  const safeBottom = height - bottom - 12;
  const x = rect ? Math.max(0, rect.x - 6) : 0;
  const y = rect ? Math.max(0, rect.y - 6) : 0;
  const right = rect ? Math.min(width, rect.x + rect.width + 6) : 0;
  const lower = rect ? Math.min(height, rect.y + rect.height + 6) : 0;
  const hole = rect && right > x && lower > y ? { x, y, width: right - x, height: lower - y } : null;
  const above = hole ? hole.y - safeTop - 12 : 0;
  const below = hole ? safeBottom - (hole.y + hole.height) - 12 : 0;
  // If a target fills the viewport, prefer a clear explanation over covering the target with a card.
  const visibleHole = Math.max(above, below) >= 140 ? hole : null;
  const cardTop = visibleHole && below >= above ? visibleHole.y + visibleHole.height + 12 : safeTop;
  const maxHeight = visibleHole ? Math.max(above, below) : safeBottom - safeTop;
  return { hole: visibleHole, cardTop, maxHeight: Math.min(320, Math.max(100, maxHeight)) };
}

// A floating note points to the measured icon without consuming navigator space.
export function overviewLayout(rect: TourRect | null, width: number, height: number, top: number, bottom: number, placement?: 'below') {
  const cardWidth = Math.min(360, Math.max(0, width - 32));
  const anchorX = rect ? rect.x + rect.width / 2 : width / 2;
  const left = Math.max(16, Math.min(width - cardWidth - 16, anchorX - cardWidth / 2));
  const above = placement !== 'below' && (!rect || rect.y > height / 2);
  const edge = above ? (rect?.y ?? height - bottom - 60) - 16 : (rect ? rect.y + rect.height : top) + 16;
  const available = above ? edge - top - 12 : height - bottom - 12 - edge;
  return {
    above,
    arrowX: Math.max(left + 16, Math.min(left + cardWidth - 16, anchorX)),
    arrowY: above ? edge : edge - 16,
    card: { left, width: cardWidth, maxHeight: Math.min(340, Math.max(100, available)), ...(above ? { bottom: height - edge } : { top: edge }) },
  };
}
