import { createContext, useContext, useState, ReactNode, useEffect } from "react";

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

  useEffect(() => {
    if (activeProjectId) localStorage.setItem("active_project_id", activeProjectId);
    if (activeProjectName) localStorage.setItem("active_project_name", activeProjectName);
  }, [activeProjectId, activeProjectName]);

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
