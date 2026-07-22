import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface Project {
  id: string;
  name: string;
  status: string;
  address: string | null;
}

function ProjectCard({
  project,
  delay,
  onChanged,
  onSelect,
}: {
  project: Project;
  delay: number;
  onChanged: () => void;
  onSelect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address ?? "");
  const [status, setStatus] = useState(project.status);
  const [saving, setSaving] = useState(false);

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${project.id}`, { name, address: address || null, status });
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Card delay={delay} className="relative overflow-hidden pt-6">
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-gradient" />
        <form onSubmit={saveEdit} className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name"
            className="w-full px-2.5 py-1.5 rounded-md border border-line/30 text-sm" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address"
            className="w-full px-2.5 py-1.5 rounded-md border border-line/30 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-md border border-line/30 text-sm">
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-blueprint hover:bg-blueprint-light text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink/50 px-3 py-1.5">
              Cancel
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card delay={delay} className="relative overflow-hidden pt-6">
      <div className="absolute top-0 left-0 right-0 h-1 bg-amber-gradient" />
      <button onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-display font-semibold text-ink text-base">{project.name}</h3>
          <StatusBadge status={project.status} />
        </div>
        {project.address && <p className="text-ink/60 text-sm mb-4">{project.address}</p>}
      </button>
      <div className="flex items-center gap-4 pt-3 border-t border-line/10 text-xs font-mono text-line uppercase tracking-wide">
        <Link to="/drawings" onClick={onSelect} className="hover:text-amber-dark transition-colors">Drawings →</Link>
        <Link to="/meetings" onClick={onSelect} className="hover:text-amber-dark transition-colors">Meetings →</Link>
        <Link to="/team" onClick={onSelect} className="hover:text-amber-dark transition-colors">Team →</Link>
        <button onClick={() => setEditing(true)} className="ml-auto hover:text-amber-dark transition-colors">Edit</button>
      </div>
    </Card>
  );
}

export default function ArchitectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeProjectId, setActiveProject } = useActiveProject();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", status: "planning" });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function load() {
    api
      .get<Project[]>("/projects")
      .then((res) => {
        setProjects(res.data);
        if (!activeProjectId && res.data.length > 0) {
          setActiveProject(res.data[0].id, res.data[0].name);
        }
      })
      .catch(() => setError("Couldn't load projects. Check that the backend is running."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCreateError(null);
    try {
      const res = await api.post<Project>("/projects", form);
      setForm({ name: "", address: "", status: "planning" });
      setShowForm(false);
      setActiveProject(res.data.id, res.data.name);
      load();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail ?? "Couldn't create the project. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeading eyebrow="Overview" title="Your projects" />

      <button
        onClick={() => setShowForm((v) => !v)}
        className="btn-glow mb-6 bg-amber-gradient text-white text-sm font-semibold px-4 py-2 rounded-lg"
      >
        {showForm ? "Cancel" : "+ New project"}
      </button>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Project name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Kumar Residence"
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Address (optional)</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="12 Anna Nagar, Chennai"
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="md:col-span-3">
              {createError && <p className="text-site-rust text-sm mb-2">{createError}</p>}
              <button
                type="submit"
                disabled={saving}
                className="bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading && <p className="text-line text-sm">Loading projects…</p>}
      {error && <p className="text-site-rust text-sm">{error}</p>}

      {!loading && !error && projects.length === 0 && !showForm && (
        <Card className="text-center py-12">
          <p className="font-mono text-xs text-line uppercase tracking-wide mb-2">No projects yet</p>
          <p className="text-ink/70 text-sm">
            Create your first project to start adding drawings, inviting your team, and recording site meetings.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project, i) => (
          <ProjectCard
            key={project.id}
            project={project}
            delay={i * 60}
            onChanged={load}
            onSelect={() => setActiveProject(project.id, project.name)}
          />
        ))}
      </div>
    </div>
  );
}
