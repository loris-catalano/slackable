import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { AudioRecorder } from "./AudioRecorder";
import { ImageUploader } from "./ImageUploader";

interface MessageInputProps {
  channelId: string;
}

export const MessageInput = ({ channelId }: MessageInputProps) => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const uploadFile = async (file: Blob, type: "audio" | "image"): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const bucket = type === "audio" ? "chat-audio" : "chat-images";
    const fileExt = type === "audio" ? "webm" : "jpg";
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const sendMessage = async (attachmentType?: string, attachmentUrl?: string) => {
    if ((!message.trim() && !attachmentUrl) || isSending) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Ensure membership in public channels (ignore errors and duplicates)
      try {
        await supabase
          .from("channel_members")
          .insert([{ channel_id: channelId, user_id: user.id }]);
      } catch (_) {
        // ignore RLS/duplicate errors
      }

      const { error } = await supabase.from("messages").insert({
        channel_id: channelId,
        user_id: user.id,
        content: message.trim() || (attachmentType === "image" ? "📷 Image" : "🎤 Audio message"),
        attachment_type: attachmentType,
        attachment_url: attachmentUrl,
      });

      if (error) throw error;

      setMessage("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleAudioSend = async (audioBlob: Blob) => {
    try {
      setIsSending(true);
      const url = await uploadFile(audioBlob, "audio");
      await sendMessage("audio", url);
      toast.success("Audio message sent");
    } catch (error: any) {
      toast.error("Failed to send audio: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = async (file: File) => {
    try {
      setIsSending(true);
      const url = await uploadFile(file, "image");
      await sendMessage("image", url);
      toast.success("Image sent");
    } catch (error: any) {
      toast.error("Failed to send image: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="border-t p-4">
      <div className="flex gap-2">
        <div className="flex gap-1">
          <ImageUploader onImageSelect={handleImageSelect} disabled={isSending} />
          <AudioRecorder onSendAudio={handleAudioSend} disabled={isSending} />
        </div>
        <Textarea
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] resize-none flex-1"
          disabled={isSending}
        />
        <Button onClick={() => sendMessage()} disabled={isSending || !message.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
