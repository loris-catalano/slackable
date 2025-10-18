import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Hash, MessageSquare, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  type: "channel" | "dm";
  channel_id?: string;
  conversation_id?: string;
  channel_name?: string;
  conversation_name?: string;
  user_display_name: string;
}

interface GlobalSearchProps {
  onSelectResult: (result: SearchResult) => void;
  workspaceId: string;
}

export const GlobalSearch = ({ onSelectResult, workspaceId }: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Search in channel messages
      const { data: channelMessages } = await supabase
        .from("messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          channel_id,
          channels!inner(name, workspace_id)
        `)
        .ilike("content", `%${query}%`)
        .eq("channels.workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Search in direct messages
      const { data: dmMessages } = await supabase
        .from("direct_messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          conversation_id
        `)
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      // Get user profiles
      const allUserIds = [
        ...(channelMessages || []).map(m => m.user_id),
        ...(dmMessages || []).map(m => m.user_id)
      ];
      const uniqueUserIds = [...new Set(allUserIds)];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", uniqueUserIds);

      // Get conversation details for DMs
      const conversationIds = [...new Set((dmMessages || []).map(m => m.conversation_id))];
      const conversationDetails = await Promise.all(
        conversationIds.map(async (convId) => {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id, name, is_group")
            .eq("id", convId)
            .single();

          if (!conv) return null;

          if (conv.is_group) {
            return { id: convId, name: conv.name || "Group Chat" };
          }

          // For 1:1 chats, get other user's name
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", convId);

          const otherUserId = members?.find(m => m.user_id !== user.id)?.user_id;
          if (otherUserId) {
            const otherProfile = profiles?.find(p => p.id === otherUserId);
            return { id: convId, name: otherProfile?.display_name || "Unknown User" };
          }

          return { id: convId, name: "Unknown" };
        })
      );

      // Format channel results
      const channelResults: SearchResult[] = (channelMessages || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        type: "channel" as const,
        channel_id: msg.channel_id,
        channel_name: (msg.channels as any).name,
        user_display_name: profiles?.find(p => p.id === msg.user_id)?.display_name || "Unknown"
      }));

      // Format DM results
      const dmResults: SearchResult[] = (dmMessages || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        type: "dm" as const,
        conversation_id: msg.conversation_id,
        conversation_name: conversationDetails.find(c => c?.id === msg.conversation_id)?.name || "Unknown",
        user_display_name: profiles?.find(p => p.id === msg.user_id)?.display_name || "Unknown"
      }));

      // Combine and sort by recency
      const allResults = [...channelResults, ...dmResults].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setResults(allResults);
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Failed to search messages");
    } finally {
      setLoading(false);
    }
  };

  const highlightMatch = (text: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-900">{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && performSearch()}
            placeholder="Search messages..."
            className="pl-10 pr-10"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button 
          onClick={performSearch} 
          disabled={!query.trim() || loading}
          className="w-full mt-2"
        >
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {results.length === 0 && query && !loading && (
            <p className="text-center text-muted-foreground py-8">
              No results found for "{query}"
            </p>
          )}
          
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => onSelectResult(result)}
              className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {result.type === "channel" ? (
                    <Hash className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {result.type === "channel" ? `#${result.channel_name}` : result.conversation_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {result.user_display_name}
                  </p>
                  <p className="text-sm line-clamp-2">
                    {highlightMatch(result.content)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
