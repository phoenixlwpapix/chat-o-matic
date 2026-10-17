"use client";

import { useId, useState } from "react";
import { BarChart3, ExternalLink, Table2 } from "lucide-react";
import { parseChart, type ChartSpec } from "@/lib/charts";

const COLORS = ["var(--qp-1)", "var(--qp-2)", "var(--qp-3)", "var(--qp-4)"];
const format = (value: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
const axisFormat = (value: number) => new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const KINDS = { user: "用户数据", example: "示例数据", reference: "参考数据" };

function ChartView({ chart }: { chart: ChartSpec }) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const values = chart.data.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const width = Math.max(420, chart.data.length * 52 + 90);
  const left = 70;
  const right = width - 24;
  const top = 28;
  const bottom = 218;
  const y = (value: number) => bottom - ((value - min) / span) * (bottom - top);
  const step = (right - left) / chart.data.length;
  const x = (index: number) => left + step * (index + 0.5);
  const total = values.reduce((sum, value) => sum + value, 0);
  const selected = active === null ? null : chart.data[active];

  return (
    <>
      <div className="overflow-x-auto" tabIndex={0} aria-label="图表，可横向滚动；使用 Tab 选择数据点">
        <svg role="group" aria-labelledby={titleId} viewBox={chart.type === "donut" ? "0 0 420 260" : `0 0 ${width} 270`} className="block h-auto w-full" style={{ minWidth: chart.type === "donut" ? 240 : width }}>
          <title id={titleId}>{chart.title}</title>
          {chart.type === "donut" ? (
            <>
              <circle cx="210" cy="126" r="80" fill="none" stroke="var(--fb-inactive-border)" strokeWidth="32" />
              {chart.data.map((point, index) => {
                const fraction = point.value / total;
                const offset = values.slice(0, index).reduce((sum, value) => sum + value, 0) / total;
                return <circle key={point.label} cx="210" cy="126" r="80" fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={active === index ? 40 : 32} pathLength="1" strokeDasharray={`${fraction} ${1 - fraction}`} strokeDashoffset={-offset} transform="rotate(-90 210 126)" tabIndex={0} role="img" aria-label={`${point.label}：${format(point.value)}${chart.unit}，${format(fraction * 100)}%`} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onClick={() => setActive(index)} className="cursor-pointer focus-visible:outline-2">
                  <title>{`${point.label}：${format(point.value)}${chart.unit}（${format(fraction * 100)}%）`}</title>
                </circle>;
              })}
              <text x="210" y="122" textAnchor="middle" fill="currentColor" fontSize="12">合计{chart.unit ? ` · ${chart.unit}` : ""}</text>
              <text x="210" y="148" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="900">{axisFormat(total)}</text>
            </>
          ) : (
            <>
              {[0, 1, 2, 3, 4].map((tick) => {
                const value = min + (span * tick) / 4;
                return <g key={tick}>
                  <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="var(--fb-inactive-border)" strokeDasharray="4 4" />
                  <text x={left - 10} y={y(value) + 4} textAnchor="end" fontSize="11" fill="currentColor">{axisFormat(value)}</text>
                </g>;
              })}
              <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="currentColor" />
              {chart.type === "line" && <polyline points={chart.data.map((point, index) => `${x(index)},${y(point.value)}`).join(" ")} fill="none" stroke="var(--qp-1)" strokeWidth="3" strokeLinejoin="round" />}
              {chart.data.map((point, index) => {
                const handlers = { tabIndex: 0, role: "img", "aria-label": `${point.label}：${format(point.value)}${chart.unit}`, onFocus: () => setActive(index), onBlur: () => setActive(null), onMouseEnter: () => setActive(index), onMouseLeave: () => setActive(null), onClick: () => setActive(index) };
                return <g key={point.label}>
                  {chart.type === "bar" ? <rect {...handlers} x={x(index) - step * 0.28} y={Math.min(y(0), y(point.value))} width={step * 0.56} height={Math.max(2, Math.abs(y(point.value) - y(0)))} rx="3" fill={COLORS[index % COLORS.length]} stroke="currentColor" strokeWidth={active === index ? 3 : 1} className="cursor-pointer"><title>{`${point.label}：${format(point.value)}${chart.unit}`}</title></rect> : <circle {...handlers} cx={x(index)} cy={y(point.value)} r={active === index ? 7 : 5} fill="var(--qp-1)" stroke="currentColor" strokeWidth="2" className="cursor-pointer"><title>{`${point.label}：${format(point.value)}${chart.unit}`}</title></circle>}
                  <text x={x(index)} y={bottom + 24} textAnchor="middle" fontSize="11" fill="currentColor"><title>{point.label}</title>{point.label.length > 5 ? `${point.label.slice(0, 4)}…` : point.label}</text>
                </g>;
              })}
            </>
          )}
        </svg>
      </div>
      <div className="min-h-8 text-center text-xs font-bold" aria-live="polite">
        {selected ? `${selected.label}：${format(selected.value)}${chart.unit}${chart.type === "donut" ? ` · ${format(selected.value / total * 100)}%` : ""}` : "点击或悬停图形查看数值"}
      </div>
      {chart.type === "donut" && <ul className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-2 p-0 text-xs">
        {chart.data.map((point, index) => <li key={point.label} className="m-0 flex min-w-0 items-center gap-1.5 p-0"><span className="h-2.5 w-2.5 shrink-0 rounded-sm border" style={{ background: COLORS[index % COLORS.length] }} /><span className="break-all">{point.label} · {format(point.value / total * 100)}%</span></li>)}
      </ul>}
    </>
  );
}

