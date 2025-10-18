-- Fix recursive RLS by using security definer functions
-- 1) Create helper functions that bypass RLS safely
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
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
  );
$$;

CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_members
    WHERE user_id = _user_id
      AND channel_id = _channel_id
  );
$$;

-- 2) Drop recursive policies and recreate using the helper functions
DROP POLICY IF EXISTS "Users can view workspace members they share a workspace with" ON public.workspace_members;
CREATE POLICY "Users can view workspace members they share a workspace with"
ON public.workspace_members
FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Users can view channel members for channels they're in" ON public.channel_members;
CREATE POLICY "Users can view channel members for channels they're in"
ON public.channel_members
FOR SELECT
USING (public.is_channel_member(auth.uid(), channel_id));