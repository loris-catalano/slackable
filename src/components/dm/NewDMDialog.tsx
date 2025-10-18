import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface User {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string;
}

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
  workspaceId: string;
}

export const NewDMDialog = ({
  open,
  onOpenChange,
  onConversationCreated,
  workspaceId
}: NewDMDialogProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      loadUsers();
      setSelectedUsers(new Set());
      setGroupName("");
      setSearchQuery("");
    }
  }, [open, workspaceId]);

  const loadUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all workspace members
      const { data: members, error } = await supabase
        .from("workspace_members")
        .select(`
          user_id,
          profiles(id, display_name, avatar_url, email)
        `)
        .eq("workspace_id", workspaceId)
        .neq("user_id", user.id);

      if (error) throw error;

      const usersList = members
        ?.map((m: any) => m.profiles)
        .filter(Boolean) as User[];

      setUsers(usersList || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    }
  };

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const createConversation = async () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    if (selectedUsers.size > 1 && !groupName.trim()) {
      toast.error("Please enter a name for the group chat");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const isGroup = selectedUsers.size > 1;

      // Check if 1:1 conversation already exists
      if (!isGroup) {
        const otherUserId = Array.from(selectedUsers)[0];
        
        const { data: existing } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", user.id);

        if (existing) {
          for (const conv of existing) {
            const { data: members } = await supabase
              .from("conversation_members")
              .select("user_id")
              .eq("conversation_id", conv.conversation_id);

            if (
              members &&
              members.length === 2 &&
              members.some(m => m.user_id === otherUserId)
            ) {
              onConversationCreated(conv.conversation_id);
              onOpenChange(false);
              return;
            }
          }
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          name: isGroup ? groupName : null,
          is_group: isGroup,
          created_by: user.id
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add members
      const memberInserts = [
        { conversation_id: conversation.id, user_id: user.id },
        ...Array.from(selectedUsers).map(userId => ({
          conversation_id: conversation.id,
          user_id: userId
        }))
      ];

      const { error: memberError } = await supabase
        .from("conversation_members")
        .insert(memberInserts);

      if (memberError) throw memberError;

      toast.success(isGroup ? "Group created!" : "DM started!");
      onConversationCreated(conversation.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {selectedUsers.size > 1 && (
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                placeholder="Enter group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg cursor-pointer"
                onClick={() => toggleUser(user.id)}
              >
                <Checkbox
                  checked={selectedUsers.has(user.id)}
                  onCheckedChange={() => toggleUser(user.id)}
                />
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={createConversation}
              disabled={loading || selectedUsers.size === 0}
              className="flex-1"
            >
              {loading ? "Creating..." : selectedUsers.size > 1 ? "Create Group" : "Start DM"}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
