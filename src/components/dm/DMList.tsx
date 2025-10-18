import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MessageSquarePlus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  last_message_at: string | null;
  unread_count?: number;
  other_user?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  member_count?: number;
}

interface WorkspaceMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string;
  has_conversation: boolean;
}

interface DMListProps {
  onSelectConversation: (conversationId: string) => void;
  onNewDM: () => void;
  selectedConversationId: string | null;
  workspaceId: string;
}

export const DMList = ({ onSelectConversation, onNewDM, selectedConversationId, workspaceId }: DMListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    setupRealtimeSubscription();
  }, [workspaceId]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('dm-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages'
        },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      await Promise.all([loadConversations(user.id), loadWorkspaceMembers(user.id)]);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (userId: string) => {
    // Get user's conversation memberships
    const { data: userConvs, error: userConvsError } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId);

    if (userConvsError) throw userConvsError;
    if (!userConvs || userConvs.length === 0) {
      setConversations([]);
      return;
    }

    const conversationIds = userConvs.map(c => c.conversation_id);

    // Get conversations data
    const { data: convsData, error: convsError } = await supabase
      .from("conversations")
      .select("id, name, is_group, last_message_at")
      .in("id", conversationIds)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (convsError) throw convsError;

    // Process each conversation
    const processedConversations = await Promise.all(
      (convsData || []).map(async (conv: any) => {
        // Get unread count
        const userConv = userConvs.find(uc => uc.conversation_id === conv.id);
        const lastReadAt = userConv?.last_read_at;

        let unreadCount = 0;
        if (lastReadAt) {
          const { count } = await supabase
            .from("direct_messages")
            .select("*", { count: 'exact', head: true })
            .eq("conversation_id", conv.id)
            .gt("created_at", lastReadAt)
            .neq("user_id", userId);
          unreadCount = count || 0;
        } else {
          const { count } = await supabase
            .from("direct_messages")
            .select("*", { count: 'exact', head: true })
            .eq("conversation_id", conv.id)
            .neq("user_id", userId);
          unreadCount = count || 0;
        }

        // Get conversation members
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", conv.id);

        // For 1:1 chats, get the other user's profile
        let otherUser;
        if (!conv.is_group && members && members.length === 2) {
          const otherUserId = members.find(m => m.user_id !== userId)?.user_id;
          if (otherUserId) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, display_name, avatar_url")
              .eq("id", otherUserId)
              .single();
            
            if (profile) {
              otherUser = profile;
            }
          }
        }

        return {
          id: conv.id,
          name: conv.name,
          is_group: conv.is_group,
          last_message_at: conv.last_message_at,
          unread_count: unreadCount,
          other_user: otherUser,
          member_count: members?.length || 0
        };
      })
    );

    setConversations(processedConversations);
  };

  const loadWorkspaceMembers = async (userId: string) => {
    // Get workspace members
    const { data: workspaceMembers, error: membersError } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .neq("user_id", userId);

    if (membersError) throw membersError;
    if (!workspaceMembers || workspaceMembers.length === 0) {
      setMembers([]);
      return;
    }

    const memberUserIds = workspaceMembers.map(m => m.user_id);

    // Get profiles for all members
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, email")
      .in("id", memberUserIds);

    if (profilesError) throw profilesError;

    // Get existing 1:1 conversations
    const { data: existingConvs } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);

    const conversationUserIds = new Set<string>();
    
    if (existingConvs) {
      for (const conv of existingConvs) {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id, conversations!inner(is_group)")
          .eq("conversation_id", conv.conversation_id);

        if (members && members.length === 2 && !(members[0] as any).conversations.is_group) {
          const otherMember = members.find(m => m.user_id !== userId);
          if (otherMember) {
            conversationUserIds.add(otherMember.user_id);
          }
        }
      }
    }

    const membersList = (profiles || []).map(profile => ({
      id: profile.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      email: profile.email,
      has_conversation: conversationUserIds.has(profile.id)
    }));

    setMembers(membersList);
  };

  const startDirectMessage = async (memberId: string) => {
    if (!currentUserId) return;

    try {
      // Check if conversation already exists
      const { data: existingConvs } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (existingConvs) {
        for (const conv of existingConvs) {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id, conversations!inner(is_group)")
            .eq("conversation_id", conv.conversation_id);

          if (
            members &&
            members.length === 2 &&
            !(members[0] as any).conversations.is_group &&
            members.some(m => m.user_id === memberId)
          ) {
            onSelectConversation(conv.conversation_id);
            return;
          }
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          is_group: false,
          created_by: currentUserId
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add members
      const { error: memberError } = await supabase
        .from("conversation_members")
        .insert([
          { conversation_id: conversation.id, user_id: currentUserId },
          { conversation_id: conversation.id, user_id: memberId }
        ]);

      if (memberError) throw memberError;

      onSelectConversation(conversation.id);
    } catch (error: any) {
      console.error("Error starting DM:", error);
      toast.error("Failed to start conversation");
    }
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.is_group) {
      return conv.name || "Group Chat";
    }
    return conv.other_user?.display_name || "Unknown User";
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.is_group) {
      return null;
    }
    return conv.other_user?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  const activeConversations = conversations.filter(c => c.last_message_at);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg">Direct Messages</h2>
        <Button onClick={onNewDM} size="icon" variant="ghost" title="New group chat">
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active Conversations */}
        {activeConversations.length > 0 && (
          <>
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Messages</h3>
            </div>
            {activeConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors ${
                  selectedConversationId === conv.id ? "bg-accent" : ""
                }`}
              >
                {conv.is_group ? (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                ) : (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getConversationAvatar(conv) || undefined} />
                    <AvatarFallback>
                      {getInitials(getConversationName(conv))}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {getConversationName(conv)}
                    </span>
                    {conv.unread_count && conv.unread_count > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                  {conv.is_group && (
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.member_count} members
                    </p>
                  )}
                </div>
              </button>
            ))}
          </>
        )}

        {/* All Workspace Members */}
        {members.length > 0 && (
          <>
            {activeConversations.length > 0 && <Separator className="my-2" />}
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Workspace Members</h3>
            </div>
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => startDirectMessage(member.id)}
                className="w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {getInitials(member.display_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium truncate">{member.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {conversations.length === 0 && members.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            No workspace members found.
          </div>
        )}
      </div>
    </div>
  );
};
