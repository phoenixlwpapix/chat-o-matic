# Chat-O-Matic (聊聊机) 🚀

Chat-O-Matic is a high-energy, neo-brutalism styled chatbot built with Next.js 16 and powered by OpenRouter.

![Chat-O-Matic Preview](public/window.svg) <!-- Placeholder for actual screenshot if available -->

## ✨ Features

- **Neo-Brutalism UI**: Bold borders, vibrant colors, and heavy shadows for a unique look.
- **Real-time Streaming**: Watch the AI think and respond in real-time.
- **Markdown Support**: Full support for markdown formatting, including tables and task lists.
- **OpenRouter Integration**: Powered by the latest models via OpenRouter (default: `xiaomi/mimo-v2-flash:free`).
- **Responsive Design**: Works great on both desktop and mobile.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) & [Lucide React](https://lucide.dev/)
- **AI SDK**: [OpenAI SDK](https://github.com/openai/openai-node) (via OpenRouter)
- **Markdown**: [react-markdown](https://github.com/remarkjs/react-markdown) & [remark-gfm](https://github.com/remarkjs/remark-gfm)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended)
- An OpenRouter API Key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/phoenixlwpapix/chat-o-matic.git
   cd chat-o-matic
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory and add your OpenRouter API key:

   ```env
   OPENROUTER_API_KEY=your_api_key_here
   ```

4. Run the development server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📝 License

MIT
