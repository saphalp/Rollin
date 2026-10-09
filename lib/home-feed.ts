function normalized(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp);/gi, ' ')
    .normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function isAcademicCalendar(event: {
  category: string | null; tags?: string[] | null; title?: string;
}): boolean {
  const labels = [event.category, ...(event.tags ?? [])].map(value => normalized(value ?? ''));
  if (labels.some(value => /\bacademic calendar\b/.test(value))) return true;
  const title = normalized(event.title ?? '');
  // Administrative dates can arrive without the Academic Calendar label.
  // Do not reject workshops just because their description says "register".
  return /\b(?:advising|registration|enrollment|enrolment)\s+(?:begins?|ends?|opens?|closes?|deadlines?)\b/.test(title)
    || /\b(?:deadline|last day)\b.*\b(?:register|registration|enroll|enrollment|drop|withdraw|add classes|add courses|tuition|fees|payment|pay|graduation application|apply for graduation)\b/.test(title)
    || /\b(?:registration|enrollment|tuition|fees|payment|graduation application)\b.*\b(?:deadline|due|last day)\b/.test(title)
    || /\b(?:classes|quarter|semester|term)\s+(?:begin|begins|end|ends)\b/.test(title)
    || /\b(?:final exams?|final examinations?|grades due|drop add period|add drop period)\b/.test(title);
}

export const HOME_CAMPUS_LIMIT = 2;

// Rotate the preview through the sorted pool on successful refreshes. User
// activities keep their order and are never removed to make room for RSS.
export function balancedHomeFeed<T extends { campusEvent?: unknown }>(items: T[], rotation = 0): T[] {
  const community = items.filter(item => !item.campusEvent);
  const pool = items.filter(item => !!item.campusEvent);
  const start = pool.length ? ((rotation % pool.length) + pool.length) % pool.length : 0;
  const campus = Array.from({ length: Math.min(HOME_CAMPUS_LIMIT, pool.length) },
    (_, index) => pool[(start + index) % pool.length]);
  const result: T[] = [];
  let campusIndex = 0;
  community.forEach((item, index) => {
    result.push(item);
    if ((index + 1) % 3 === 0 && campusIndex < campus.length) result.push(campus[campusIndex++]);
  });
  return result.concat(campus.slice(campusIndex));
}
