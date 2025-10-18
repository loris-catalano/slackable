import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceSelectorProps {
  onSelectWorkspace: (workspaceId: string) => void;
}

export const WorkspaceSelector = ({ onSelectWorkspace }: WorkspaceSelectorProps) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [ownedWorkspaceIds, setOwnedWorkspaceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWorkspaces();
    fetchOwnership();
  }, []);

  const fetchOwnership = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (data) {
      setOwnedWorkspaceIds(new Set(data.map(m => m.workspace_id)));
    }
  };

  const fetchWorkspaces = async () => {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading workspaces:", error);
      toast.error("Failed to load workspaces");
      return;
    }

    setWorkspaces(data || []);
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const slug = newWorkspaceName.toLowerCase().replace(/\s+/g, "-");
      
      const { data: workspaceId, error } = await supabase.rpc("create_workspace", {
        _name: newWorkspaceName,
        _slug: slug,
        _user_id: user.id,
      });

      if (error) throw error;

      toast.success("Workspace created!");
      setIsDialogOpen(false);
      setNewWorkspaceName("");
      fetchWorkspaces();
      onSelectWorkspace(workspaceId);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-2xl space-y-6 rounded-lg border bg-card p-8 shadow-lg">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Select a Workspace</h1>
          <p className="text-muted-foreground">Choose a workspace to get started</p>
        </div>

        <div className="grid gap-3">
          {workspaces.map((workspace) => (
            <Button
              key={workspace.id}
              variant="outline"
              className="h-auto justify-start p-4 text-left"
              onClick={() => onSelectWorkspace(workspace.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{workspace.name}</div>
                  {ownedWorkspaceIds.has(workspace.id) && (
                    <Badge variant="secondary" className="text-xs">Owner</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{workspace.slug}</div>
              </div>
            </Button>
          ))}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="default">
              <Plus className="mr-2 h-4 w-4" />
              Create New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  placeholder="My Team Workspace"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                />
              </div>
              <Button onClick={createWorkspace} disabled={isCreating} className="w-full">
                {isCreating ? "Creating..." : "Create Workspace"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
