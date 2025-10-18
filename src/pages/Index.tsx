import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AuthForm } from "@/components/auth/AuthForm";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { User } from "@supabase/supabase-js";

const Index = () => {
  const { currentWorkspaceId, setCurrentWorkspaceId, workspaces } = useWorkspace();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && workspaces.length > 0 && !currentWorkspaceId) {
      setCurrentWorkspaceId(workspaces[0].id);
    }
  }, [user, workspaces, currentWorkspaceId, setCurrentWorkspaceId]);

  useEffect(() => {
    if (currentWorkspaceId) {
      fetchDefaultChannel();
    }
  }, [currentWorkspaceId]);

  const fetchDefaultChannel = async () => {
    if (!currentWorkspaceId) return;

    const { data } = await supabase
      .from("channels")
      .select("id")
      .eq("workspace_id", currentWorkspaceId)
      .order("created_at")
      .limit(1)
      .single();

    if (data) {
      setCurrentChannelId(data.id);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("channel_members").insert({
          channel_id: data.id,
          user_id: user.id,
        }).select();
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentWorkspaceId(null);
    setCurrentChannelId(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <AuthForm />
      </div>
    );
  }

  if (!currentWorkspaceId || workspaces.length === 0) {
    return <WorkspaceSelector onSelectWorkspace={setCurrentWorkspaceId} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        workspaceId={currentWorkspaceId}
        currentChannelId={currentChannelId}
        onSelectChannel={setCurrentChannelId}
        onLogout={handleLogout}
      />
      {currentChannelId ? (
        <ChatWindow channelId={currentChannelId} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Select a channel to start messaging</p>
        </div>
      )}
    </div>
  );
};

export default Index;
