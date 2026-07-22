import { useEffect, useState, FormEvent } from "react";
import { api } from "../lib/api";
import { useActiveProject } from "../lib/activeProject";
import { useAuth } from "../lib/auth";
import { Card, SectionHeading } from "../components/ui";

interface Photo {
  id: string;
  room_or_area: string;
  caption: string | null;
  signed_url: string;
  uploaded_by_name: string | null;
  created_at: string;
}

interface DailyUpdate {
  id: string;
  update_date: string;
  done_today: string | null;
  pending: string | null;
  posted_by_name: string | null;
  created_at: string;
}

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/api$/, "");
const CAN_POST_ROLES = ["owner", "architect_admin", "architect_staff", "vendor", "onboarding"];

export default function ProjectProgress() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const { role } = useAuth();
  const canPost = role ? CAN_POST_ROLES.includes(role) : false;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [room, setRoom] = useState("");
  const [caption, setCaption] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateDate, setUpdateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [doneToday, setDoneToday] = useState("");
  const [pending, setPending] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);

  function load() {
    if (!activeProjectId) return;
    setLoading(true);
    Promise.all([
      api.get<Photo[]>(`/projects/${activeProjectId}/photos`),
      api.get<DailyUpdate[]>(`/projects/${activeProjectId}/updates`),
    ])
      .then(([photosRes, updatesRes]) => {
        setPhotos(photosRes.data);
        setUpdates(updatesRes.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [activeProjectId]);

  async function handlePhotoUpload(e: FormEvent) {
    e.preventDefault();
    if (!activeProjectId || !photoFile) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("room_or_area", room);
      formData.append("caption", caption);
      formData.append("photo", photoFile);
      await api.post(`/projects/${activeProjectId}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRoom(""); setCaption(""); setPhotoFile(null); setShowPhotoForm(false);
      load();
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePostUpdate(e: FormEvent) {
    e.preventDefault();
    if (!activeProjectId) return;
    setPostingUpdate(true);
    try {
      await api.post(`/projects/${activeProjectId}/updates`, {
        update_date: updateDate, done_today: doneToday || null, pending: pending || null,
      });
      setDoneToday(""); setPending(""); setShowUpdateForm(false);
      load();
    } finally {
      setPostingUpdate(false);
    }
  }

  if (!activeProjectId) {
    return <p className="text-ink/60 text-sm">Select a project from Overview first.</p>;
  }

  // Group photos by room/area for a scannable gallery
  const grouped = new Map<string, Photo[]>();
  for (const p of photos) {
    if (!grouped.has(p.room_or_area)) grouped.set(p.room_or_area, []);
    grouped.get(p.room_or_area)!.push(p);
  }

  return (
    <div>
      <SectionHeading eyebrow={`PRG · ${activeProjectName ?? ""}`} title="Site progress" />
      <p className="text-ink/60 text-sm mb-6">
        Photos and daily updates from the site, organized by room so everyone can see what's happening
        without needing to visit in person.
      </p>

      {canPost && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setShowPhotoForm((v) => !v)}
            className="btn-glow bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showPhotoForm ? "Cancel" : "+ Upload photo"}
          </button>
          <button
            onClick={() => setShowUpdateForm((v) => !v)}
            className="bg-white border border-line/30 hover:border-blueprint text-ink text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showUpdateForm ? "Cancel" : "+ Post daily update"}
          </button>
        </div>
      )}

      {showPhotoForm && (
        <Card className="mb-6">
          <form onSubmit={handlePhotoUpload} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Room / area</label>
              <input required value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Master bedroom"
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber" />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Caption (optional)</label>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Flooring complete"
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber" />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Photo</label>
              <input required type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
            </div>
            <div className="md:col-span-3">
              <button type="submit" disabled={uploadingPhoto}
                className="bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
                {uploadingPhoto ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {showUpdateForm && (
        <Card className="mb-6">
          <form onSubmit={handlePostUpdate} className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Date</label>
              <input required type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber" />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">What got done today</label>
              <textarea value={doneToday} onChange={(e) => setDoneToday(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber" />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">What's still pending</label>
              <textarea value={pending} onChange={(e) => setPending(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber" />
            </div>
            <button type="submit" disabled={postingUpdate}
              className="bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
              {postingUpdate ? "Posting…" : "Post update"}
            </button>
          </form>
        </Card>
      )}

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && (
        <>
          <p className="font-mono text-xs text-line uppercase tracking-wide mb-3">Daily updates</p>
          {updates.length === 0 && <p className="text-ink/50 text-sm mb-6">No updates posted yet.</p>}
          <div className="space-y-3 mb-8">
            {updates.map((u) => (
              <Card key={u.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-amber-dark">{u.update_date}</span>
                  {u.posted_by_name && <span className="text-xs text-ink/40">{u.posted_by_name}</span>}
                </div>
                {u.done_today && <p className="text-sm text-ink mb-1"><span className="font-medium">Done:</span> {u.done_today}</p>}
                {u.pending && <p className="text-sm text-ink/70"><span className="font-medium">Pending:</span> {u.pending}</p>}
              </Card>
            ))}
          </div>

          <p className="font-mono text-xs text-line uppercase tracking-wide mb-3">Photos by room</p>
          {photos.length === 0 && <p className="text-ink/50 text-sm">No photos uploaded yet.</p>}
          {Array.from(grouped.entries()).map(([roomName, roomPhotos]) => (
            <div key={roomName} className="mb-6">
              <p className="text-sm font-semibold text-ink mb-2">{roomName}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {roomPhotos.map((p) => (
                  <a
                    key={p.id}
                    href={p.signed_url.startsWith("http") ? p.signed_url : `${API_ORIGIN}${p.signed_url}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block card-hover rounded-lg overflow-hidden border border-line/15 bg-white"
                  >
                    <img
                      src={p.signed_url.startsWith("http") ? p.signed_url : `${API_ORIGIN}${p.signed_url}`}
                      alt={p.caption ?? roomName}
                      className="w-full h-28 object-cover"
                    />
                    {p.caption && <p className="text-xs text-ink/60 p-2 truncate">{p.caption}</p>}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
