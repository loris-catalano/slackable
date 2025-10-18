import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  onWorkspaceUpdated: () => void;
}

export const WorkspaceSettingsDialog = ({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  onWorkspaceUpdated,
}: WorkspaceSettingsDialogProps) => {
  const [newName, setNewName] = useState(workspaceName);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      toast.error("Workspace name cannot be empty");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: newName.trim() })
        .eq("id", workspaceId);

      if (error) throw error;

      toast.success("Workspace name updated!");
      onWorkspaceUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update workspace");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members" disabled>Members</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter workspace name"
              />
            </div>
            <Button 
              onClick={handleUpdateName} 
              disabled={isUpdating || newName.trim() === workspaceName}
              className="w-full"
            >
              {isUpdating ? "Updating..." : "Update Name"}
            </Button>
          </TabsContent>
          <TabsContent value="members" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Member management coming soon...
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
