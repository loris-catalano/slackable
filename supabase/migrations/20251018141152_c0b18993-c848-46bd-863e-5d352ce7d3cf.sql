-- Create a security definer function to check conversation membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
  );
$$;

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view conversations they're part of" ON public.conversations;
DROP POLICY IF EXISTS "Conversation members can update conversations" ON public.conversations;

-- Recreate conversation_members SELECT policy without recursion
CREATE POLICY "Users can view members of their conversations"
ON public.conversation_members
FOR SELECT
USING (is_conversation_member(auth.uid(), conversation_id));

-- Recreate conversations policies using the function
CREATE POLICY "Users can view conversations they're part of"
ON public.conversations
FOR SELECT
USING (is_conversation_member(auth.uid(), id));

CREATE POLICY "Conversation members can update conversations"
ON public.conversations
FOR UPDATE
USING (is_conversation_member(auth.uid(), id));