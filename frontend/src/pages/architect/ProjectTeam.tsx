import { useEffect, useState, FormEvent } from "react";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { VENDOR_CATEGORIES, TEAM_CATEGORIES } from "../../lib/categories";
import { Card, StatusBadge, CategoryBadge, SectionHeading } from "../../components/ui";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
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

function MemberCard({ member, projectId, onChanged }: { member: TeamMember; projectId: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(member.full_name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [category, setCategory] = useState(member.category ?? "Others");
  const [trade, setTrade] = useState(member.trade ?? "");
  const [saving, setSaving] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; temp_password: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${projectId}/members/${member.id}`, {
        full_name: fullName, phone, category, trade: trade || null,
      });
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!confirm(`Generate a new password for ${member.full_name}? Their old password will stop working.`)) return;
    setResetting(true);
    try {
      const res = await api.post(`/projects/${projectId}/members/${member.id}/reset-password`);
      setResetResult(res.data);
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card>
      {!editing ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">{member.full_name}</p>
            <p className="text-xs text-ink/50">{member.email}</p>
            {member.phone && <p className="text-xs text-ink/50">{member.phone}</p>}
            {member.trade && <p className="font-mono text-xs text-amber-dark mt-1">{member.trade}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-line uppercase">{member.role}</span>
            <StatusBadge status={member.status} />
            <button onClick={() => setEditing(true)} className="text-xs font-mono text-blueprint hover:text-amber-dark uppercase">
              Edit
            </button>
            <button onClick={resetPassword} disabled={resetting} className="text-xs font-mono text-site-rust hover:text-site-rust/70 uppercase">
              {resetting ? "…" : "Reset pw"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name"
            className="px-2.5 py-1.5 rounded-md border border-line/30 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number"
            className="px-2.5 py-1.5 rounded-md border border-line/30 text-sm" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-line/30 text-sm">
            {TEAM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade detail"
            className="px-2.5 py-1.5 rounded-md border border-line/30 text-sm" />
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-blueprint hover:bg-blueprint-light text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink/50 px-3 py-1.5">
              Cancel
            </button>
          </div>
        </form>
      )}

      {resetResult && (
        <div className="mt-3 pt-3 border-t border-line/10">
          <p className="text-xs text-ink mb-1">New password for {resetResult.email} — share securely, shown once:</p>
          <p className="font-mono text-sm bg-paper rounded px-2 py-1 inline-block">{resetResult.temp_password}</p>
          <button onClick={() => setResetResult(null)} className="block mt-1 text-[11px] font-mono text-line uppercase hover:text-ink">
            Dismiss
          </button>
        </div>
      )}
    </Card>
  );
}

export default function ProjectTeam() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "vendor", trade: "", category: "Structural" });
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
        phone: form.phone || null,
        role: form.role,
        trade: form.role === "vendor" ? form.trade || null : null,
        category: form.role === "vendor" ? form.category : null,
      };
      const res = await api.post<AddMemberResult>(`/projects/${activeProjectId}/members`, payload);
      setLastAdded(res.data);
      setForm({ full_name: "", email: "", phone: "", role: "vendor", trade: "", category: "Structural" });
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
              <label className="block text-xs font-mono text-line uppercase mb-1">Phone number</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
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
            <div className="mb-2"><CategoryBadge category={cat} /></div>
            <div className="space-y-2">
              {grouped[cat].map((m) => (
                <MemberCard key={m.id} member={m} projectId={activeProjectId} onChanged={load} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
