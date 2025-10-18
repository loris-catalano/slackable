import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { UserX, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ChannelDetailsDrawerProps {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChannelData {
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
  is_private: boolean;
  creator_name: string;
}

interface Member {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

export const ChannelDetailsDrawer = ({
  channelId,
  open,
  onOpenChange,
}: ChannelDetailsDrawerProps) => {
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPrivate, setEditIsPrivate] = useState(false);

  useEffect(() => {
    if (open) {
      fetchChannelDetails();
      fetchMembers();
      checkUserPermissions();
    }
  }, [channelId, open]);

  const fetchChannelDetails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("channels")
      .select(`
        name,
        description,
        created_at,
        created_by,
        is_private,
        profiles!channels_created_by_fkey(display_name)
      `)
      .eq("id", channelId)
      .single();

    if (error) {
      toast({ title: "Error loading channel", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data) {
      const channelData: ChannelData = {
        name: data.name,
        description: data.description,
        created_at: data.created_at,
        created_by: data.created_by,
        is_private: data.is_private,
        creator_name: (data.profiles as any)?.display_name || "Unknown",
      };
      setChannel(channelData);
      setEditName(data.name);
      setEditDescription(data.description || "");
      setEditIsPrivate(data.is_private);
    }
    setLoading(false);
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("channel_members")
      .select(`
        id,
        user_id,
        profiles!channel_members_user_id_fkey(display_name, avatar_url)
      `)
      .eq("channel_id", channelId);

    if (error) {
      toast({ title: "Error loading members", variant: "destructive" });
      return;
    }

    if (data) {
      const membersData: Member[] = data.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        display_name: m.profiles?.display_name || "Unknown",
        avatar_url: m.profiles?.avatar_url || null,
        role: "member",
      }));
      setMembers(membersData);
    }
  };

  const checkUserPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    // Check if user is workspace admin
    const { data: channelData } = await supabase
      .from("channels")
      .select("workspace_id, created_by")
      .eq("id", channelId)
      .single();

    if (!channelData) return;

    const { data: memberData } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", channelData.workspace_id)
      .eq("user_id", user.id)
      .single();

    const isWorkspaceAdmin = memberData?.role === "admin";
    const isCreator = channelData.created_by === user.id;
    setIsAdmin(isWorkspaceAdmin || isCreator);
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!isAdmin) return;

    // Optimistic update
    setMembers((prev) => prev.filter((m) => m.id !== memberId));

    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({ title: "Error removing member", variant: "destructive" });
      fetchMembers(); // Revert on error
    } else {
      toast({ title: "Member removed" });
    }
  };

  const handleSaveSettings = async () => {
    if (!isAdmin) return;

    // Optimistic update
    setChannel((prev) =>
      prev
        ? {
            ...prev,
            name: editName,
            description: editDescription,
            is_private: editIsPrivate,
          }
        : null
    );

    const { error } = await supabase
      .from("channels")
      .update({
        name: editName,
        description: editDescription,
        is_private: editIsPrivate,
      })
      .eq("id", channelId);

    if (error) {
      toast({ title: "Error updating channel", variant: "destructive" });
      fetchChannelDetails(); // Revert on error
    } else {
      toast({ title: "Channel updated successfully" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            {channel?.name || "Channel Details"}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="about" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            {isAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="about" className="space-y-4 mt-4">
            {loading ? (
              <>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </>
            ) : (
              channel && (
                <>
                  <div>
                    <Label className="text-sm text-muted-foreground">Channel Name</Label>
                    <p className="text-base font-medium">{channel.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <p className="text-base">{channel.description || "No description"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Created By</Label>
                    <p className="text-base">{channel.creator_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Created On</Label>
                    <p className="text-base">
                      {format(new Date(channel.created_at), "PPP")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Privacy</Label>
                    <p className="text-base">{channel.is_private ? "Private" : "Public"}</p>
                  </div>
                </>
              )
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-2 mt-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{member.display_name}</p>
                  </div>
                </div>
                {isAdmin && member.user_id !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id, member.user_id)}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-name">Channel Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-private">Private Channel</Label>
                <Switch
                  id="edit-private"
                  checked={editIsPrivate}
                  onCheckedChange={setEditIsPrivate}
                />
              </div>
              <Button onClick={handleSaveSettings} className="w-full">
                Save Changes
              </Button>
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
