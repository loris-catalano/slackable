import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { Hash } from "lucide-react";

interface Channel {
  name: string;
  description: string | null;
}

interface ChatWindowProps {
  channelId: string;
}

export const ChatWindow = ({ channelId }: ChatWindowProps) => {
  const [channel, setChannel] = useState<Channel | null>(null);

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
        <div className="flex items-center space-x-2">
          <Hash className="h-5 w-5" />
          <div>
            <h2 className="font-semibold">{channel.name}</h2>
            {channel.description && (
              <p className="text-sm text-muted-foreground">{channel.description}</p>
            )}
          </div>
        </div>
      </div>
      <MessageList channelId={channelId} />
      <MessageInput channelId={channelId} />
    </div>
  );
};
