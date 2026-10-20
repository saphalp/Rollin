import SegmentedControl from '@/components/ui/segmented-control';
import type { ReviewKind } from '@/services/reviews-service';

export type ReviewFilterValue = 'all' | ReviewKind;

const OPTIONS: { label: string; value: ReviewFilterValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Rides', value: 'ride' },
  { label: 'Hosting', value: 'host' },
];

export function ReviewFilter({ value, onChange }: { value: ReviewFilterValue; onChange: (value: ReviewFilterValue) => void }) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} />;
}
