import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

interface AudioRecorderProps {
  onSendAudio: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export const AudioRecorder = ({ onSendAudio, disabled }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const discardRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const sendRecording = () => {
    if (audioBlob) {
      onSendAudio(audioBlob);
      setAudioBlob(null);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1" />
        <Button size="icon" variant="ghost" onClick={discardRecording}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button size="icon" onClick={sendRecording}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <>
          <span className="text-sm text-muted-foreground">{formatTime(recordingTime)}</span>
          <Button
            size="icon"
            variant="destructive"
            onClick={stopRecording}
            className="animate-pulse"
          >
            <Square className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          onClick={startRecording}
          disabled={disabled}
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
