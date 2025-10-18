import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { MessageReactions } from "./MessageReactions";
import { MediaMessage } from "./MediaMessage";

interface Message {
  id: string;
  content: string;
  created_at: string;
  edited: boolean;
  user_id: string;
  user_display_name?: string | null;
  user_email?: string;
  user_avatar_url?: string | null;
  attachment_type?: string | null;
  attachment_url?: string | null;
}

interface MessageListProps {
  channelId: string;
  targetMessageId?: string | null;
}

export const MessageList = ({ channelId, targetMessageId }: MessageListProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  useEffect(() => {
    fetchMessages();
    subscribeToMessages();
  }, [channelId]);

  useEffect(() => {
    if (targetMessageId && messages.length > 0) {
      scrollToTargetMessage();
    } else {
      scrollToBottom();
    }
  }, [messages, targetMessageId]);

  const scrollToTargetMessage = () => {
    if (targetMessageId && messageRefs.current[targetMessageId]) {
      messageRefs.current[targetMessageId]?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      
      // Highlight the message briefly
      const element = messageRefs.current[targetMessageId];
      if (element) {
        element.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, 2000);
      }
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, content, created_at, edited, user_id, attachment_type, attachment_url")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (data) {
      const messagesWithProfiles = await Promise.all(
        data.map(async (msg) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, email, avatar_url")
            .eq("id", msg.user_id)
            .single();

          return {
            ...msg,
            user_display_name: profile?.display_name,
            user_email: profile?.email,
            user_avatar_url: profile?.avatar_url,
          };
        })
      );
      setMessages(messagesWithProfiles);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || "?";
  };

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-4">
        {messages.map((message) => (
          <div 
            key={message.id} 
            ref={(el) => messageRefs.current[message.id] = el}
            className="group hover:bg-muted/50 rounded p-2 -mx-2 transition-colors"
          >
            <div className="flex items-start space-x-3">
              <Avatar className="h-8 w-8 mt-0.5">
                <AvatarImage src={message.user_avatar_url || undefined} />
                <AvatarFallback>
                  {getInitials(message.user_display_name, message.user_email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline space-x-2">
                  <span className="font-semibold">
                    {message.user_display_name || message.user_email?.split("@")[0] || "Unknown User"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </span>
                  {message.edited && (
                    <span className="text-xs text-muted-foreground">(edited)</span>
                  )}
                </div>
                <p className="mt-1 text-foreground whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                {message.attachment_type && message.attachment_url && (
                  <div className="mt-2">
                    <MediaMessage
                      type={message.attachment_type as "image" | "audio"}
                      url={message.attachment_url}
                    />
                  </div>
                )}
                {currentUserId && (
                  <MessageReactions 
                    messageId={message.id} 
                    currentUserId={currentUserId}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
