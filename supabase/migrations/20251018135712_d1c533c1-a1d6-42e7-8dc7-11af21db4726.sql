-- Allow users to delete their own membership (leave a workspace)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'workspace_members' 
      AND policyname = 'Users can leave workspace'
  ) THEN
    CREATE POLICY "Users can leave workspace"
    ON public.workspace_members
    FOR DELETE
    USING (user_id = auth.uid());
  END IF;
END $$;