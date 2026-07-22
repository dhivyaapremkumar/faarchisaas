import { useEffect, useState, FormEvent } from "react";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  assigned_to: string | null;
  assignee_name: string | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

export default function ProjectTasks() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!activeProjectId) return;
    setLoading(true);
    Promise.all([
      api.get<Task[]>(`/projects/${activeProjectId}/tasks`),
      api.get<TeamMember[]>(`/projects/${activeProjectId}/members`),
    ])
      .then(([tasksRes, membersRes]) => {
        setTasks(tasksRes.data);
        setMembers(membersRes.data.filter((m) => m.role !== "client"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [activeProjectId]);

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!activeProjectId || !assignedTo) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/projects/${activeProjectId}/tasks`, {
        title, description: description || null, assigned_to: assignedTo, due_date: dueDate || null,
      });
      setTitle(""); setDescription(""); setAssignedTo(""); setDueDate(""); setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Couldn't assign the task.");
    } finally {
      setSaving(false);
    }
  }

  if (!activeProjectId) {
    return <p className="text-ink/60 text-sm">Select a project from Overview first.</p>;
  }

  return (
    <div>
      <SectionHeading eyebrow={`TASKS · ${activeProjectName ?? ""}`} title="Tasks" />
      <p className="text-ink/60 text-sm mb-6">
        Every task on this project — from site meeting minutes and directly assigned. Direct assignment
        doesn't require recording a meeting.
      </p>

      <button
        onClick={() => setShowForm((v) => !v)}
        className="btn-glow mb-6 bg-amber-gradient text-white text-sm font-semibold px-4 py-2 rounded-lg"
      >
        {showForm ? "Cancel" : "+ Assign task"}
      </button>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-line uppercase mb-1">Task</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Complete plumbing rough-in, 2nd floor"
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-line uppercase mb-1">Description (optional)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber" />
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Assign to</label>
              <select required value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber">
                <option value="">Select a team member…</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.full_name} ({m.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-line uppercase mb-1">Due date (optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber" />
            </div>
            <div className="md:col-span-2">
              {error && <p className="text-site-rust text-sm mb-2">{error}</p>}
              <button type="submit" disabled={saving}
                className="bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
                {saving ? "Assigning…" : "Assign task"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && tasks.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">No tasks yet on this project.</p>
        </Card>
      )}

      <div className="space-y-3">
        {tasks.map((task, i) => (
          <Card key={task.id} delay={i * 40} className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink font-medium mb-1">{task.title}</p>
              <div className="flex items-center gap-2 font-mono text-xs text-line">
                {task.assignee_name && <span>{task.assignee_name}</span>}
                {task.due_date && <span>· Due {task.due_date}</span>}
              </div>
            </div>
            <StatusBadge status={task.status} />
          </Card>
        ))}
      </div>
    </div>
  );
}
