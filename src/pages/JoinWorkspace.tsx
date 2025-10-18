import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export default function JoinWorkspace() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && workspaceId) {
      fetchWorkspace();
    }
  }, [user, workspaceId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/");
      return;
    }
    setUser(session.user);
  };

  const fetchWorkspace = async () => {
    try {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (error) throw error;
      setWorkspace(data);
    } catch (error: any) {
      toast.error("Workspace not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWorkspace = async () => {
    if (!workspace || !user) return;

    setJoining(true);
    try {
      const { error } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: "member",
        });

      if (error) {
        if (error.code === "23505") {
          toast.info("You're already a member of this workspace");
        } else {
          throw error;
        }
      } else {
        toast.success(`Joined ${workspace.name}!`);
      }

      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to join workspace");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Workspace</CardTitle>
          <CardDescription>
            You've been invited to join {workspace?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h3 className="font-semibold">{workspace?.name}</h3>
            <p className="text-sm text-muted-foreground">{workspace?.slug}</p>
          </div>
          <Button 
            onClick={handleJoinWorkspace} 
            disabled={joining}
            className="w-full"
          >
            {joining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Workspace"
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
            className="w-full"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
