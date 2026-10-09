import type { RecurrenceRule } from '@/components/post/recurrence-field';

export function generateRecurringDates(startDate: Date, rule: RecurrenceRule): Date[] {
  if (rule.type === 'none') return [startDate];

  const dates: Date[] = [new Date(startDate)];

  if (rule.endCondition === 'specific_date' && rule.endDate) {
    const endDate = new Date(rule.endDate);
    let current = new Date(startDate);
    while (true) {
      current = nextDate(current, rule.type);
      if (current > endDate) break;
      dates.push(new Date(current));
    }
    return dates;
  }

  if (rule.endCondition === 'occurrences') {
    const count = rule.occurrences ?? 4;
    let current = new Date(startDate);
    for (let i = 1; i < count; i++) {
      current = nextDate(current, rule.type);
      dates.push(new Date(current));
    }
    return dates;
  }

  const endDate = getEndDate(startDate, rule.endCondition);
  let current = new Date(startDate);

  while (true) {
    current = nextDate(current, rule.type);
    if (current > endDate) break;
    dates.push(new Date(current));
  }

  return dates;
}

function nextDate(from: Date, type: 'weekly' | 'monthly'): Date {
  const next = new Date(from);
  if (type === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function getEndDate(startDate: Date, condition: string): Date {
  const d = new Date(startDate);
  if (condition === 'end_of_month') {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  }
  // end_of_quarter
  const quarter = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
}
