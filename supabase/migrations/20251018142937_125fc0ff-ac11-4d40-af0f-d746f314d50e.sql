-- Create dm_reactions table for direct message reactions
CREATE TABLE IF NOT EXISTS public.dm_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dm_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dm_id, user_id, emoji)
);

-- Enable Row Level Security
ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions on accessible DMs
CREATE POLICY "Users can view reactions on accessible DMs"
ON public.dm_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM direct_messages dm
    INNER JOIN conversation_members cm ON cm.conversation_id = dm.conversation_id
    WHERE dm.id = dm_reactions.dm_id
    AND cm.user_id = auth.uid()
  )
);

-- Users can add reactions to accessible DMs
CREATE POLICY "Users can add reactions to accessible DMs"
ON public.dm_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM direct_messages dm
    INNER JOIN conversation_members cm ON cm.conversation_id = dm.conversation_id
    WHERE dm.id = dm_reactions.dm_id
    AND cm.user_id = auth.uid()
  )
);

-- Users can remove their own reactions
CREATE POLICY "Users can remove their own DM reactions"
ON public.dm_reactions
FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_reactions;