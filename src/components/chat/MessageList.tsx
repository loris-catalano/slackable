import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  content: string;
  created_at: string;
  edited: boolean;
  user_id: string;
  user_display_name?: string | null;
  user_email?: string;
}

interface MessageListProps {
  channelId: string;
}

export const MessageList = ({ channelId }: MessageListProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    subscribeToMessages();
  }, [channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (data) {
      const messagesWithProfiles = await Promise.all(
        data.map(async (msg) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, email")
            .eq("id", msg.user_id)
            .single();

          return {
            ...msg,
            user_display_name: profile?.display_name,
            user_email: profile?.email,
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

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="group hover:bg-muted/50 rounded p-2 -mx-2 transition-colors">
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
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
