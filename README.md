# Chat-O-Matic (聊聊机) 🚀

一个专为青少年设计的 AI 聊天伙伴，采用 Neo-Brutalism 风格设计，由 Next.js 16 和 Google Gemini 驱动。

![Chat-O-Matic Preview](public/window.svg)

## ✨ 功能特性

- **Neo-Brutalism UI**：大胆边框、鲜艳色彩和厚重阴影，打造独特视觉体验
- **实时流式响应**：打字机效果，实时观看 AI 思考和回复
- **Markdown 渲染**：完整支持 Markdown 格式，包括表格、代码块和任务列表
- **Google Gemini**：由 Gemini 3.5 Flash-Lite 模型驱动
- **AI 人设切换**：5 种个性鲜明的聊天角色（学习伙伴、科学怪博士、冒险故事家、哲学喵、吐槽达人），随时切换不同风格的对话体验
- **人设专属开场卡片**：20 张快捷卡片按学习辅导、科学探究、互动叙事、哲思交流和轻松吐槽重新分工，并强化实验安全与连续互动
- **紧凑对话设置**：学习伙伴可配置四种学习模式与联网方式；其他人设固定为自由闲聊，仅显示联网设置。选择会立即保存为浏览器默认值，也会随历史会话保存和恢复
- **联网控制**：在对话设置中选择自动联网、强制联网或关闭联网，并明确标识每次回复是否使用了联网参考
- **统一回复操作栏**：一键简化、举例、总结、出题或联网检查事实，并集中提供重新生成与复制
- **人设历史记录**：每段历史对话会保存并显示当时使用的人设，恢复对话时自动切回对应角色
- **可靠重新生成**：重新生成图片对话时会保留原始图片和对应人设
- **按需代码高亮**：仅在回复出现代码块时加载 Prism，减少普通聊天的初始脚本
- **质量保障**：API 请求校验与历史人设迁移均有自动化测试覆盖
- **多主题配色**：Sunflower / Ocean / Peach 三套 Neo-Brutalism 主题自由切换；Ocean 采用午夜海沟与生物荧光配色，并优化深色界面对比度
- **接口防护**：严格校验消息、图片和请求体，并通过 Vercel WAF 执行跨实例限流
- **响应式设计**：完美适配桌面端和移动端
- **青少年友好**：专为 10-16 岁好奇青少年优化的对话体验

## 🛠️ 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) + TypeScript
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **字体**: Noto Sans SC 可变字体用于中文界面，Geist Mono 用于代码；通过 `next/font` 自托管
- **UI 组件**: [Radix UI](https://www.radix-ui.com/) & [Lucide React](https://lucide.dev/)
- **AI SDK**: [Vercel AI SDK 6](https://ai-sdk.dev/) + [@ai-sdk/google](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)
- **Markdown**: [react-markdown](https://github.com/remarkjs/react-markdown) & [remark-gfm](https://github.com/remarkjs/remark-gfm)

## 🚀 快速开始

### 前置要求

- Node.js 20.9+
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
model: google("gemini-3.5-flash-lite"), // 或其他可用模型
```

可用模型包括：

- `gemini-3.5-flash-lite` - 低延迟、低成本的稳定模型（当前使用）

### 生产限流

Vercel 项目已配置 `Chat API rate limit` WAF 规则：

- 路径：`/api/chat`
- 维度：客户端 IP
- 限额：每小时 30 次
- 超限动作：Rate Limit，持续 1 小时

应用内限流只是二次防护；新建 Vercel 项目时必须同步配置上述 WAF 规则。

### 请求限制

- 请求体最大 4 MiB
- 最多 40 条历史消息
- 单条用户消息最多 3000 字符
- 每条消息最多 4 张图片
- 单张图片最大 1 MiB，仅允许 JPEG、PNG、WebP 和 GIF

历史记录使用 schema v2，并为旧数据自动补充默认学习模式和联网模式。非学习伙伴的历史记录会统一保存为自由闲聊，避免恢复会话时误用教学策略；学习伙伴仍会恢复该会话保存的学习模式。最近选择的学习与联网模式另存于 `chat-o-matic-preferences`，刷新页面和新建对话时继续沿用。

## ✅ 质量检查

```bash
pnpm lint
pnpm test
pnpm build
pnpm audit --prod
```

## 📝 License

MIT
