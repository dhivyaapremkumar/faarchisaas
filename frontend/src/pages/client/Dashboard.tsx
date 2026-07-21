import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface Project {
  id: string;
  name: string;
  status: string;
  address: string | null;
}

export default function ClientDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.get<Project[]>("/projects").then((res) => setProjects(res.data));
  }, []);

  return (
    <div>
      <SectionHeading eyebrow="Status" title="Your project" />
      <p className="text-ink/60 text-sm mb-6">
        A high-level view of progress. For detailed cost or vendor information, reach out to your architect directly.
      </p>

      {projects.map((project) => (
        <Card key={project.id} className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg text-ink">{project.name}</h3>
            <StatusBadge status={project.status} />
          </div>
          {project.address && <p className="text-ink/60 text-sm">{project.address}</p>}
        </Card>
      ))}
    </div>
  );
}
