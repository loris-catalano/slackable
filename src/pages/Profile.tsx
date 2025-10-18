import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";
import { ArrowLeft, Mail, Calendar, Building2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: string | null;
  status_text: string | null;
  status_emoji: string | null;
  bio: string | null;
  timezone: string | null;
  created_at: string;
}

interface WorkspaceMembership {
  role: string;
  created_at: string;
  workspace: {
    name: string;
    slug: string;
  };
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchWorkspaces();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("workspace_members")
        .select(`
          role,
          created_at,
          workspace:workspaces(name, slug)
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      setWorkspaces(data as any);
    } catch (error: any) {
      console.error("Failed to load workspaces:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) return null;

  const getInitials = () => {
    if (profile.full_name) {
      return profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (profile.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    return profile.email.slice(0, 2).toUpperCase();
  };

  const getStatusColor = () => {
    switch (profile.status) {
      case "active":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "offline":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-muted p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatar_url || ""} />
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute bottom-0 right-0 h-6 w-6 rounded-full border-4 border-card ${getStatusColor()}`} />
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    {profile.full_name || profile.display_name || "Unknown User"}
                  </CardTitle>
                  {profile.display_name && profile.full_name !== profile.display_name && (
                    <p className="text-muted-foreground">@{profile.display_name}</p>
                  )}
                  {profile.status_emoji && profile.status_text && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-lg">{profile.status_emoji}</span>
                      <span>{profile.status_text}</span>
                    </div>
                  )}
                </div>
              </div>
              <EditProfileDialog profile={profile} onUpdate={fetchProfile} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {profile.bio && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">About</h3>
                <p className="text-sm text-muted-foreground">{profile.bio}</p>
              </div>
            )}

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="text-sm">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Timezone</p>
                  <p className="text-sm">{profile.timezone || "Not set"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Joined</p>
                  <p className="text-sm">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {workspaces.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Workspaces</h3>
                  </div>
                  <div className="space-y-3">
                    {workspaces.map((ws: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{ws.workspace.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {ws.workspace.slug}
                          </p>
                        </div>
                        <Badge variant={ws.role === "admin" ? "default" : "secondary"}>
                          {ws.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
