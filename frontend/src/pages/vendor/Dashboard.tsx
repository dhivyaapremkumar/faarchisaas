import { SectionHeading, Card, StatusBadge } from "../../components/ui";

// NOTE: wire this to a real GET /api/tasks?assigned_to=me endpoint once built
// (not included in the Step 7 backend yet - the Task model exists, this is
// the natural next backend endpoint to add). Shown here with placeholder
// structure so the UI/UX is ready to connect.
const MOCK_TASKS = [
  { id: "1", title: "Complete plumbing rough-in, 2nd floor", due_date: "2026-07-25", status: "open" },
  { id: "2", title: "Submit material samples for bathroom fixtures", due_date: "2026-07-22", status: "in_progress" },
];

export default function VendorDashboard() {
  return (
    <div>
      <SectionHeading eyebrow="Tasks" title="Assigned to you" />
      <p className="text-ink/60 text-sm mb-6">
        Tasks created from site meeting minutes and direct assignments appear here.
      </p>

      <div className="space-y-3">
        {MOCK_TASKS.map((task) => (
          <Card key={task.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink font-medium mb-1">{task.title}</p>
              <p className="font-mono text-xs text-line">Due {task.due_date}</p>
            </div>
            <StatusBadge status={task.status} />
          </Card>
        ))}
      </div>
    </div>
  );
}
