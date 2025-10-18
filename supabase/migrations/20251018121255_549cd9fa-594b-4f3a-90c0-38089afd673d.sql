-- Allow anyone to view workspace invites by token (needed for accepting invites before authentication)
CREATE POLICY "Anyone can view invites by token"
  ON public.workspace_invites
  FOR SELECT
  USING (true);