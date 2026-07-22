import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { CategoryBadge, SectionHeading, Card } from "../../components/ui";

interface VendorProjectRef {
  project_id: string;
  project_name: string;
}

interface VendorEntry {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  categories: string[];
  trades: string[];
  projects: VendorProjectRef[];
}

export default function VendorDirectory() {
  const [vendors, setVendors] = useState<VendorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    api.get<VendorEntry[]>("/vendors").then((res) => setVendors(res.data)).finally(() => setLoading(false));
  }, []);

  const allCategories = Array.from(new Set(vendors.flatMap((v) => v.categories))).sort();

  const filtered = vendors.filter((v) => {
    const matchesSearch =
      !search ||
      v.full_name.toLowerCase().includes(search.toLowerCase()) ||
      v.trades.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !categoryFilter || v.categories.includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <SectionHeading eyebrow="VENDORS · All projects" title="Vendor directory" />
      <p className="text-ink/60 text-sm mb-6">
        Every vendor you've worked with across all your projects, in one place — for quick reuse when a new
        project needs the same trade.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or trade…"
          className="px-3.5 py-2 rounded-lg border border-line/30 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-amber"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
              !categoryFilter ? "bg-blueprint text-white border-blueprint" : "bg-white text-ink/70 border-line/30"
            }`}
          >
            All
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                categoryFilter === cat ? "bg-blueprint text-white border-blueprint" : "bg-white text-ink/70 border-line/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">
            {vendors.length === 0
              ? "No vendors added to any project yet. They'll show up here automatically once you add them via a project's Team page."
              : "No vendors match your search."}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((v, i) => (
          <Card key={v.user_id} delay={i * 40}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-display font-semibold text-ink">{v.full_name}</p>
                <p className="text-xs text-ink/50">{v.email}</p>
                {v.phone && <p className="text-xs text-ink/50">{v.phone}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {v.categories.map((c) => <CategoryBadge key={c} category={c} />)}
            </div>
            {v.trades.length > 0 && (
              <p className="text-xs text-ink/50 mb-2">{v.trades.join(", ")}</p>
            )}
            <div className="pt-2 border-t border-line/10">
              <p className="font-mono text-[11px] text-line uppercase mb-1">
                Worked on {v.projects.length} project{v.projects.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-ink/60">{v.projects.map((p) => p.project_name).join(", ")}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
