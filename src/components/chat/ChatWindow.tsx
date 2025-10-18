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
}

interface ChatWindowProps {
  channelId: string;
}

export const ChatWindow = ({ channelId }: ChatWindowProps) => {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchChannel();
  }, [channelId]);

  const fetchChannel = async () => {
    const { data } = await supabase
      .from("channels")
      .select("name, description")
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
      <MessageList channelId={channelId} />
      <MessageInput channelId={channelId} />
      <ChannelDetailsDrawer
        channelId={channelId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
};
