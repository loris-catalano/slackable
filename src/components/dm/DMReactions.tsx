import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

interface DMReactionsProps {
  dmId: string;
  currentUserId: string;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🚀", "👀"];

export const DMReactions = ({ dmId, currentUserId }: DMReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReactions();
    setupRealtimeSubscription();
  }, [dmId]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`dm-reactions-${dmId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_reactions",
          filter: `dm_id=eq.${dmId}`,
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
        .from("dm_reactions")
        .select("emoji, user_id")
        .eq("dm_id", dmId);

      if (error) throw error;

      // Group reactions by emoji
      const grouped = (data || []).reduce((acc: { [key: string]: Reaction }, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = {
            emoji: reaction.emoji,
            count: 0,
            users: [],
          };
        }
        acc[reaction.emoji].count += 1;
        acc[reaction.emoji].users.push(reaction.user_id);
        return acc;
      }, {});

      setReactions(Object.values(grouped));
    } catch (error) {
      console.error("Error loading reactions:", error);
    }
  };

  const toggleReaction = async (emoji: string) => {
    setLoading(true);
    try {
      // Check if user already reacted with this emoji
      const { data: existing } = await supabase
        .from("dm_reactions")
        .select("id")
        .eq("dm_id", dmId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji)
        .single();

      if (existing) {
        // Remove reaction
        await supabase
          .from("dm_reactions")
          .delete()
          .eq("id", existing.id);
      } else {
        // Add reaction
        await supabase
          .from("dm_reactions")
          .insert({
            dm_id: dmId,
            user_id: currentUserId,
            emoji,
          });
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant={reaction.users.includes(currentUserId) ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-sm"
          onClick={() => toggleReaction(reaction.emoji)}
          disabled={loading}
        >
          <span>{reaction.emoji}</span>
          <span className="ml-1 text-xs">{reaction.count}</span>
        </Button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={loading}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => toggleReaction(emoji)}
                disabled={loading}
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
