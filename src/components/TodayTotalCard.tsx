import { formatDuration } from "../lib/time";
import { formatCurrency } from "../lib/currency";

type TodayTotalCardProps = {
  totalSeconds: number;
  totalAmount: number;
};

export function TodayTotalCard({
  totalSeconds,
  totalAmount,
}: TodayTotalCardProps) {
  return (
    <div className="total-duration">
      <span className="total-duration__label">Total Today</span>
      <span className="total-duration__value">
        {formatDuration(totalSeconds)}
      </span>
      <span className="total-duration__amount">
        {formatCurrency(totalAmount)}
      </span>
    </div>
  );
}
