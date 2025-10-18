-- Add attachment support to messages table
ALTER TABLE public.messages
ADD COLUMN attachment_type TEXT,
ADD COLUMN attachment_url TEXT;

-- Add attachment support to direct_messages table
ALTER TABLE public.direct_messages
ADD COLUMN attachment_type TEXT,
ADD COLUMN attachment_url TEXT;

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true);

-- Create storage bucket for chat audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audio', 'chat-audio', true);

-- RLS policies for chat-images bucket
CREATE POLICY "Users can upload images to their chats"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view chat images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');

CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policies for chat-audio bucket
CREATE POLICY "Users can upload audio to their chats"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-audio'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view chat audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-audio');

CREATE POLICY "Users can delete their own audio"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);