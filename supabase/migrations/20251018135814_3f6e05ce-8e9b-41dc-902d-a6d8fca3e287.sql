-- Create conversations table for 1:1 and group DMs
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create conversation members table
CREATE TABLE public.conversation_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, user_id)
);

-- Create direct messages table
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  edited BOOLEAN NOT NULL DEFAULT false,
  mentions UUID[] DEFAULT ARRAY[]::UUID[]
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations they're part of"
ON public.conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = conversations.id
    AND conversation_members.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Conversation members can update conversations"
ON public.conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = conversations.id
    AND conversation_members.user_id = auth.uid()
  )
);

-- RLS Policies for conversation_members
CREATE POLICY "Users can view members of their conversations"
ON public.conversation_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add themselves to conversations"
ON public.conversation_members
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own membership"
ON public.conversation_members
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can leave conversations"
ON public.conversation_members
FOR DELETE
USING (user_id = auth.uid());

-- RLS Policies for direct_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.direct_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = direct_messages.conversation_id
    AND conversation_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to their conversations"
ON public.direct_messages
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = direct_messages.conversation_id
    AND conversation_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages"
ON public.direct_messages
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
ON public.direct_messages
FOR DELETE
USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_conversation_members_conversation_id ON public.conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX idx_direct_messages_conversation_id ON public.direct_messages(conversation_id);
CREATE INDEX idx_direct_messages_created_at ON public.direct_messages(created_at DESC);

-- Create trigger to update conversation updated_at and last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now(), last_message_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();

-- Enable realtime for direct messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;