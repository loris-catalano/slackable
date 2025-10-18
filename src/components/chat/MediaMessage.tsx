import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaMessageProps {
  type: "image" | "audio";
  url: string;
}

export const MediaMessage = ({ type, url }: MediaMessageProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  if (type === "image") {
    return (
      <>
        <div
          className="relative cursor-pointer max-w-sm rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
          onClick={() => setIsDialogOpen(true)}
        >
          <img
            src={url}
            alt="Uploaded image"
            className="w-full h-auto"
            loading="lazy"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <img src={url} alt="Full size image" className="w-full h-auto" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (type === "audio") {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-sm">
        <audio
          src={url}
          onLoadedMetadata={(e) => {
            const audio = e.target as HTMLAudioElement;
            setDuration(audio.duration);
          }}
          onTimeUpdate={(e) => {
            const audio = e.target as HTMLAudioElement;
            setCurrentTime(audio.currentTime);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
          id={`audio-${url}`}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            const audio = document.getElementById(`audio-${url}`) as HTMLAudioElement;
            if (isPlaying) {
              audio.pause();
            } else {
              audio.play();
            }
          }}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="flex-1">
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
