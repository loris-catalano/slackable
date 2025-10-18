import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface LeaveWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  onWorkspaceLeft?: () => void;
}

export const LeaveWorkspaceDialog = ({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  onWorkspaceLeft,
}: LeaveWorkspaceDialogProps) => {
  const navigate = useNavigate();
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeaveWorkspace = async () => {
    setIsLeaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Remove user from workspace
      const { error: memberError } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id);

      if (memberError) throw memberError;

      // Remove user from all channels in the workspace
      const { data: channels } = await supabase
        .from("channels")
        .select("id")
        .eq("workspace_id", workspaceId);

      if (channels && channels.length > 0) {
        const { error: channelError } = await supabase
          .from("channel_members")
          .delete()
          .eq("user_id", user.id)
          .in("channel_id", channels.map(c => c.id));

        if (channelError) console.error("Error removing from channels:", channelError);
      }

      toast.success(`Left ${workspaceName} successfully`);
      onOpenChange(false);
      
      if (onWorkspaceLeft) {
        onWorkspaceLeft();
      } else {
        // Navigate to home if no callback provided
        navigate("/");
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Error leaving workspace:", error);
      toast.error(error.message || "Failed to leave workspace");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Workspace</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to leave <strong>{workspaceName}</strong>? 
            You will no longer have access to its channels and messages. 
            You can rejoin if invited again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeaveWorkspace}
            disabled={isLeaving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLeaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Leaving...
              </>
            ) : (
              "Leave Workspace"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
