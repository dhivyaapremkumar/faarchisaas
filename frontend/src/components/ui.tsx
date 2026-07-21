import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`drafting-corners bg-white rounded-lg border border-line/15 p-5 ${className}`}>{children}</div>
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
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}

export function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="font-mono text-xs tracking-widest text-line uppercase mb-1">{eyebrow}</p>
      <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
    </div>
  );
}
