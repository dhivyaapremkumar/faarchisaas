import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useActiveProject } from "../../lib/activeProject";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  trade: string | null;
  status: string;
}

export default function ProjectTeam() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProjectId) return;
    api
      .get<TeamMember[]>(`/projects/${activeProjectId}/members`)
      .then((res) => setMembers(res.data))
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  if (!activeProjectId) {
    return <p className="text-ink/60 text-sm">Select a project from Overview first.</p>;
  }

  return (
    <div>
      <SectionHeading eyebrow={`TEAM · ${activeProjectName ?? ""}`} title="Project team" />
      <p className="text-ink/60 text-sm mb-6">
        Everyone enrolled in this project — architects, vendors, clients, and onboarding staff.
        Invite flow for adding new people is coming soon.
      </p>

      {loading && <p className="text-line text-sm">Loading…</p>}

      {!loading && members.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">Only you are on this project so far.</p>
        </Card>
      )}

      <div className="space-y-3">
        {members.map((m) => (
          <Card key={m.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{m.full_name}</p>
              <p className="text-xs text-ink/50">{m.email}</p>
              {m.trade && <p className="font-mono text-xs text-amber-dark mt-1">{m.trade}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-line uppercase">{m.role}</span>
              <StatusBadge status={m.status} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
