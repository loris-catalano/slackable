import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ChannelDetailsDrawer } from "./ChannelDetailsDrawer";
import { Hash, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Channel {
  name: string;
  description: string | null;
  is_private: boolean;
}

interface ChatWindowProps {
  channelId: string;
}

export const ChatWindow = ({ channelId }: ChatWindowProps) => {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [membershipReady, setMembershipReady] = useState(false);

  useEffect(() => {
    setMembershipReady(false);
    fetchChannel();

    // Subscribe to realtime updates for this channel
    const channel = supabase
      .channel(`channel-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channels',
          filter: `id=eq.${channelId}`,
        },
        (payload) => {
          setChannel(payload.new as Channel);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  useEffect(() => {
    const ensure = async () => {
      if (!channel) {
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMembershipReady(true);
        return;
      }
      if (!channel.is_private) {
        const { error: cmError } = await supabase
          .from('channel_members')
          .insert([{ channel_id: channelId, user_id: user.id }]);
        // Ignore errors (e.g., already a member or private channel)
      }
      setMembershipReady(true);
    };
    ensure();
  }, [channelId, channel]);

  const fetchChannel = async () => {
    const { data } = await supabase
      .from("channels")
      .select("name, description, is_private")
      .eq("id", channelId)
      .single();

    if (data) setChannel(data);
  };

  if (!channel) return null;

  return (
    <div className="flex flex-1 flex-col h-screen">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Hash className="h-5 w-5" />
            <div>
              <h2 className="font-semibold">{channel.name}</h2>
              {channel.description && (
                <p className="text-sm text-muted-foreground">{channel.description}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
                Open Channel Details
              </DropdownMenuItem>
              <DropdownMenuItem disabled>Add Channel to Favourites</DropdownMenuItem>
              <DropdownMenuItem disabled>Find in Channel</DropdownMenuItem>
              <DropdownMenuItem disabled>Leave Channel</DropdownMenuItem>
              <DropdownMenuItem disabled>Delete Channel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {membershipReady && <MessageList channelId={channelId} />}
      {membershipReady && <MessageInput channelId={channelId} />}
      <ChannelDetailsDrawer
        channelId={channelId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
};
