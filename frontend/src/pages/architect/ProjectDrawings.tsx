import { useEffect, useState, FormEvent } from "react";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { Card, SectionHeading } from "../../components/ui";

interface Drawing {
  id: string;
  drawing_number: string;
  title: string;
  discipline: string | null;
  created_at: string;
}

export default function ProjectDrawings() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ drawing_number: "", title: "", discipline: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    if (!activeProjectId) return;
    setLoading(true);
    api
      .get<Drawing[]>(`/projects/${activeProjectId}/drawings`)
      .then((res) => setDrawings(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [activeProjectId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!activeProjectId) return;
    setSaving(true);
    try {
      await api.post("/drawings", { project_id: activeProjectId, ...form });
      setForm({ drawing_number: "", title: "", discipline: "" });
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!activeProjectId) {
    return <p className="text-ink/60 text-sm">Select a project from Overview first.</p>;
  }

  return (
    <div>
      <SectionHeading eyebrow={`DWG · ${activeProjectName ?? ""}`} title="Drawings" />

      <button
        onClick={() => setShowForm((v) => !v)}
        className="mb-6 bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
      >
        {showForm ? "Cancel" : "+ Register new drawing"}
      </button>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Drawing number</label>
              <input
                required
                value={form.drawing_number}
                onChange={(e) => setForm({ ...form, drawing_number: e.target.value })}
                placeholder="A-101"
                className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ground Floor Plan"
                className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Discipline</label>
              <input
                value={form.discipline}
                onChange={(e) => setForm({ ...form, discipline: e.target.value })}
                placeholder="architectural / MEP / structural"
                className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save drawing"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && drawings.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">No drawings registered yet for this project.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {drawings.map((d) => (
          <Card key={d.id}>
            <p className="font-mono text-xs text-amber-dark mb-1">{d.drawing_number}</p>
            <h3 className="font-display font-semibold text-ink">{d.title}</h3>
            {d.discipline && <p className="text-ink/50 text-xs mt-1">{d.discipline}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
