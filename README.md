# Chat-O-Matic (聊聊机) 🚀

一个专为青少年设计的 AI 聊天伙伴，采用 Neo-Brutalism 风格设计，由 Next.js 16 和 Google Gemini 驱动。

![Chat-O-Matic Preview](public/window.svg)

## ✨ 功能特性

- **Neo-Brutalism UI**：大胆边框、鲜艳色彩和厚重阴影，打造独特视觉体验
- **实时流式响应**：打字机效果，实时观看 AI 思考和回复
- **Markdown 渲染**：完整支持 Markdown 格式，包括表格、代码块和任务列表
- **Google Gemini**：由最新的 Gemini 3 Flash 模型驱动
- **响应式设计**：完美适配桌面端和移动端
- **青少年友好**：专为 10-16 岁好奇青少年优化的对话体验

## 🛠️ 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) + TypeScript
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI 组件**: [Radix UI](https://www.radix-ui.com/) & [Lucide React](https://lucide.dev/)
- **AI SDK**: [Vercel AI SDK 6](https://ai-sdk.dev/) + [@ai-sdk/google](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)
- **Markdown**: [react-markdown](https://github.com/remarkjs/react-markdown) & [remark-gfm](https://github.com/remarkjs/remark-gfm)

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm（推荐）
- Google AI Studio API Key（[获取地址](https://aistudio.google.com/apikey)）

### 安装步骤

1. 克隆仓库：

   ```bash
   git clone https://github.com/phoenixlwpapix/chat-o-matic.git
   cd chat-o-matic
   ```

2. 安装依赖：

   ```bash
   pnpm install
   ```

3. 配置环境变量：
   在项目根目录创建 `.env.local` 文件，添加你的 Gemini API Key：

   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
   ```

4. 启动开发服务器：

   ```bash
   pnpm dev
   ```

5. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)

## 🔧 配置选项

### 更换模型

在 `app/api/chat/route.ts` 中修改模型：

```typescript
model: google("gemini-3-flash-preview"), // 或其他可用模型
```

可用模型包括：
- `gemini-3-flash-preview` - 最新快速模型
- `gemini-2.0-flash` - 稳定快速模型  
- `gemini-1.5-pro` - 高性能模型

## 📝 License

MIT
