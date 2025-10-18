import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, ExternalLink } from "lucide-react";

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
}

export const QuickProfileCard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data);
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  };

  const getInitials = () => {
    if (!profile) return "U";
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
    if (!profile) return "bg-gray-400";
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start p-0">
          <div className="flex w-full items-center gap-2 px-2 py-1.5">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar ${getStatusColor()}`} />
            </div>
            <div className="flex-1 truncate text-left">
              <p className="truncate text-sm font-medium">
                {profile?.display_name || profile?.email || "User"}
              </p>
            </div>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="right" align="end">
        {profile && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.avatar_url || ""} />
                  <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
                </Avatar>
                <div className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-popover ${getStatusColor()}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">
                  {profile.full_name || profile.display_name || "Unknown User"}
                </h3>
                {profile.display_name && profile.full_name !== profile.display_name && (
                  <p className="text-sm text-muted-foreground truncate">
                    @{profile.display_name}
                  </p>
                )}
              </div>
            </div>

            {profile.status_emoji && profile.status_text && (
              <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
                <span className="text-lg">{profile.status_emoji}</span>
                <span className="text-sm truncate">{profile.status_text}</span>
              </div>
            )}

            {profile.bio && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {profile.bio}
              </p>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{profile.email}</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(false);
                navigate("/profile");
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Full Profile
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
