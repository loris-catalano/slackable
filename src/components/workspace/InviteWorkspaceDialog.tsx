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
import { Label } from "@/components/ui/label";
import { UserPlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface InviteWorkspaceDialogProps {
  workspaceId: string;
  workspaceName: string;
}

export const InviteWorkspaceDialog = ({ workspaceId, workspaceName }: InviteWorkspaceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  const addEmailField = () => {
    setEmails([...emails, ""]);
  };

  const removeEmailField = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendInvites = async () => {
    // Filter out empty emails and validate
    const validEmails = emails.filter(e => e.trim() !== "");
    const invalidEmails = validEmails.filter(e => !validateEmail(e));

    if (validEmails.length === 0) {
      toast.error("Please enter at least one email address");
      return;
    }

    if (invalidEmails.length > 0) {
      toast.error("Please enter valid email addresses");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("You must be logged in to send invites");
        return;
      }

      const response = await supabase.functions.invoke("send-workspace-invite", {
        body: {
          workspaceId,
          emails: validEmails,
        },
      });

      if (response.error) {
        console.error("Error sending invites:", response.error);
        toast.error("Failed to send invitations");
        return;
      }

      const { results } = response.data;
      const successCount = results.filter((r: any) => r.success).length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(`${successCount} invitation${successCount > 1 ? 's' : ''} sent successfully!`);
      }

      if (failureCount > 0) {
        toast.error(`Failed to send ${failureCount} invitation${failureCount > 1 ? 's' : ''}`);
      }

      // Reset form on success
      if (successCount === results.length) {
        setEmails([""]);
        setOpen(false);
      }
    } catch (error) {
      console.error("Error sending invites:", error);
      toast.error("An error occurred while sending invitations");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Members
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Members to {workspaceName}</DialogTitle>
          <DialogDescription>
            Send invitation emails to add new members to your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            {emails.map((email, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`email-${index}`}>
                    Email {emails.length > 1 ? `${index + 1}` : ""}
                  </Label>
                  <Input
                    id={`email-${index}`}
                    type="email"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                  />
                </div>
                {emails.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-8"
                    onClick={() => removeEmailField(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEmailField}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Another Email
          </Button>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSendInvites} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invitations"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
