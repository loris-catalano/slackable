import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";

interface CallInterfaceProps {
  callId: string;
  isInitiator: boolean;
  otherUserId: string;
  otherUserName: string;
  onCallEnd: () => void;
}

export const CallInterface = ({
  callId,
  isInitiator,
  otherUserId,
  otherUserName,
  onCallEnd,
}: CallInterfaceProps) => {
  const { localStream, remoteStream, isMuted, toggleMute, endCall } = useWebRTC({
    callId,
    isInitiator,
    otherUserId,
    onCallEnd,
  });

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localAudioRef.current && localStream) {
      localAudioRef.current.srcObject = localStream;
      localAudioRef.current.muted = true; // Don't hear yourself
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">{otherUserName}</h2>
          <p className="text-sm text-muted-foreground">
            {remoteStream ? "Connected" : "Connecting..."}
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <span className="text-2xl">🎤</span>
            </div>
            <span className="text-xs text-muted-foreground">You</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <span className="text-2xl">{remoteStream ? "🔊" : "📞"}</span>
            </div>
            <span className="text-xs text-muted-foreground">{otherUserName}</span>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            variant={isMuted ? "destructive" : "secondary"}
            onClick={toggleMute}
            className="rounded-full h-14 w-14"
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          <Button
            size="lg"
            variant="destructive"
            onClick={endCall}
            className="rounded-full h-14 w-14"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        {/* Hidden audio elements */}
        <audio ref={localAudioRef} autoPlay />
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};
