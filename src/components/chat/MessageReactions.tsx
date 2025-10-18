import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { toast } from "sonner";

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
  count: number;
  users: string[];
}

interface MessageReactionsProps {
  messageId: string;
  currentUserId: string;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👀"];

export const MessageReactions = ({ messageId, currentUserId }: MessageReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReactions();
    setupRealtimeSubscription();
  }, [messageId]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`
        },
        () => {
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadReactions = async () => {
    try {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("id, emoji, user_id")
        .eq("message_id", messageId);

      if (error) throw error;

      // Group reactions by emoji
      const grouped = (data || []).reduce((acc, reaction) => {
        const existing = acc.find(r => r.emoji === reaction.emoji);
        if (existing) {
          existing.count++;
          existing.users.push(reaction.user_id);
          if (reaction.user_id === currentUserId && !existing.id) {
            existing.id = reaction.id;
          }
        } else {
          acc.push({
            id: reaction.user_id === currentUserId ? reaction.id : "",
            emoji: reaction.emoji,
            user_id: reaction.user_id,
            count: 1,
            users: [reaction.user_id]
          });
        }
        return acc;
      }, [] as Reaction[]);

      setReactions(grouped);
    } catch (error: any) {
      console.error("Error loading reactions:", error);
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (loading) return;
    setLoading(true);

    try {
      const existingReaction = reactions.find(
        r => r.emoji === emoji && r.users.includes(currentUserId)
      );

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", currentUserId)
          .eq("emoji", emoji);

        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: currentUserId,
            emoji
          });

        if (error) throw error;
      }
    } catch (error: any) {
      console.error("Error toggling reaction:", error);
      toast.error("Failed to update reaction");
    } finally {
      setLoading(false);
    }
  };

  const hasUserReacted = (reaction: Reaction) => {
    return reaction.users.includes(currentUserId);
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      {/* Display existing reactions */}
      {reactions.map((reaction, index) => (
        <Button
          key={`${reaction.emoji}-${index}`}
          variant="ghost"
          size="sm"
          className={`h-7 px-2 text-xs ${
            hasUserReacted(reaction) ? "bg-primary/10 border border-primary" : ""
          }`}
          onClick={() => toggleReaction(reaction.emoji)}
          disabled={loading}
        >
          <span className="mr-1">{reaction.emoji}</span>
          <span className="text-muted-foreground">{reaction.count}</span>
        </Button>
      ))}

      {/* Add reaction button */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={loading}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-xl"
                onClick={() => toggleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
