import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ShareWorkspaceDialogProps {
  workspaceId: string;
  workspaceName: string;
}

export const ShareWorkspaceDialog = ({ workspaceId, workspaceName }: ShareWorkspaceDialogProps) => {
  const [copied, setCopied] = useState(false);
  const inviteLink = `${window.location.origin}/join/${workspaceId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Workspace</DialogTitle>
          <DialogDescription>
            Share this link with others to invite them to {workspaceName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={inviteLink}
              readOnly
              className="flex-1"
            />
            <Button onClick={copyToClipboard} size="icon">
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Anyone with this link can join the workspace.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
