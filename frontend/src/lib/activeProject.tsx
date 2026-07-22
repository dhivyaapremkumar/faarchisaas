import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

interface ActiveProjectState {
  activeProjectId: string | null;
  activeProjectName: string | null;
  setActiveProject: (id: string, name: string) => void;
}

const ActiveProjectContext = createContext<ActiveProjectState | undefined>(undefined);

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    () => localStorage.getItem("active_project_id")
  );
  const [activeProjectName, setActiveProjectName] = useState<string | null>(
    () => localStorage.getItem("active_project_name")
  );
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (activeProjectId) localStorage.setItem("active_project_id", activeProjectId);
    if (activeProjectName) localStorage.setItem("active_project_name", activeProjectName);
  }, [activeProjectId, activeProjectName]);

  // Global fallback: if logged in but no active project is set yet, fetch
  // this user's projects and default to the first one. Runs here at the
  // provider level (not inside individual dashboard pages) so it works no
  // matter which tab someone lands on first after logging in - not just
  // whichever page happens to be their role's "home".
  useEffect(() => {
    if (isAuthenticated && !activeProjectId) {
      api
        .get<{ id: string; name: string }[]>("/projects")
        .then((res) => {
          if (res.data.length > 0) {
            setActiveProjectId(res.data[0].id);
            setActiveProjectName(res.data[0].name);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, activeProjectId]);

  function setActiveProject(id: string, name: string) {
    setActiveProjectId(id);
    setActiveProjectName(name);
  }

  return (
    <ActiveProjectContext.Provider value={{ activeProjectId, activeProjectName, setActiveProject }}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) throw new Error("useActiveProject must be used within ActiveProjectProvider");
  return ctx;
}
