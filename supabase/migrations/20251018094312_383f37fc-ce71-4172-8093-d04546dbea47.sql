-- Create a secure function to create a workspace + membership + default channel atomically
CREATE OR REPLACE FUNCTION public.create_workspace(_name text, _slug text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_channel_id uuid;
BEGIN
  INSERT INTO public.workspaces (name, slug)
  VALUES (_name, _slug)
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, _user_id, 'admin');

  INSERT INTO public.channels (workspace_id, name, description, created_by)
  VALUES (v_workspace_id, 'general', 'General discussion', _user_id)
  RETURNING id INTO v_channel_id;

  INSERT INTO public.channel_members (channel_id, user_id)
  VALUES (v_channel_id, _user_id);

  RETURN v_workspace_id;
END;
$$;

-- Harden existing timestamp function per linter (set immutable search_path)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;