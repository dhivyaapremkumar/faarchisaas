import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { SectionHeading, Card, StatusBadge } from "../../components/ui";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  project_name: string | null;
}

const STATUS_FLOW: Record<string, string> = { open: "in_progress", in_progress: "done", done: "open" };

export default function VendorDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  function load() {
    api.get<Task[]>("/tasks/mine").then((res) => setTasks(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function advanceStatus(task: Task) {
    setUpdating(task.id);
    try {
      await api.patch(`/tasks/${task.id}`, { status: STATUS_FLOW[task.status] ?? "open" });
      load();
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <SectionHeading eyebrow="Tasks" title="Assigned to you" />
      <p className="text-ink/60 text-sm mb-6">
        Tasks created from site meeting minutes and direct assignments appear here. Click the status to move
        it forward (open → in progress → done).
      </p>

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && tasks.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">No tasks assigned to you yet.</p>
        </Card>
      )}

      <div className="space-y-3">
        {tasks.map((task, i) => (
          <Card key={task.id} delay={i * 40} className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink font-medium mb-1">{task.title}</p>
              {task.description && <p className="text-xs text-ink/50 mb-1">{task.description}</p>}
              <div className="flex items-center gap-2 font-mono text-xs text-line">
                {task.project_name && <span>{task.project_name}</span>}
                {task.due_date && <span>· Due {task.due_date}</span>}
              </div>
            </div>
            <button onClick={() => advanceStatus(task)} disabled={updating === task.id}>
              <StatusBadge status={task.status} />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
