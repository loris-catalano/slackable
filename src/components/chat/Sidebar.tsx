import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Plus, LogOut, MessageSquare, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { InviteWorkspaceDialog } from "@/components/workspace/InviteWorkspaceDialog";
import { QuickProfileCard } from "@/components/profile/QuickProfileCard";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { DMList } from "@/components/dm/DMList";
import { NewDMDialog } from "@/components/dm/NewDMDialog";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { useNavigate } from "react-router-dom";

interface Channel {
  id: string;
  name: string;
  description: string | null;
}

interface Profile {
  display_name: string | null;
  email: string;
}

interface SidebarProps {
  workspaceId: string;
  currentChannelId: string | null;
  currentConversationId: string | null;
  onSelectChannel: (channelId: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onLogout: () => void;
}

export const Sidebar = ({ workspaceId, currentChannelId, currentConversationId, onSelectChannel, onSelectConversation, onLogout }: SidebarProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isNewDMOpen, setIsNewDMOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearchResult = (result: any) => {
    if (result.type === "channel" && result.channel_id) {
      navigate(`/?channel=${result.channel_id}&message=${result.id}`);
    } else if (result.type === "dm" && result.conversation_id) {
      navigate(`/?conversation=${result.conversation_id}&message=${result.id}`);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setProfile(null);
    setWorkspaceName("");
    Promise.all([
      fetchChannels(),
      fetchProfile(),
      fetchWorkspaceName()
    ]).finally(() => {
      setIsLoading(false);
    });
    const unsubscribe = subscribeToChannels();
    return unsubscribe;
  }, [workspaceId]);

  const fetchChannels = async () => {
    const { data } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at");

    if (data) setChannels(data);
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) setProfile(data);
  };

  const fetchWorkspaceName = async () => {
    const { data } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();

    if (data) setWorkspaceName(data.name);
  };

  const subscribeToChannels = () => {
    const channel = supabase
      .channel("channels-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channels",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .insert({
        workspace_id: workspaceId,
        name: newChannelName.toLowerCase().replace(/\s+/g, "-"),
        description: newChannelDesc,
        created_by: user.id,
      })
      .select()
      .single();

    if (channelError) {
      toast.error("Failed to create channel");
      return;
    }

    await supabase.from("channel_members").insert({
      channel_id: channel.id,
      user_id: user.id,
    });

    toast.success("Channel created!");
    setIsDialogOpen(false);
    setNewChannelName("");
    setNewChannelDesc("");
    onSelectChannel(channel.id);
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl">
      <div className="border-b border-sidebar-border/50 bg-white/10 backdrop-blur-sm">
        <WorkspaceSwitcher currentWorkspaceName={workspaceName || "Workspace"} />
      </div>

      <div className="border-b border-sidebar-border/50 p-4 bg-white/5">
        <InviteWorkspaceDialog workspaceId={workspaceId} workspaceName={workspaceName} />
      </div>

      <Tabs defaultValue="channels" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 grid grid-cols-3">
          <TabsTrigger value="channels">
            <Hash className="mr-2 h-4 w-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="dms">
            <MessageSquare className="mr-2 h-4 w-4" />
            DMs
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" />
            Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Channels</h3>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Channel</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="channel-name">Channel Name</Label>
                            <Input
                              id="channel-name"
                              placeholder="project-updates"
                              value={newChannelName}
                              onChange={(e) => setNewChannelName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="channel-desc">Description (optional)</Label>
                            <Input
                              id="channel-desc"
                              placeholder="Project updates and announcements"
                              value={newChannelDesc}
                              onChange={(e) => setNewChannelDesc(e.target.value)}
                            />
                          </div>
                          <Button onClick={createChannel} className="w-full">
                            Create Channel
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="space-y-1">
                    {channels.map((channel) => (
                      <Button
                        key={channel.id}
                        variant={currentChannelId === channel.id ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => onSelectChannel(channel.id)}
                      >
                        <Hash className="mr-2 h-4 w-4" />
                        {channel.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="dms" className="flex-1 mt-0">
          <DMList
            onSelectConversation={onSelectConversation}
            onNewDM={() => setIsNewDMOpen(true)}
            selectedConversationId={currentConversationId}
            workspaceId={workspaceId}
          />
        </TabsContent>

        <TabsContent value="search" className="flex-1 mt-0">
          <GlobalSearch 
            onSelectResult={handleSearchResult}
            workspaceId={workspaceId}
          />
        </TabsContent>
      </Tabs>

      <NewDMDialog
        open={isNewDMOpen}
        onOpenChange={setIsNewDMOpen}
        onConversationCreated={onSelectConversation}
        workspaceId={workspaceId}
      />

      <div className="border-t border-sidebar-border/50 p-4 space-y-2 bg-white/5 backdrop-blur-sm">
        {profile ? (
          <QuickProfileCard />
        ) : (
          <div className="h-10 animate-pulse rounded-lg bg-white/10" />
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start hover:bg-white/10 transition-all duration-200" 
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};
