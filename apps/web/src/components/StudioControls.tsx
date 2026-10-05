import { Button } from "@lps/ui";
import * as api from "../api/client";
const STATUS_LABELS = {
  pending: "Queued",
  processing: "Exporting",
  ready: "Ready",
  failed: "Export failed",
  received: "Received",
  in_production: "In production",
  shipped: "Shipped",
};
export function Status({ value }: { value: keyof typeof STATUS_LABELS }) {
  return (
    <span className="lps-badge" data-status={value}>
      <span aria-hidden="true" />
      {STATUS_LABELS[value]}
    </span>
  );
}
export function Mark() {
  return (
    <svg
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
    >
      <path d="M5 4h14l4 4v16H5V4Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 9h10v11H9V9Z" stroke="currentColor" strokeDasharray="2 2" />
      <path d="m19 4 4 4h-4V4Z" fill="currentColor" />
    </svg>
  );
}
export function Pagination({
  offset,
  total,
  onChange,
}: {
  offset: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= 12) return null;
  return (
    <div className="lps-pagination">
      <Button
        variant="secondary"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - 12))}
      >
        Previous
      </Button>
      <span>
        {offset + 1}–{Math.min(offset + 12, total)} of {total}
      </span>
      <Button
        variant="secondary"
        disabled={offset + 12 >= total}
        onClick={() => onChange(offset + 12)}
      >
        Next
      </Button>
    </div>
  );
}
export const PatternDownloads = ({ pattern: p }: { pattern: api.PatternOut }) =>
  p.export_status === "ready" && (
    <div className="lps-downloads">
      <a
        href={api.patternSvgUrl(p.id)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Download SVG for ${p.name}`}
      >
        SVG ↗
      </a>
      <a
        href={api.patternPdfUrl(p.id)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Download PDF for ${p.name}`}
      >
        PDF ↗
      </a>
    </div>
  );
