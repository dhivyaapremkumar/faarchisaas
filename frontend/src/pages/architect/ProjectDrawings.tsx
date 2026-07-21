import { useEffect, useState, FormEvent } from "react";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface Drawing {
  id: string;
  drawing_number: string;
  title: string;
  discipline: string | null;
  created_at: string;
  latest_revision_label: string | null;
  latest_revision_status: string | null;
  revision_count: number;
}

interface Revision {
  id: string;
  revision_label: string;
  status: string;
  changelog: string | null;
  signed_url: string;
  created_at: string;
}

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/api$/, "");

function DrawingCard({ drawing, onChanged }: { drawing: Drawing; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [revisionLabel, setRevisionLabel] = useState("");
  const [status, setStatus] = useState("issued_for_review");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const isFirstUpload = drawing.revision_count === 0;

  function loadRevisions() {
    setLoadingRevisions(true);
    api
      .get<Revision[]>(`/drawings/${drawing.id}/revisions`)
      .then((res) => setRevisions(res.data))
      .finally(() => setLoadingRevisions(false));
  }

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next) loadRevisions();
  }

  function openUploadForm() {
    setRevisionLabel(isFirstUpload ? "Original" : "");
    setShowUploadForm(true);
    if (!expanded) setExpanded(true);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("revision_label", revisionLabel);
      formData.append("status", status);
      formData.append("changelog", "");
      formData.append("file", file);
      await api.post(`/drawings/${drawing.id}/revisions`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRevisionLabel("");
      setFile(null);
      setShowUploadForm(false);
      loadRevisions();
      onChanged(); // refresh the parent list so the "latest revision" summary updates
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <button onClick={handleExpand} className="w-full text-left">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-amber-dark mb-1">{drawing.drawing_number}</p>
            <h3 className="font-display font-semibold text-ink">{drawing.title}</h3>
            {drawing.discipline && <p className="text-ink/50 text-xs mt-1">{drawing.discipline}</p>}
          </div>
        </div>

        {/* Latest revision summary - visible without expanding */}
        <div className="mt-3 pt-3 border-t border-line/10 flex items-center justify-between">
          {drawing.latest_revision_label ? (
            <span className="font-mono text-xs text-ink/70">
              Latest: <span className="text-ink font-medium">{drawing.latest_revision_label}</span>
            </span>
          ) : (
            <span className="font-mono text-xs text-site-rust">No file uploaded yet</span>
          )}
          {drawing.latest_revision_status && <StatusBadge status={drawing.latest_revision_status} />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-line/10">
          {loadingRevisions && <p className="text-line text-xs">Loading revision history…</p>}

          {!loadingRevisions && revisions.length > 0 && (
            <>
              <p className="font-mono text-[11px] text-line uppercase tracking-wide mb-2">Revision history</p>
              <div className="space-y-2 mb-3">
                {revisions.map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <a
                      href={r.signed_url.startsWith("http") ? r.signed_url : `${API_ORIGIN}${r.signed_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blueprint hover:text-amber-dark underline font-mono text-xs"
                    >
                      {r.revision_label} {i === 0 ? "(latest)" : ""} — view file →
                    </a>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </>
          )}

          {!showUploadForm && (
            <button
              onClick={openUploadForm}
              className="text-xs font-mono text-blueprint hover:text-amber-dark uppercase tracking-wide"
            >
              {isFirstUpload ? "+ Upload drawing (base version)" : "+ Upload new revision"}
            </button>
          )}

          {showUploadForm && (
            <form onSubmit={handleUpload} className="space-y-2 mt-2">
              <div>
                <label className="block text-[11px] font-mono text-line uppercase mb-1">
                  {isFirstUpload ? "Version label (e.g. \"Original\")" : "Revision label (e.g. \"Rev B\")"}
                </label>
                <input
                  required
                  value={revisionLabel}
                  onChange={(e) => setRevisionLabel(e.target.value)}
                  placeholder={isFirstUpload ? "Original" : "Rev B"}
                  className="w-full px-2.5 py-1.5 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-line uppercase mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
                >
                  <option value="draft">Draft</option>
                  <option value="issued_for_review">Issued for review</option>
                  <option value="issued_for_construction">Issued for construction (final/approved)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-line uppercase mb-1">File (PDF, DWG, or image)</label>
                <input
                  required
                  type="file"
                  accept=".pdf,.dwg,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-blueprint hover:bg-blueprint-light text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="text-xs text-ink/50 px-3 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </Card>
  );
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
    api
      .get<Drawing[]>(`/projects/${activeProjectId}/drawings`)
      .then((res) => setDrawings(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

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
      <p className="text-ink/60 text-sm mb-4">
        Register a drawing (its number, title, discipline), then click it to upload the base file. Later
        corrections upload as a new revision, keeping the full history and always showing the latest version.
      </p>

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
          <DrawingCard key={d.id} drawing={d} onChanged={load} />
        ))}
      </div>
    </div>
  );
}
