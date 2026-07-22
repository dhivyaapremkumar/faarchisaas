import { useEffect, useState } from "react";
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

export default function ArchitectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeProjectId, setActiveProject } = useActiveProject();

  useEffect(() => {
    api
      .get<Project[]>("/projects")
      .then((res) => {
        setProjects(res.data);
        // Default the active project to the first one, so sidebar/nav links have
        // somewhere to point. Only sets it if nothing's already selected.
        if (!activeProjectId && res.data.length > 0) {
          setActiveProject(res.data[0].id, res.data[0].name);
        }
      })
      .catch(() => setError("Couldn't load projects. Check that the backend is running."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {projects.map((project, i) => (
          <Card key={project.id} delay={i * 60} className="relative overflow-hidden pt-6">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-gradient" />
            <button
              onClick={() => setActiveProject(project.id, project.name)}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-display font-semibold text-ink text-base">{project.name}</h3>
                <StatusBadge status={project.status} />
              </div>
              {project.address && <p className="text-ink/60 text-sm mb-4">{project.address}</p>}
            </button>
            <div className="flex gap-4 pt-3 border-t border-line/10 text-xs font-mono text-line uppercase tracking-wide">
              <Link to="/drawings" onClick={() => setActiveProject(project.id, project.name)} className="hover:text-amber-dark transition-colors">
                Drawings →
              </Link>
              <Link to="/meetings" onClick={() => setActiveProject(project.id, project.name)} className="hover:text-amber-dark transition-colors">
                Meetings →
              </Link>
              <Link to="/team" onClick={() => setActiveProject(project.id, project.name)} className="hover:text-amber-dark transition-colors">
                Team →
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
