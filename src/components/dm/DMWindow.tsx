import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  edited: boolean;
  profiles: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
}

interface DMWindowProps {
  conversationId: string;
}

export const DMWindow = ({ conversationId }: DMWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationName, setConversationName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversation();
    loadMessages();
    setupRealtimeSubscription();
    markAsRead();

    return () => {
      supabase.removeAllChannels();
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          loadMessages();
          markAsRead();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Get conversation details
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("id, name, is_group")
        .eq("id", conversationId)
        .single();

      if (convError) throw convError;

      setConversation(convData);

      // Get conversation members
      const { data: membersData, error: membersError } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (membersError) throw membersError;

      // Set conversation name
      if (convData.is_group) {
        setConversationName(convData.name || "Group Chat");
      } else {
        // For 1:1 chats, get the other user's profile
        const otherUserId = membersData?.find(m => m.user_id !== user.id)?.user_id;
        if (otherUserId) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", otherUserId)
            .single();
          
          setConversationName(profileData?.display_name || "Unknown User");
        }
      }
    } catch (error: any) {
      console.error("Error loading conversation:", error);
      toast.error("Failed to load conversation");
    }
  };

  const loadMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("direct_messages")
        .select("id, content, user_id, created_at, edited")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(messagesData?.map(m => m.user_id) || [])];
      
      // Get profiles for all users
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      // Combine messages with profiles
      const messagesWithProfiles = (messagesData || []).map(message => ({
        ...message,
        profiles: profilesData?.find(p => p.id === message.user_id) || {
          id: message.user_id,
          display_name: "Unknown User",
          avatar_url: null
        }
      }));

      setMessages(messagesWithProfiles as any);
    } catch (error: any) {
      console.error("Error loading messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const markAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) return;

    try {
      // Extract mentions (@username)
      const mentionRegex = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(newMessage)) !== null) {
        mentions.push(match[1]);
      }

      const { error } = await supabase
        .from("direct_messages")
        .insert({
          conversation_id: conversationId,
          user_id: currentUserId,
          content: newMessage,
          mentions: mentions.length > 0 ? mentions : []
        });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        {conversation.is_group ? (
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
        ) : (
          <Avatar className="h-10 w-10">
            <AvatarFallback>{getInitials(conversationName)}</AvatarFallback>
          </Avatar>
        )}
        <div>
          <h2 className="font-semibold">{conversationName}</h2>
          {conversation.is_group && (
            <p className="text-xs text-muted-foreground">Group chat</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.profiles.avatar_url || undefined} />
              <AvatarFallback>
                {getInitials(message.profiles.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm">
                  {message.profiles.display_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.created_at), "h:mm a")}
                </span>
              </div>
              <p className="text-sm mt-1 break-words">{message.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={`Message ${conversationName}`}
            className="flex-1"
          />
          <Button onClick={sendMessage} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
