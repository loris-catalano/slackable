# Slackable

A minimal Slack-like team messenger built in just 6 hours during Lovable Hackathon 2025 in Milan.It supports workspaces, channels, direct messages, attachments, realtime updates, basic 1:1 voice calls, and email invites — all wired up with Supabase.

**Try it live:** [slackable.lovable.app](https://slackable.lovable.app)

## Features

- Workspaces and channel lists with quick switcher
- Public channels (auto-join on send) and channel creation
- Direct messages (1:1 and groups) with read markers
- Realtime messaging powered by Supabase Realtime
- Message reactions (channels and DMs)
- Global search across channel and DM messages
- Image and audio attachments (Supabase Storage)
- 1:1 voice calling (WebRTC) with incoming-call prompts
- Email invitations via a Supabase Edge Function + Brevo (Sendinblue)
- Profile basics and workspace membership management

Note: This is a hackathon project — fast, scrappy, and fun. Expect rough edges and missing hardening/edge cases.

## Tech Stack
 The project was fully vibe-coded with [Lovable](https://lovable.dev/), but this is what's inside:
- Frontend: Vite + React 18 + TypeScript
- UI: Tailwind CSS, shadcn/ui, Radix primitives, lucide-react icons
- State/Data: @tanstack/react-query, React Router
- Backend-as-a-Service: Supabase (Auth, Postgres, Realtime, Storage, Edge Functions)


## Notes and Limitations

- Private channels exist in the schema, but UI/permissions are minimal.
- Calling is 1:1 audio and relies on browser support + Supabase for signaling.
- Error handling and access controls are simplified for hackathon speed.