import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AuthForm } from "@/components/auth/AuthForm";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { DMWindow } from "@/components/dm/DMWindow";
import { User } from "@supabase/supabase-js";
import { useSearchParams } from "react-router-dom";

const Index = () => {
  const { currentWorkspaceId, setCurrentWorkspaceId, workspaces, isTransitioning } = useWorkspace();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"channel" | "dm">("channel");
  const [searchParams, setSearchParams] = useSearchParams();
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setWorkspacesLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setWorkspacesLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && workspaces.length === 0) {
      setWorkspacesLoading(true);
    } else if (user && workspaces.length > 0) {
      setWorkspacesLoading(false);
    }
  }, [user, workspaces]);

  useEffect(() => {
    if (user && workspaces.length > 0 && !currentWorkspaceId) {
      const lastWorkspaceId = localStorage.getItem("currentWorkspaceId");
      const targetWorkspace = lastWorkspaceId && workspaces.find(w => w.id === lastWorkspaceId)
        ? lastWorkspaceId
        : workspaces[0].id;
      setCurrentWorkspaceId(targetWorkspace);
    }
  }, [user, workspaces, currentWorkspaceId, setCurrentWorkspaceId]);

  useEffect(() => {
    if (currentWorkspaceId) {
      setChannelsLoading(true);
      fetchDefaultChannel().finally(() => {
        setChannelsLoading(false);
      });
    }
  }, [currentWorkspaceId]);

  // Handle URL parameters for navigation to specific messages
  useEffect(() => {
    const channelId = searchParams.get("channel");
    const conversationId = searchParams.get("conversation");
    const messageId = searchParams.get("message");

    if (channelId) {
      setCurrentChannelId(channelId);
      setCurrentConversationId(null);
      setViewMode("channel");
      if (messageId) setTargetMessageId(messageId);
    } else if (conversationId) {
      setCurrentConversationId(conversationId);
      setCurrentChannelId(null);
      setViewMode("dm");
      if (messageId) setTargetMessageId(messageId);
    }
  }, [searchParams]);

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

  const handleSelectChannel = (channelId: string) => {
    setCurrentChannelId(channelId);
    setCurrentConversationId(null);
    setViewMode("channel");
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setCurrentChannelId(null);
    setViewMode("dm");
  };

  const handleLogout = async () => {
    setCurrentChannelId(null);
    setCurrentConversationId(null);
    await supabase.auth.signOut();
  };

  if (loading || (user && workspacesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary mx-auto" />
            <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/20 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-accent/5 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-pulse-glow" />
        <AuthForm />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return <WorkspaceSelector onSelectWorkspace={setCurrentWorkspaceId} />;
  }

  if (!currentWorkspaceId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/20" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-background via-muted/20 to-background">
      <Sidebar
        workspaceId={currentWorkspaceId!}
        currentChannelId={currentChannelId}
        currentConversationId={currentConversationId}
        onSelectChannel={handleSelectChannel}
        onSelectConversation={handleSelectConversation}
        onLogout={handleLogout}
      />
      {isTransitioning || channelsLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center space-y-4 animate-fade-in">
            <div className="relative mx-auto">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/20" />
            </div>
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          </div>
        </div>
      ) : viewMode === "channel" && currentChannelId ? (
        <div className="flex-1 animate-fade-in">
          <ChatWindow channelId={currentChannelId} targetMessageId={targetMessageId} />
        </div>
      ) : viewMode === "dm" && currentConversationId ? (
        <div className="flex-1 animate-fade-in">
          <DMWindow conversationId={currentConversationId} targetMessageId={targetMessageId} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center space-y-3 animate-fade-in">
            <p className="text-lg text-muted-foreground">Select a channel or conversation to start messaging</p>
            <p className="text-sm text-muted-foreground/70">Choose from the sidebar to begin</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
