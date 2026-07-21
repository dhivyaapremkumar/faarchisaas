import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface MeetingListItem {
  id: string;
  meeting_date: string;
  mom_status: string;
}

export default function ProjectMeetings() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function load() {
    if (!activeProjectId) return;
    setLoading(true);
    api
      .get<MeetingListItem[]>(`/projects/${activeProjectId}/meetings`)
      .then((res) => setMeetings(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [activeProjectId]);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!activeProjectId || !audioFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("project_id", activeProjectId);
      formData.append("meeting_date", new Date(meetingDate).toISOString());
      formData.append("audio", audioFile);
      await api.post("/meetings", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setShowForm(false);
      setAudioFile(null);
      setMeetingDate("");
      load();
    } finally {
      setUploading(false);
    }
  }

  if (!activeProjectId) {
    return <p className="text-ink/60 text-sm">Select a project from Overview first.</p>;
  }

  return (
    <div>
      <SectionHeading eyebrow={`MOM · ${activeProjectName ?? ""}`} title="Site meetings" />

      <button
        onClick={() => setShowForm((v) => !v)}
        className="mb-6 bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
      >
        {showForm ? "Cancel" : "+ Record new meeting"}
      </button>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Meeting date & time</label>
              <input
                type="datetime-local"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Audio recording</label>
              <input
                type="file"
                required
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
              <p className="text-ink/50 text-xs mt-1">
                Transcription and MOM drafting starts automatically after upload — usually 30s to 2 minutes.
              </p>
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload & start processing"}
            </button>
          </form>
        </Card>
      )}

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && meetings.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">No meetings recorded yet for this project.</p>
        </Card>
      )}

      <div className="space-y-3">
        {meetings.map((m) => (
          <Link key={m.id} to={`/meetings/${m.id}`}>
            <Card className="flex items-center justify-between hover:border-amber/50 transition-colors">
              <span className="font-mono text-sm text-ink">{new Date(m.meeting_date).toLocaleString()}</span>
              <StatusBadge status={m.mom_status} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
