import SegmentedControl from "@/components/ui/segmented-control";

export type ActivityView = "created" | "joined";

type ActivitySegmentedControlProps = {
  value: ActivityView;
  onChange: (value: ActivityView) => void;
};

const OPTIONS: { label: string; value: ActivityView }[] = [
  { label: "Hosted", value: "created" },
  { label: "RSVP'd", value: "joined" },
];

export default function ActivitySegmentedControl({
  value,
  onChange,
}: ActivitySegmentedControlProps) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} />;
}
