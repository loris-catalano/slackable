-- Create security definer function to check if user is workspace admin
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role = 'admin'
  )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Workspace admins can manage members" ON public.workspace_members;

-- Create new policies using the security definer function
CREATE POLICY "Workspace admins can update members"
ON public.workspace_members
FOR UPDATE
USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can delete members"
ON public.workspace_members
FOR DELETE
USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can insert members"
ON public.workspace_members
FOR INSERT
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));