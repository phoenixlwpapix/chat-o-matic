# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chat-O-Matic (聊聊机) is a Neo-Brutalism styled AI chat application designed for teenagers (ages 10-16), powered by Google Gemini 3 Flash. The app uses Next.js 16 App Router with React 19 and Vercel AI SDK 6.

## Commands

```bash
# Install dependencies
pnpm install

# Development (assumed always running - don't run this)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

## Environment Setup

Required environment variable in `.env.local`:
```
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

Get API key from: https://aistudio.google.com/apikey

## Architecture

### AI Streaming Architecture

- **Route Handler**: `app/api/chat/route.ts` handles POST requests with 30s max duration
- **AI Provider**: Uses `@ai-sdk/google` with `google("gemini-3-flash-preview")` model
- **Message Flow**: UI messages → `convertToModelMessages()` → Gemini → `toUIMessageStreamResponse()`
- **System Prompt**: Embedded in route handler, defines AI persona for 10-16 year old audience

### Frontend State Management

- **useChat Hook** (`@ai-sdk/react`): Manages messages, sendMessage, status, and setMessages
- **Message Format**: AI SDK 6 uses `message.parts[]` array structure (type: "text" | "file" | tool-call)
- **Image Upload**: Compresses images (max 1MB, 1024px) to base64 JPEG before sending as FileUIPart
- **Streaming Status**: `status === "streaming" || "submitted"` determines isLoading state

### Message Part Rendering

Messages use the AI SDK 6 `parts` structure:
- **Text parts**: Rendered with ReactMarkdown + remark-gfm + remark-math + rehype-katex
- **File parts**: Image preview for `mediaType.startsWith("image/")`
- **Markdown Normalization**: Converts `**"text"**` → `"**text**"` for proper rendering

### Styling Architecture

- **Tailwind CSS 4**: Uses `@theme inline` for CSS custom properties (no config file)
- **Neo-Brutalism Design**: Heavy borders (`border-2`/`border-4`), bold shadows (`shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`)
- **Component System**: Uses Radix UI primitives (Slot) with custom Neo-Brutalism styling
- **Typography**: Geist Sans/Mono fonts via `next/font/google`

### Component Structure

```
app/
├── layout.tsx          # Root layout with fonts and metadata
├── page.tsx            # Main chat UI (Client Component)
├── globals.css         # Tailwind v4 imports + theme variables
└── api/chat/route.ts   # Streaming AI endpoint

components/ui/          # Radix-based UI primitives
lib/utils.ts            # cn() utility for Tailwind class merging
```

### Key Features Implementation

1. **Quick Prompts**: Array of objects with icon, label, prompt, color - displayed when `messages.length === 0`
2. **Code Blocks**: Custom `CodeBlock` component with syntax highlighting (react-syntax-highlighter + oneDark theme) and copy button
3. **LaTeX Math**: Supported via remark-math + rehype-katex plugins
4. **Image Upload**: Max 4 images, compressed client-side, sent as data URLs
5. **Copy Functionality**: Both for full messages and individual code blocks with visual feedback

## Model Configuration

To change Gemini model, edit `app/api/chat/route.ts`:
```typescript
model: google("gemini-3-flash-preview")
// Available: gemini-2.0-flash, gemini-1.5-pro
```

System prompt is inline in the same file (lines 14-76).

## Styling Guidelines

- All components use Neo-Brutalism: thick borders, bold shadows, bright colors
- Interactive elements have active states: `active:translate-x-0.5 active:translate-y-0.5`
- No custom Tailwind config - use `@theme inline` in globals.css for tokens
- Icons from `lucide-react` only
