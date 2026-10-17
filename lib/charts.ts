import { z } from "zod";

const sourceSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: z.string().url().max(2000).refine((url) => /^https?:\/\//i.test(url)),
}).strict();

export const chartSchema = z.object({
  type: z.enum(["bar", "line", "donut"]),
  title: z.string().trim().min(1).max(100),
  unit: z.string().trim().max(20).default(""),
  dataKind: z.enum(["user", "example", "reference"]),
  source: sourceSchema.optional(),
  data: z.array(z.object({
    label: z.string().trim().min(1).max(60),
    value: z.number().finite().min(-1e12).max(1e12),
  }).strict()).min(1).max(24),
}).strict().superRefine((chart, ctx) => {
  if (chart.dataKind === "reference" && !chart.source) {
    ctx.addIssue({ code: "custom", message: "参考数据需要来源" });
  }
  if (chart.type === "donut" && (chart.data.some((point) => point.value < 0) || !chart.data.some((point) => point.value > 0))) {
    ctx.addIssue({ code: "custom", message: "环形图需要非负数据，且总和大于零" });
  }
  if (new Set(chart.data.map((point) => point.label)).size !== chart.data.length) {
    ctx.addIssue({ code: "custom", message: "标签不能重复" });
  }
});

export type ChartSpec = z.infer<typeof chartSchema>;

export function parseChart(raw: string): ChartSpec | null {
  if (raw.length > 12_000) return null;
  try {
    const result = chartSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export const CHART_PROMPT = `【图表】
用户要求画图，或数据比较、趋势、占比用图更易理解时，可在相关解释之后输出一个 chart 代码块（不要把 chart 代码块放进其他代码块），内容必须为严格 JSON：
\`\`\`chart
{"type":"bar","title":"每周阅读时间","unit":"分钟","dataKind":"example","data":[{"label":"周一","value":20},{"label":"周二","value":35}]}
\`\`\`
- type 只允许 bar（柱状比较）、line（有序趋势）、donut（占比）。每图仅一组数据，1–24 项，标签唯一，数值为有限数字且绝对值不超过 1e12；标题最多100字，标签最多60字，单位最多20字。
- dataKind 必填：user 表示用户提供的数据；example 表示虚构的教学示例，正文也须说明是示例；reference 表示真实参考数据，必须额外提供 source:{"title":"来源标题","url":"实际来源的 https 地址"}。不编造数据、链接或声称来源已核实。没有可靠数据时先说明缺失，不擅自替用户填数。
- donut 的数值不能为负，总和必须大于0；占比由前端计算。line 按时间或数值顺序排列，不用折线连接无序类别。
- 图表按需使用，通常一次回答最多两张；普通闲聊无需图表。不要输出 HTML、脚本、颜色或绘图代码。`;
