import { BookOpenCheck } from "lucide-react";

export function QuizSkeleton({ stage = "generating" }: { stage?: "generating" | "validating" }) {
  return <section role="status" aria-live="polite" aria-busy="true" aria-label={stage === "validating" ? "正在核对答案" : "题目生成中"} className="my-4 min-w-0 overflow-hidden rounded-xl border-2" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)", boxShadow: "3px 3px 0 rgba(var(--shadow-color), 1)" }}>
    <header className="flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-black" style={{ borderColor: "var(--border-color)", background: "var(--card-footer-bg)" }}><BookOpenCheck aria-hidden="true" className="h-4 w-4" />{stage === "validating" ? "正在核对答案" : "题目生成中"}</header>
    <div aria-hidden="true" className="space-y-4 p-3 motion-safe:animate-pulse">
      <div className="space-y-2"><div className="h-4 w-5/6 rounded" style={{ background: "var(--fb-inactive-border)" }} /><div className="h-4 w-2/3 rounded" style={{ background: "var(--fb-inactive-border)" }} /></div>
      <div className="space-y-2">{[0, 1, 2, 3].map((index) => <div key={index} className="flex min-h-12 items-center gap-3 rounded-lg border-2 px-3 py-2" style={{ borderColor: "var(--fb-inactive-border)" }}><div className="h-6 w-6 shrink-0 rounded" style={{ background: "var(--fb-inactive-border)" }} /><div className="h-3 w-1/2 rounded" style={{ background: "var(--fb-inactive-border)" }} /></div>)}</div>
    </div>
  </section>;
}
