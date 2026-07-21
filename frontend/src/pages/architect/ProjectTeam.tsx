import { useEffect, useState, FormEvent } from "react";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { VENDOR_CATEGORIES } from "../../lib/categories";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  trade: string | null;
  category: string | null;
  status: string;
}

interface AddMemberResult {
  email: string;
  full_name: string;
  role: string;
  temp_password: string | null;
  note: string;
}

export default function ProjectTeam() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", role: "vendor", trade: "", category: "Structural" });
  const [saving, setSaving] = useState(false);
  const [lastAdded, setLastAdded] = useState<AddMemberResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!activeProjectId) return;
    api
      .get<TeamMember[]>(`/projects/${activeProjectId}/members`)
      .then((res) => setMembers(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [activeProjectId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!activeProjectId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        trade: form.role === "vendor" ? form.trade || null : null,
        category: form.role === "vendor" ? form.category : null, // client/onboarding get sensible defaults server-side
      };
      const res = await api.post<AddMemberResult>(`/projects/${activeProjectId}/members`, payload);
      setLastAdded(res.data);
      setForm({ full_name: "", email: "", role: "vendor", trade: "", category: "Structural" });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Couldn't add this person. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!activeProjectId) {
    return <p className="text-ink/60 text-sm">Select a project from Overview first.</p>;
  }

  // Group members by category for display, in a fixed sensible order
  const categoryOrder = ["Architect", "Client", "Structural", "Electrical", "Plumbing", "A/C", "Others"];
  const grouped: Record<string, TeamMember[]> = {};
  for (const m of members) {
    const key = m.category ?? "Others";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  return (
    <div>
      <SectionHeading eyebrow={`TEAM · ${activeProjectName ?? ""}`} title="Project team" />
      <p className="text-ink/60 text-sm mb-6">
        Everyone enrolled in this project, grouped by category. Categories also control which CAD files each person can see.
      </p>

      {lastAdded && (
        <Card className="mb-6 border-amber/40">
          <p className="font-mono text-xs text-amber-dark uppercase tracking-wide mb-2">
            {lastAdded.full_name} added as {lastAdded.role}
          </p>
          {lastAdded.temp_password ? (
            <>
              <p className="text-sm text-ink mb-2">
                Share these login details with them — shown once, won't be shown again:
              </p>
              <div className="bg-paper rounded-md p-3 font-mono text-sm space-y-1">
                <p>Email: <span className="text-ink font-medium">{lastAdded.email}</span></p>
                <p>Password: <span className="text-ink font-medium">{lastAdded.temp_password}</span></p>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink/70">{lastAdded.note}</p>
          )}
          <button onClick={() => setLastAdded(null)} className="mt-3 text-xs font-mono text-line uppercase hover:text-ink">
            Dismiss
          </button>
        </Card>
      )}

      <button
        onClick={() => setShowForm((v) => !v)}
        className="mb-6 bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
      >
        {showForm ? "Cancel" : "+ Add team member"}
      </button>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Full name</label>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              >
                <option value="vendor">Vendor</option>
                <option value="client">Client</option>
                <option value="onboarding">Onboarding (site staff, inspector, etc.)</option>
              </select>
            </div>
            {form.role === "vendor" && (
              <div>
                <label className="block text-xs font-mono text-line uppercase mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
                >
                  {VENDOR_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            {form.role === "vendor" && (
              <div>
                <label className="block text-xs font-mono text-line uppercase mb-1">Trade detail (optional)</label>
                <input
                  value={form.trade}
                  onChange={(e) => setForm({ ...form, trade: e.target.value })}
                  placeholder="e.g. HVAC subcontractor"
                  className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
                />
              </div>
            )}
            <div className="md:col-span-2">
              {error && <p className="text-site-rust text-sm mb-2">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add to project"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && members.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">Only you are on this project so far.</p>
        </Card>
      )}

      {categoryOrder
        .filter((cat) => grouped[cat]?.length)
        .map((cat) => (
          <div key={cat} className="mb-6">
            <p className="font-mono text-xs text-line uppercase tracking-wide mb-2">{cat}</p>
            <div className="space-y-2">
              {grouped[cat].map((m) => (
                <Card key={m.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{m.full_name}</p>
                    <p className="text-xs text-ink/50">{m.email}</p>
                    {m.trade && <p className="font-mono text-xs text-amber-dark mt-1">{m.trade}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-line uppercase">{m.role}</span>
                    <StatusBadge status={m.status} />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
