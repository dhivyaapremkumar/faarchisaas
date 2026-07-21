import { useEffect, useState, FormEvent } from "react";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { TEAM_CATEGORIES } from "../../lib/categories";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface ProjectFile {
  drawing_id: string;
  drawing_number: string;
  drawing_title: string;
  discipline: string | null;
  revision_id: string;
  revision_label: string;
  status: string;
  signed_url: string;
  shared_categories: string[];
  created_at: string;
}

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/api$/, "");

function FileActions({ file, onChanged }: { file: ProjectFile; onChanged: () => void }) {
  const [showShare, setShowShare] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(file.shared_categories);
  const [savingShare, setSavingShare] = useState(false);

  const [showEmail, setShowEmail] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  async function saveShare() {
    setSavingShare(true);
    try {
      await api.post(`/drawings/${file.drawing_id}/revisions/${file.revision_id}/share`, {
        categories: selectedCategories,
        user_ids: [],
      });
      setShowShare(false);
      onChanged();
    } finally {
      setSavingShare(false);
    }
  }

  async function sendEmail(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setEmailResult(null);
    try {
      await api.post(`/drawings/${file.drawing_id}/revisions/${file.revision_id}/email`, {
        recipient_email: recipientEmail,
        message: emailMessage || null,
      });
      setEmailResult(`Sent to ${recipientEmail}.`);
      setRecipientEmail("");
      setEmailMessage("");
    } catch (err: any) {
      setEmailResult(err?.response?.data?.detail ?? "Couldn't send — check that EMAIL_API_KEY is configured.");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${file.revision_label}" permanently? This can't be undone.`)) return;
    await api.delete(`/drawings/${file.drawing_id}/revisions/${file.revision_id}`);
    onChanged();
  }

  return (
    <div className="border-b border-line/10 last:border-b-0 py-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink font-medium">{file.revision_label}</span>
          <StatusBadge status={file.status} />
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <a
            href={file.signed_url.startsWith("http") ? file.signed_url : `${API_ORIGIN}${file.signed_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blueprint hover:text-amber-dark underline"
          >
            View →
          </a>
          <span className="text-line/30">|</span>
          <button onClick={() => setShowShare((v) => !v)} className="text-blueprint hover:text-amber-dark uppercase">
            Share
          </button>
          <span className="text-line/30">|</span>
          <button onClick={() => setShowEmail((v) => !v)} className="text-blueprint hover:text-amber-dark uppercase">
            Email
          </button>
          <span className="text-line/30">|</span>
          <button onClick={handleDelete} className="text-site-rust hover:text-site-rust/70 uppercase">
            Delete
          </button>
        </div>
      </div>

      {file.shared_categories.length > 0 && (
        <p className="text-[11px] text-ink/40 mt-1">Shared with: {file.shared_categories.join(", ")}</p>
      )}

      {showShare && (
        <div className="mt-2 pt-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TEAM_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedCategories.includes(cat)
                    ? "bg-blueprint text-white border-blueprint"
                    : "bg-white text-ink/70 border-line/30 hover:border-blueprint"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={saveShare}
            disabled={savingShare}
            className="bg-blueprint hover:bg-blueprint-light text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
          >
            {savingShare ? "Saving…" : "Save sharing"}
          </button>
        </div>
      )}

      {showEmail && (
        <form onSubmit={sendEmail} className="mt-2 pt-2 space-y-2">
          <input
            required
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full px-2.5 py-1.5 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
          />
          <textarea
            value={emailMessage}
            onChange={(e) => setEmailMessage(e.target.value)}
            placeholder="Optional message"
            rows={2}
            className="w-full px-2.5 py-1.5 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-blueprint hover:bg-blueprint-light text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send email"}
          </button>
          {emailResult && <p className="text-xs text-ink/70 mt-1">{emailResult}</p>}
        </form>
      )}
    </div>
  );
}

export default function ProjectFiles() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!activeProjectId) return;
    setLoading(true);
    api
      .get<ProjectFile[]>(`/projects/${activeProjectId}/files`)
      .then((res) => setFiles(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [activeProjectId]);

  if (!activeProjectId) {
    return <p className="text-ink/60 text-sm">Select a project from Overview first.</p>;
  }

  // Group files by drawing, same organizing principle as the Drawings page,
  // so all revisions of A-101 sit together instead of scattered across the list.
  const grouped = new Map<string, { number: string; title: string; discipline: string | null; files: ProjectFile[] }>();
  for (const f of files) {
    if (!grouped.has(f.drawing_id)) {
      grouped.set(f.drawing_id, { number: f.drawing_number, title: f.drawing_title, discipline: f.discipline, files: [] });
    }
    grouped.get(f.drawing_id)!.files.push(f);
  }
  const groups = Array.from(grouped.values()).sort((a, b) => a.number.localeCompare(b.number));

  return (
    <div>
      <SectionHeading eyebrow={`FILES · ${activeProjectName ?? ""}`} title="CAD files" />
      <p className="text-ink/60 text-sm mb-6">
        Every uploaded file, grouped by drawing. Use Share to control which categories can see a file, or Email to
        send a secure link to anyone.
      </p>

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && groups.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">No files uploaded yet. Upload drawings from the Drawings page.</p>
        </Card>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <Card key={group.number}>
            <div className="mb-1">
              <p className="font-mono text-xs text-amber-dark mb-1">{group.number}</p>
              <h3 className="font-display font-semibold text-ink">{group.title}</h3>
              {group.discipline && <p className="text-ink/50 text-xs mt-0.5">{group.discipline}</p>}
            </div>
            <div className="mt-2">
              {group.files.map((f) => (
                <FileActions key={f.revision_id} file={f} onChanged={load} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
