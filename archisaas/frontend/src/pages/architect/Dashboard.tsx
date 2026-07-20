import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface Project {
  id: string;
  name: string;
  status: string;
  address: string | null;
}

export default function ArchitectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Project[]>("/projects")
      .then((res) => setProjects(res.data))
      .catch(() => setError("Couldn't load projects. Check that the backend is running."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionHeading eyebrow="Overview" title="Your projects" />

      {loading && <p className="text-line text-sm">Loading projects…</p>}
      {error && <p className="text-site-rust text-sm">{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <Card className="text-center py-12">
          <p className="font-mono text-xs text-line uppercase tracking-wide mb-2">No projects yet</p>
          <p className="text-ink/70 text-sm">
            Create your first project to start adding drawings, inviting your team, and recording site meetings.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-display font-semibold text-ink text-base">{project.name}</h3>
              <StatusBadge status={project.status} />
            </div>
            {project.address && <p className="text-ink/60 text-sm mb-4">{project.address}</p>}
            <div className="flex gap-4 pt-3 border-t border-line/10 text-xs font-mono text-line uppercase tracking-wide">
              <span>Drawings →</span>
              <span>Meetings →</span>
              <span>Team →</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
