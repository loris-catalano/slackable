import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseWebRTCProps {
  callId: string | null;
  isInitiator: boolean;
  otherUserId: string | null;
  onCallEnd: () => void;
}

export const useWebRTC = ({ callId, isInitiator, otherUserId, onCallEnd }: UseWebRTCProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) currentUserIdRef.current = user.id;
    };
    initUser();
  }, []);

  // Initialize WebRTC
  useEffect(() => {
    if (!callId || !otherUserId) return;

    const initWebRTC = async () => {
      try {
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        setLocalStream(stream);

        // Create peer connection
        const configuration: RTCConfiguration = {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        };
        const pc = new RTCPeerConnection(configuration);
        peerConnectionRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Handle remote stream
        pc.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
        };

        // Handle ICE candidates
        pc.onicecandidate = async (event) => {
          if (event.candidate && currentUserIdRef.current) {
            await supabase.from("call_signals").insert({
              call_id: callId,
              from_user_id: currentUserIdRef.current,
              to_user_id: otherUserId,
              signal_type: "ice-candidate",
              signal_data: event.candidate.toJSON() as any,
            });
          }
        };

        // Create offer if initiator
        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          if (currentUserIdRef.current) {
            await supabase.from("call_signals").insert({
              call_id: callId,
              from_user_id: currentUserIdRef.current,
              to_user_id: otherUserId,
              signal_type: "offer",
              signal_data: offer as any,
            });
          }
        }

        // Subscribe to signals
        const channel = supabase
          .channel(`call-signals-${callId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "call_signals",
              filter: `call_id=eq.${callId}`,
            },
            async (payload) => {
              const signal = payload.new;
              
              // Ignore own signals
              if (signal.from_user_id === currentUserIdRef.current) return;

              if (signal.signal_type === "offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                if (currentUserIdRef.current) {
                  await supabase.from("call_signals").insert({
                    call_id: callId,
                    from_user_id: currentUserIdRef.current,
                    to_user_id: otherUserId,
                    signal_type: "answer",
                    signal_data: answer as any,
                  });
                }
              } else if (signal.signal_type === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
              } else if (signal.signal_type === "ice-candidate") {
                await pc.addIceCandidate(new RTCIceCandidate(signal.signal_data));
              }
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Error initializing WebRTC:", error);
        toast.error("Failed to initialize call");
      }
    };

    initWebRTC();

    return () => {
      cleanup();
    };
  }, [callId, isInitiator, otherUserId]);

  const cleanup = () => {
    // Stop all tracks
    localStream?.getTracks().forEach((track) => track.stop());
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const endCall = async () => {
    if (callId && currentUserIdRef.current) {
      await supabase
        .from("calls")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", callId);
    }
    cleanup();
    onCallEnd();
  };

  return {
    localStream,
    remoteStream,
    isMuted,
    toggleMute,
    endCall,
  };
};
