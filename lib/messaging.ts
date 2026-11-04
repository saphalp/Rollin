export type MessagePosition = { id: string; created_at: string };
export type ReadPosition = { user_id: string; last_read_at: string; last_read_message_id: string };
export type DeliveryPosition = { user_id: string; last_delivered_at: string; last_delivered_message_id: string };

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'seen';

export type MessageStatusInfo = {
  status: MessageDeliveryStatus;
  count: number;
  label: string;
};

// Keep PostgreSQL microseconds when timestamps fall within the same millisecond.
function micros(value: string) {
  const fraction = value.match(/\.(\d+)/)?.[1] ?? '';
  return Date.parse(value) * 1000 + Number(fraction.padEnd(6, '0').slice(3, 6));
}

export function compareMessagePosition(a: MessagePosition, b: MessagePosition) {
  return micros(a.created_at) - micros(b.created_at) || a.id.localeCompare(b.id);
}

export function mergeMessages<T extends MessagePosition>(previous: T[], incoming: T[]): T[] {
  return [...new Map([...previous, ...incoming].map(message => [message.id, message])).values()].sort(compareMessagePosition);
}

export function messageStatus(
  message: MessagePosition & { sender_id: string },
  userId: string,
  type: 'direct' | 'group',
  receipts: ReadPosition[] = [],
  deliveries: DeliveryPosition[] = [],
): MessageStatusInfo | undefined {
  if (message.sender_id !== userId) return undefined;

  const readers = new Set(
    receipts
      .filter(r => r.user_id !== userId && compareMessagePosition({ id: r.last_read_message_id, created_at: r.last_read_at }, message) >= 0)
      .map(r => r.user_id)
  ).size;

  if (readers > 0) {
    return {
      status: 'seen',
      count: readers,
      label: type === 'direct' ? 'Seen' : `Seen by ${readers}`,
    };
  }

  const delivered = new Set(
    deliveries
      .filter(d => d.user_id !== userId && compareMessagePosition({ id: d.last_delivered_message_id, created_at: d.last_delivered_at }, message) >= 0)
      .map(d => d.user_id)
  ).size;

  if (delivered > 0) {
    return {
      status: 'delivered',
      count: delivered,
      label: type === 'direct' ? 'Delivered' : `Delivered to ${delivered}`,
    };
  }

  return {
    status: 'sent',
    count: 0,
    label: 'Sent',
  };
}

export function messageReadLabel(
  message: MessagePosition & { sender_id: string },
  userId: string,
  type: 'direct' | 'group',
  receipts: ReadPosition[] = [],
  deliveries: DeliveryPosition[] = [],
): string | undefined {
  return messageStatus(message, userId, type, receipts, deliveries)?.label;
}

export function conversationPreview(content: string | null, type: string | null, group: boolean) {
  if (type === 'activity') return 'Shared an activity';
  if (type === 'post') return 'Shared a post';
  return content?.trim() || (group ? 'Say hello to the group!' : 'Say hello!');
}

export function conversationTime(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  const days = Math.floor(minutes / 1440);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Compare local calendar days, not UTC dates, so dividers change at the user's midnight.
export function messageDay(iso: string): string {
  return new Date(iso).toDateString();
}

export function formatMessageDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
