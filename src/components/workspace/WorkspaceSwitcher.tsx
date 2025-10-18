import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WorkspaceSwitcherProps {
  currentWorkspaceName: string;
}

export const WorkspaceSwitcher = ({ currentWorkspaceName }: WorkspaceSwitcherProps) => {
  const { currentWorkspaceId, setCurrentWorkspaceId, workspaces, loadWorkspaces, setIsTransitioning } = useWorkspace();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [ownedWorkspaceIds, setOwnedWorkspaceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
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
    fetchOwnership();
  }, [workspaces]);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceId === currentWorkspaceId) return;
    
    setIsTransitioning(true);
    setCurrentWorkspaceId(workspaceId);
    
    // Small delay to ensure state updates
    await new Promise(resolve => setTimeout(resolve, 100));
    setIsTransitioning(false);
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
      setIsCreateOpen(false);
      setNewWorkspaceName("");
      await loadWorkspaces();
      setIsTransitioning(true);
      setCurrentWorkspaceId(workspaceId);
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsTransitioning(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-12 w-full justify-between px-4 font-semibold hover:bg-sidebar-accent"
          >
            <span className="truncate">{currentWorkspaceName}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => handleSwitchWorkspace(workspace.id)}
              className={
                currentWorkspaceId === workspace.id 
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" 
                  : "bg-background text-foreground hover:bg-primary hover:text-primary-foreground"
              }
            >
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{workspace.name}</span>
                  {ownedWorkspaceIds.has(workspace.id) && (
                    <Badge variant="secondary" className="text-xs">Owner</Badge>
                  )}
                </div>
                <span className="text-xs opacity-70">{workspace.slug}</span>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
              />
            </div>
            <Button onClick={createWorkspace} disabled={isCreating} className="w-full">
              {isCreating ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
