import { useEffect, useState, FormEvent } from "react";
import { api } from "../lib/api";
import { Card, SectionHeading } from "../components/ui";

interface Profile {
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Firm Owner / Chief Architect",
  architect_admin: "Architect (Admin)",
  architect_staff: "Architect",
  vendor: "Vendor",
  client: "Client",
  onboarding: "Onboarding",
};

export default function MyProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<Profile>("/me").then((res) => {
      setProfile(res.data);
      setFullName(res.data.full_name);
      setPhone(res.data.phone ?? "");
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.patch<Profile>("/me", { full_name: fullName, phone });
      setProfile(res.data);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-line text-sm">Loading…</p>;

  return (
    <div>
      <SectionHeading eyebrow="Account" title="My profile" />
      {profile && (
        <p className="font-mono text-xs text-amber-dark uppercase tracking-wide mb-6">
          {ROLE_LABELS[profile.role] ?? profile.role}
        </p>
      )}

      <Card className="max-w-md">
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-mono text-line uppercase mb-1">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-line uppercase mb-1">Email</label>
            <input
              value={profile?.email ?? ""}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-line/20 bg-paper text-sm text-ink/50"
            />
            <p className="text-[11px] text-ink/40 mt-1">Email can't be changed here — it's your login identifier.</p>
          </div>
          <div>
            <label className="block text-xs font-mono text-line uppercase mb-1">Phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2 rounded-lg border border-line/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-blueprint hover:bg-blueprint-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <p className="text-site-green text-sm">Saved.</p>}
        </form>
      </Card>
    </div>
  );
}
