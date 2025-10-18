-- Create calls table for call metadata and state
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing', -- ringing, active, ended
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_signals table for WebRTC signaling
CREATE TABLE IF NOT EXISTS public.call_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  signal_type TEXT NOT NULL, -- offer, answer, ice-candidate
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- RLS policies for calls
CREATE POLICY "Users can view calls they're part of"
ON public.calls
FOR SELECT
USING (
  auth.uid() = caller_id OR auth.uid() = receiver_id
);

CREATE POLICY "Users can create calls"
ON public.calls
FOR INSERT
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Call participants can update calls"
ON public.calls
FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- RLS policies for call_signals
CREATE POLICY "Users can view signals for their calls"
ON public.call_signals
FOR SELECT
USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);

CREATE POLICY "Users can create signals"
ON public.call_signals
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

-- Enable realtime for call signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;