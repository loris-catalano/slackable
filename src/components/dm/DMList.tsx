import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MessageSquarePlus } from "lucide-react";
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
  members?: Array<{
    profiles: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    };
  }>;
}

interface DMListProps {
  onSelectConversation: (conversationId: string) => void;
  onNewDM: () => void;
  selectedConversationId: string | null;
}

export const DMList = ({ onSelectConversation, onNewDM, selectedConversationId }: DMListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
    setupRealtimeSubscription();
  }, []);

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
          loadConversations();
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
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Get all conversations user is part of
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select(`
          id,
          name,
          is_group,
          last_message_at,
          conversation_members!inner(
            user_id,
            last_read_at,
            profiles(id, display_name, avatar_url)
          )
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (convError) throw convError;

      // Process conversations to add unread counts and user info
      const processedConversations = await Promise.all(
        (convData || []).map(async (conv: any) => {
          // Get unread count
          const { data: unreadData } = await supabase
            .from("conversation_members")
            .select("last_read_at")
            .eq("conversation_id", conv.id)
            .eq("user_id", user.id)
            .single();

          const lastReadAt = unreadData?.last_read_at;

          let unreadCount = 0;
          if (lastReadAt) {
            const { count } = await supabase
              .from("direct_messages")
              .select("*", { count: 'exact', head: true })
              .eq("conversation_id", conv.id)
              .gt("created_at", lastReadAt)
              .neq("user_id", user.id);

            unreadCount = count || 0;
          } else {
            const { count } = await supabase
              .from("direct_messages")
              .select("*", { count: 'exact', head: true })
              .eq("conversation_id", conv.id)
              .neq("user_id", user.id);

            unreadCount = count || 0;
          }

          // For 1:1 chats, get the other user
          let otherUser;
          if (!conv.is_group) {
            const otherMember = conv.conversation_members.find(
              (m: any) => m.user_id !== user.id
            );
            if (otherMember?.profiles) {
              otherUser = {
                id: otherMember.profiles.id,
                display_name: otherMember.profiles.display_name,
                avatar_url: otherMember.profiles.avatar_url
              };
            }
          }

          return {
            id: conv.id,
            name: conv.name,
            is_group: conv.is_group,
            last_message_at: conv.last_message_at,
            unread_count: unreadCount,
            other_user: otherUser,
            members: conv.conversation_members
          };
        })
      );

      setConversations(processedConversations);
    } catch (error: any) {
      console.error("Error loading conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg">Direct Messages</h2>
        <Button onClick={onNewDM} size="icon" variant="ghost">
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No conversations yet. Start a new DM!
          </div>
        ) : (
          conversations.map((conv) => (
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
                    {conv.members?.length || 0} members
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