export function ChatChart({ raw, pending }: { raw: string; pending: boolean }) {
  const chart = pending ? null : parseChart(raw);
  if (!chart) return <div className="not-prose my-4 rounded-xl border-2 border-dashed p-4 text-sm" role="status" style={{ borderColor: "var(--fb-inactive-border)" }}>
    {pending ? "图表生成中…" : "这张图的数据格式不完整或不支持，请让助手重新生成图表。"}
  </div>;

  return <section className="not-prose my-4 min-w-0 overflow-hidden rounded-xl border-2" aria-label={chart.title} style={{ borderColor: "var(--border-color)", background: "var(--card-bg)", color: "var(--ai-bubble-text)", boxShadow: "3px 3px 0 rgba(var(--shadow-color), 1)" }}>
    <div className="flex items-start justify-between gap-3 border-b-2 px-3 py-3" style={{ borderColor: "var(--border-color)", background: "var(--card-footer-bg)" }}>
      <div className="flex min-w-0 items-start gap-2"><BarChart3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words text-sm font-black">{chart.title}</span></div>
      <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold">{KINDS[chart.dataKind]}</span>
    </div>
    <div className="p-3">
      {chart.unit && chart.type !== "donut" && <div className="text-xs opacity-75">单位：{chart.unit}</div>}
      <ChartView chart={chart} />
      {chart.source && <a href={chart.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1 break-all text-xs underline" style={{ color: "var(--source-text)" }}>来源：{chart.source.title}<ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" /></a>}
      <details className="mt-3 border-t pt-2" style={{ borderColor: "var(--fb-inactive-border)" }}>
        <summary className="cursor-pointer text-xs font-bold"><Table2 aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />查看数据</summary>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">{chart.title}的数据</caption><thead><tr><th scope="col" className="p-2">项目</th><th scope="col" className="p-2 text-right">数值{chart.unit ? `（${chart.unit}）` : ""}</th></tr></thead><tbody>{chart.data.map((point) => <tr key={point.label} className="border-t" style={{ borderColor: "var(--fb-inactive-border)" }}><th scope="row" className="break-all p-2 font-medium">{point.label}</th><td className="p-2 text-right tabular-nums">{format(point.value)}</td></tr>)}</tbody></table></div>
      </details>
    </div>
  </section>;
}
