import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WorkspaceContextType {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
  workspaces: Array<{ id: string; name: string; slug: string }>;
  loadWorkspaces: () => Promise<void>;
  isTransitioning: boolean;
  setIsTransitioning: (value: boolean) => void;
  resetWorkspaceData: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
};

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    () => localStorage.getItem("currentWorkspaceId")
  );
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (currentWorkspaceId) {
      localStorage.setItem("currentWorkspaceId", currentWorkspaceId);
    } else {
      localStorage.removeItem("currentWorkspaceId");
    }
  }, [currentWorkspaceId]);

  const loadWorkspaces = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setWorkspaces([]);
      return;
    }

    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setWorkspaces(data);
    }
  };

  const resetWorkspaceData = () => {
    setCurrentWorkspaceId(null);
    setWorkspaces([]);
    setIsTransitioning(false);
    localStorage.removeItem("currentWorkspaceId");
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        loadWorkspaces();
      } else if (event === 'SIGNED_OUT') {
        resetWorkspaceData();
      }
    });

    loadWorkspaces();

    return () => subscription.unsubscribe();
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspaceId,
        setCurrentWorkspaceId,
        workspaces,
        loadWorkspaces,
        isTransitioning,
        setIsTransitioning,
        resetWorkspaceData,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
