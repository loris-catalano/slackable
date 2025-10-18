import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Users, Phone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DMReactions } from "./DMReactions";
import { AudioRecorder } from "../chat/AudioRecorder";
import { ImageUploader } from "../chat/ImageUploader";
import { MediaMessage } from "../chat/MediaMessage";
import { CallInterface } from "./CallInterface";
import { IncomingCallDialog } from "./IncomingCallDialog";

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  edited: boolean;
  attachment_type?: string | null;
  attachment_url?: string | null;
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
  targetMessageId?: string | null;
}

export const DMWindow = ({ conversationId, targetMessageId }: DMWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationName, setConversationName] = useState("");
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ id: string; isInitiator: boolean } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ id: string; callerId: string; callerName: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadConversation();
    loadMessages();
    setupRealtimeSubscription();
    setupCallSubscription();
    markAsRead();

    return () => {
      supabase.removeAllChannels();
    };
  }, [conversationId]);

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
      
      const element = messageRefs.current[targetMessageId];
      if (element) {
        element.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, 2000);
      }
    }
  };

  const setupCallSubscription = () => {
    const channel = supabase
      .channel(`calls-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const call = payload.new;
          
          // If receiving a call
          if (call.receiver_id === currentUserId && call.status === 'ringing') {
            // Get caller info
            const { data: callerData } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", call.caller_id)
              .single();
            
            setIncomingCall({
              id: call.id,
              callerId: call.caller_id,
              callerName: callerData?.display_name || "Unknown User"
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const call = payload.new;
          
          // If call ended
          if (call.status === 'ended') {
            setActiveCall(null);
            setIncomingCall(null);
          } else if (call.status === 'active' && call.caller_id === currentUserId) {
            // Caller side: call was accepted
            setIncomingCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

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

      // Get conversation members
      const { data: membersData, error: membersError } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (membersError) throw membersError;

      setConversation(convData);

      // Get the other user ID for 1:1 chats
      const otherMemberId = membersData?.find(m => m.user_id !== user.id)?.user_id;
      setOtherUserId(otherMemberId || null);

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
        .select("id, content, user_id, created_at, edited, attachment_type, attachment_url")
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

  const uploadFile = async (file: Blob, type: "audio" | "image"): Promise<string> => {
    if (!currentUserId) throw new Error("Not authenticated");

    const bucket = type === "audio" ? "chat-audio" : "chat-images";
    const fileExt = type === "audio" ? "webm" : "jpg";
    const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

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
    if ((!newMessage.trim() && !attachmentUrl) || !currentUserId) return;

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
          content: newMessage.trim() || (attachmentType === "image" ? "📷 Image" : "🎤 Audio message"),
          mentions: mentions.length > 0 ? mentions : [],
          attachment_type: attachmentType,
          attachment_url: attachmentUrl,
        });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleAudioSend = async (audioBlob: Blob) => {
    try {
      const url = await uploadFile(audioBlob, "audio");
      await sendMessage("audio", url);
      toast.success("Audio message sent");
    } catch (error: any) {
      toast.error("Failed to send audio: " + error.message);
    }
  };

  const handleImageSelect = async (file: File) => {
    try {
      const url = await uploadFile(file, "image");
      await sendMessage("image", url);
      toast.success("Image sent");
    } catch (error: any) {
      toast.error("Failed to send image: " + error.message);
    }
  };

  const startCall = async () => {
    if (!currentUserId || !otherUserId) return;

    try {
      const { data, error } = await supabase
        .from("calls")
        .insert({
          conversation_id: conversationId,
          caller_id: currentUserId,
          receiver_id: otherUserId,
          status: "ringing",
        })
        .select()
        .single();

      if (error) throw error;

      setActiveCall({ id: data.id, isInitiator: true });
      toast.success("Calling...");
    } catch (error: any) {
      console.error("Error starting call:", error);
      toast.error("Failed to start call");
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      await supabase
        .from("calls")
        .update({ status: "active" })
        .eq("id", incomingCall.id);

      setActiveCall({ id: incomingCall.id, isInitiator: false });
      setIncomingCall(null);
    } catch (error: any) {
      console.error("Error accepting call:", error);
      toast.error("Failed to accept call");
    }
  };

  const declineCall = async () => {
    if (!incomingCall) return;

    try {
      await supabase
        .from("calls")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", incomingCall.id);

      setIncomingCall(null);
    } catch (error: any) {
      console.error("Error declining call:", error);
      toast.error("Failed to decline call");
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
    <div className="flex flex-col h-screen">
      {/* Incoming Call Dialog */}
      {incomingCall && (
        <IncomingCallDialog
          isOpen={!!incomingCall}
          callerName={incomingCall.callerName}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {/* Active Call Interface */}
      {activeCall && otherUserId && (
        <CallInterface
          callId={activeCall.id}
          isInitiator={activeCall.isInitiator}
          otherUserId={otherUserId}
          otherUserName={conversationName}
          onCallEnd={() => setActiveCall(null)}
        />
      )}

      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        {conversation?.is_group ? (
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
        ) : (
          <Avatar className="h-10 w-10">
            <AvatarFallback>{getInitials(conversationName)}</AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1">
          <h2 className="font-semibold">{conversationName}</h2>
          {conversation?.is_group && (
            <p className="text-xs text-muted-foreground">Group chat</p>
          )}
        </div>
        {!conversation?.is_group && (
          <Button size="icon" variant="ghost" onClick={startCall}>
            <Phone className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div 
            key={message.id} 
            ref={(el) => messageRefs.current[message.id] = el}
            className="flex gap-3 items-start transition-colors"
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={message.profiles.avatar_url || undefined} />
              <AvatarFallback>
                {getInitials(message.profiles.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm">
                  {message.profiles.display_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.created_at), "h:mm a")}
                </span>
              </div>
              <p className="text-sm mt-1 break-words whitespace-pre-wrap">{message.content}</p>
              {message.attachment_type && message.attachment_url && (
                <div className="mt-2">
                  <MediaMessage
                    type={message.attachment_type as "image" | "audio"}
                    url={message.attachment_url}
                  />
                </div>
              )}
              {currentUserId && (
                <DMReactions dmId={message.id} currentUserId={currentUserId} />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <div className="flex gap-1">
            <ImageUploader onImageSelect={handleImageSelect} disabled={false} />
            <AudioRecorder onSendAudio={handleAudioSend} disabled={false} />
          </div>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={`Message ${conversationName}`}
            className="flex-1"
          />
          <Button onClick={() => sendMessage()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
