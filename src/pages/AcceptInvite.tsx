import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndInvite();
  }, [token]);

  const checkAuthAndInvite = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!token) {
        setError("Invalid invitation link");
        setLoading(false);
        return;
      }

      // Fetch invite details
      const { data: inviteData, error: inviteError } = await supabase
        .from("workspace_invites")
        .select("id, workspace_id, email, expires_at, status")
        .eq("token", token)
        .maybeSingle();

      if (inviteError || !inviteData) {
        console.error("Invite fetch error:", inviteError);
        setError("Invitation not found");
        setLoading(false);
        return;
      }

      // Fetch workspace details using public access (RLS allows viewing by invite token)
      // We'll get the workspace name from the invite join query instead
      const { data: fullInviteData } = await supabase
        .from("workspace_invites")
        .select(`
          id,
          workspace_id,
          email,
          expires_at,
          status,
          workspaces (
            name,
            slug
          )
        `)
        .eq("token", token)
        .maybeSingle();

      const workspaceData = fullInviteData?.workspaces || { name: "Unknown Workspace", slug: "" };

      // Combine the data
      const completeInvite = {
        ...inviteData,
        workspaces: workspaceData || { name: "Unknown Workspace", slug: "" }
      };

      // Check if invite is expired
      if (new Date(inviteData.expires_at) < new Date()) {
        setError("This invitation has expired");
        setLoading(false);
        return;
      }

      // Check if already accepted
      if (completeInvite.status === "accepted") {
        setError("This invitation has already been used");
        setLoading(false);
        return;
      }

      setInvite(completeInvite);

      // If user is authenticated and email matches, auto-accept
      if (user && user.email === completeInvite.email) {
        await acceptInvite(completeInvite);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error checking invite:", err);
      setError("An error occurred while checking the invitation");
      setLoading(false);
    }
  };

  const acceptInvite = async (inviteData?: any) => {
    const inviteToAccept = inviteData || invite;
    
    if (!inviteToAccept) return;

    setAccepting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to auth with return URL
        navigate(`/auth?redirect=/invite/${token}`);
        return;
      }

      // Check if email matches
      if (user.email !== inviteToAccept.email) {
        toast.error("This invitation was sent to a different email address");
        setAccepting(false);
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", inviteToAccept.workspace_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingMember) {
        toast.error("You're already a member of this workspace");
        navigate("/");
        return;
      }

      // Add user to workspace
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: inviteToAccept.workspace_id,
          user_id: user.id,
          role: "member",
        });

      if (memberError) {
        console.error("Error adding member:", memberError);
        toast.error("Failed to join workspace");
        setAccepting(false);
        return;
      }

      // Get all public channels in the workspace
      const { data: publicChannels } = await supabase
        .from("channels")
        .select("id")
        .eq("workspace_id", inviteToAccept.workspace_id)
        .eq("is_private", false);

      // Add user to all public channels
      if (publicChannels && publicChannels.length > 0) {
        const channelMemberships = publicChannels.map(channel => ({
          channel_id: channel.id,
          user_id: user.id,
        }));

        const { error: channelError } = await supabase
          .from("channel_members")
          .insert(channelMemberships);

        if (channelError) {
          console.error("Error adding to channels:", channelError);
          // Don't fail the whole process if channel addition fails
        }
      }

      // Mark invite as accepted
      await supabase
        .from("workspace_invites")
        .update({ status: "accepted" })
        .eq("id", inviteToAccept.id);

      toast.success(`Welcome to ${inviteToAccept.workspaces.name}!`);
      
      // Redirect to workspace
      navigate(`/?workspace=${inviteToAccept.workspace_id}`);
    } catch (err) {
      console.error("Error accepting invite:", err);
      toast.error("An error occurred while joining the workspace");
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Invalid Invitation</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Join {invite?.workspaces?.name}</CardTitle>
            <CardDescription>
              You've been invited to join this workspace. Please sign in or create an account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invited email: <strong>{invite?.email}</strong>
            </p>
            <Button
              onClick={() => navigate(`/auth?redirect=/invite/${token}`)}
              className="w-full"
            >
              Sign In / Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <CardTitle>Join {invite?.workspaces?.name}</CardTitle>
          </div>
          <CardDescription>
            You've been invited to join this workspace!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click the button below to accept the invitation and start collaborating with your team.
          </p>
          <Button
            onClick={() => acceptInvite()}
            disabled={accepting}
            className="w-full"
          >
            {accepting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
