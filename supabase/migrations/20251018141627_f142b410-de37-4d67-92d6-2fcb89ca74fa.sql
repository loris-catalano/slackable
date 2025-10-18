-- Fix RLS to allow DM creator to add the other member and read the new conversation immediately
DROP POLICY IF EXISTS "Conversation creators can add members" ON public.conversation_members;
CREATE POLICY "Conversation creators can add members"
ON public.conversation_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = conversation_members.conversation_id
      AND conversations.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators can view their created conversations" ON public.conversations;
CREATE POLICY "Creators can view their created conversations"
ON public.conversations
FOR SELECT
USING (created_by = auth.uid());