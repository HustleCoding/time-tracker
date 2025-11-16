import { formatDuration } from "../lib/time";

type TodayTotalCardProps = {
  totalSeconds: number;
};

export function TodayTotalCard({ totalSeconds }: TodayTotalCardProps) {
  return (
    <div className="total-duration">
      <span className="total-duration__label">Total Today</span>
      <span className="total-duration__value">
        {formatDuration(totalSeconds)}
      </span>
    </div>
  );
}
