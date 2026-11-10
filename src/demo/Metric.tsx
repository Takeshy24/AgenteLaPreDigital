import { ArrowUpRight } from 'lucide-react';
export function Metric({
  label,
  value,
  delta,
  icon,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="metric">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <span>{label}</span>
      <div className="metric-value">{value}</div>
      <small>{delta}</small>
      <span className="metric-arrow">
        <ArrowUpRight size={14} />
      </span>
    </div>
  );
}
