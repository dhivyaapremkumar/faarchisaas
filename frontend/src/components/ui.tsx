import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  hover = true,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={`drafting-corners bg-white rounded-lg border border-line/15 p-5 animate-fade-up ${hover ? "card-hover" : ""} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-site-green/10 text-site-green",
  open: "bg-amber/15 text-amber-dark",
  in_progress: "bg-amber/15 text-amber-dark",
  done: "bg-site-green/10 text-site-green",
  overdue: "bg-site-rust/10 text-site-rust",
  // Drawing revision stages
  scheme: "bg-line/10 text-line",
  revisions: "bg-amber/15 text-amber-dark",
  working_drawings: "bg-blueprint/10 text-blueprint",
  issued_for_construction: "bg-site-green/10 text-site-green",
  superseded: "bg-line/10 text-line",
  // Legacy values, kept for any old data
  issued_for_review: "bg-amber/15 text-amber-dark",
  draft: "bg-line/10 text-line",
  pending_review: "bg-amber/15 text-amber-dark",
  published: "bg-site-green/10 text-site-green",
  processing: "bg-line/10 text-line",
  unassigned: "bg-site-rust/10 text-site-rust",
  assigned: "bg-amber/15 text-amber-dark",
  confirmed: "bg-site-green/10 text-site-green",
};

const STATUS_LABELS: Record<string, string> = {
  scheme: "Scheme",
  revisions: "Revisions",
  working_drawings: "Working Drawings",
  issued_for_construction: "Issued for Construction (Approved)",
  superseded: "Superseded",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-line/10 text-line";
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  const isLive = status === "processing";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wide ${style}`}>
      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse-dot" />}
      {label}
    </span>
  );
}

// Category -> color mapping. Each team/file category gets a distinct hue so
// the Team and CAD Files pages are scannable at a glance rather than
// everything looking the same.
const CATEGORY_STYLES: Record<string, string> = {
  Architect: "bg-cat-architect-bg text-cat-architect-text",
  Client: "bg-cat-client-bg text-cat-client-text",
  Structural: "bg-cat-structural-bg text-cat-structural-text",
  Electrical: "bg-cat-electrical-bg text-cat-electrical-text",
  Plumbing: "bg-cat-plumbing-bg text-cat-plumbing-text",
  "A/C": "bg-cat-ac-bg text-cat-ac-text",
  Others: "bg-cat-others-bg text-cat-others-text",
};

export function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? "bg-line/10 text-line";
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${style}`}>
      {category}
    </span>
  );
}

export function ProgressRing({ percent, size = 64 }: { percent: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EDEBE2" strokeWidth="8" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#4C7A5E"
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="14" fill="#1B2430">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

export function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6 animate-fade-up">
      <p className="font-mono text-xs tracking-widest text-line uppercase mb-1">{eyebrow}</p>
      <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
    </div>
  );
}
