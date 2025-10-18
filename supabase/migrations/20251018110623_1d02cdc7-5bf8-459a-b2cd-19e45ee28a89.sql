-- Create workspace_invites table
CREATE TABLE public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Workspace members can view invites for their workspace
CREATE POLICY "Workspace members can view invites"
ON public.workspace_invites
FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

-- Workspace admins can create invites
CREATE POLICY "Workspace admins can create invites"
ON public.workspace_invites
FOR INSERT
WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

-- Invitees can view their own invites by email
CREATE POLICY "Users can view invites sent to their email"
ON public.workspace_invites
FOR SELECT
USING (
  auth.jwt() ->> 'email' = email
);

-- System can update invite status (for accepting invites)
CREATE POLICY "Users can update invites sent to their email"
ON public.workspace_invites
FOR UPDATE
USING (
  auth.jwt() ->> 'email' = email
);

-- Add trigger for updated_at
CREATE TRIGGER update_workspace_invites_updated_at
BEFORE UPDATE ON public.workspace_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_workspace_invites_token ON public.workspace_invites(token);
CREATE INDEX idx_workspace_invites_email ON public.workspace_invites(email);
CREATE INDEX idx_workspace_invites_workspace_id ON public.workspace_invites(workspace_id);