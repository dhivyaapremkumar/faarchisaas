import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useActiveProject } from "../lib/activeProject";
import { CategoryBadge, SectionHeading, Card } from "../components/ui";

interface Contact {
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  category: string | null;
  trade: string | null;
}

export default function ProjectContacts() {
  const { activeProjectId, activeProjectName } = useActiveProject();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProjectId) return;
    api
      .get<Contact[]>(`/projects/${activeProjectId}/contacts`)
      .then((res) => setContacts(res.data))
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  if (!activeProjectId) {
    return <p className="text-ink/60 text-sm">Select a project from Overview first.</p>;
  }

  return (
    <div>
      <SectionHeading eyebrow={`CON · ${activeProjectName ?? ""}`} title="Contacts" />
      <p className="text-ink/60 text-sm mb-6">Phone and email for everyone working on this project.</p>

      {loading && <p className="text-line text-sm">Loading…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {contacts.map((c, i) => (
          <Card key={i} delay={i * 30}>
            <div className="flex items-start justify-between mb-2">
              <p className="font-display font-semibold text-ink">{c.full_name}</p>
              {c.category && <CategoryBadge category={c.category} />}
            </div>
            {c.trade && <p className="text-xs text-ink/50 mb-2">{c.trade}</p>}
            <div className="space-y-1 text-sm">
              <p className="text-ink/70">
                <span className="font-mono text-xs text-line uppercase mr-2">Email</span>
                {c.email}
              </p>
              <p className="text-ink/70">
                <span className="font-mono text-xs text-line uppercase mr-2">Phone</span>
                {c.phone || <span className="text-ink/30 italic">Not provided</span>}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {!loading && contacts.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-ink/60 text-sm">No contacts found for this project yet.</p>
        </Card>
      )}
    </div>
  );
}
