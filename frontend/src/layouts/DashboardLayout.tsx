import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth, Role } from "../lib/auth";

interface NavItem {
  label: string;
  path: string;
  code: string; // drawing-style short code, e.g. "DWG", "MOM"
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  architect: [
    { label: "Overview", path: "/", code: "OVR" },
    { label: "Drawings", path: "/drawings", code: "DWG" },
    { label: "CAD Files", path: "/files", code: "FIL" },
    { label: "Site Meetings", path: "/meetings", code: "MOM" },
    { label: "Team", path: "/team", code: "TM" },
  ],
  vendor: [
    { label: "My Tasks", path: "/", code: "TSK" },
    { label: "Drawings", path: "/drawings", code: "DWG" },
  ],
  client: [
    { label: "Project Status", path: "/", code: "STA" },
    { label: "Drawings", path: "/drawings", code: "DWG" },
  ],
};

function roleGroup(role: Role | null): keyof typeof NAV_BY_ROLE {
  if (role === "owner" || role === "architect_admin" || role === "architect_staff") return "architect";
  if (role === "vendor") return "vendor";
  return "client";
}

function roleLabel(role: Role | null): string {
  const map: Record<string, string> = {
    owner: "Firm Owner",
    architect_admin: "Architect (Admin)",
    architect_staff: "Architect",
    vendor: "Vendor",
    client: "Client",
    onboarding: "Onboarding",
  };
  return role ? map[role] ?? role : "";
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { role, logout } = useAuth();
  const items = NAV_BY_ROLE[roleGroup(role)];

  return (
    <div className="min-h-screen flex bg-paper">
      {/* Sidebar */}
      <aside className="w-60 bg-blueprint text-paper flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <p className="font-display font-semibold text-lg tracking-tight">ArchiSaaS</p>
          <p className="font-mono text-[11px] text-amber mt-0.5 uppercase tracking-wide">{roleLabel(role)}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-paper/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <span className="font-mono text-[10px] w-7 text-amber/80">{item.code}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-paper/60 hover:bg-white/5 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
