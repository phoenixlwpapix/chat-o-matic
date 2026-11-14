"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import { FlaskConical, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPendulumSurface } from "@/lib/pendulum-surface";
import {
  createPendulumUpdate, formatPendulumLength, pendulumAngle, pendulumLengthSchema, pendulumPeriod,
  PENDULUM_AMPLITUDE, PENDULUM_DURATION, PENDULUM_GRAVITY, PENDULUM_MAX_LENGTH, PENDULUM_MIN_LENGTH, PENDULUM_PATH,
  type PendulumUpdate,
} from "@/lib/pendulum";

export function ChatPendulum({ update, disabled, onLengthCommit, onExplain }: {
  update: PendulumUpdate;
  disabled: boolean;
  onLengthCommit: (lengthCm: number) => void;
  onExplain: (lengthCm: number) => void;
}) {
  const titleId = useId();
  const sliderId = useId();
  const [bridge] = useState(() => createPendulumSurface(update));
  const subscribe = useCallback((onChange: () => void) => {
    const subscription = bridge.surface.dataModel.subscribe(PENDULUM_PATH, onChange);
    return () => subscription.unsubscribe();
  }, [bridge]);
  const getLength = useCallback(() => bridge.surface.dataModel.get<number>(PENDULUM_PATH), [bridge]);
  const lengthCm = useSyncExternalStore(subscribe, getLength);
  const lengthLabel = formatPendulumLength(lengthCm);
  const period = pendulumPeriod(lengthCm);

  useEffect(() => {
    const subscription = bridge.surface.onAction.subscribe(({ name, context }) => {
      const length = pendulumLengthSchema.safeParse(context.lengthCm);
      if (name === "explain" && length.success) onExplain(length.data);
    });
    return () => subscription.unsubscribe();
  }, [bridge, onExplain]);

  function commitLength(input: HTMLInputElement) {
    if (!disabled && input.valueAsNumber !== update.updateDataModel.value) onLengthCommit(input.valueAsNumber);
  }

  return (
    <section aria-labelledby={titleId} className="w-full min-w-0 max-w-[780px] rounded-xl border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--ai-bubble-text)] shadow-[3px_3px_0_rgba(var(--shadow-color),1)]">
      <header className="rounded-t-[10px] border-b-2 border-[var(--border-color)] bg-[var(--settings-selected-bg)] px-4 py-2.5">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-black"><FlaskConical aria-hidden="true" className="size-4 shrink-0" />单摆实验</h2>
      </header>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <div className="flex justify-between gap-3 text-sm font-bold">
              <label htmlFor={sliderId}>摆长</label>
              <span className="tabular-nums">{lengthLabel} 米</span>
            </div>
            <input id={sliderId} type="range" min={PENDULUM_MIN_LENGTH} max={PENDULUM_MAX_LENGTH} step={1} value={lengthCm} aria-valuetext={`${lengthLabel} 米`} disabled={disabled}
              onChange={(event) => bridge.processor.processMessages(createPendulumUpdate(event.currentTarget.valueAsNumber))}
              onPointerUp={(event) => commitLength(event.currentTarget)}
              onKeyUp={(event) => commitLength(event.currentTarget)}
              onBlur={(event) => commitLength(event.currentTarget)}
              className="block h-11 w-full cursor-pointer accent-[var(--qp-3)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default" />
          </div>
          <div className="flex items-baseline gap-3 rounded-lg border border-[var(--fb-inactive-border)] bg-[var(--card-footer-bg)] px-3 py-2 sm:min-w-36">
            <span className="text-sm font-bold">周期</span>
            <span className="text-lg font-black tabular-nums">{period.toFixed(2)} 秒</span>
          </div>
        </div>

        <PendulumCurve period={period} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-[var(--fb-inactive-text)]">T ≈ 2π√(L/g) · 小角度近似 · 初始摆角 {PENDULUM_AMPLITUDE}° · g = {PENDULUM_GRAVITY} m/s²</p>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => {
            const length = getLength();
            if (length !== update.updateDataModel.value) onLengthCommit(length);
            void bridge.explain(length);
          }} className="min-h-11 gap-2 bg-[var(--settings-selected-bg)] text-[var(--ai-bubble-text)] hover:bg-[var(--card-footer-bg)]">
            <MessageCircleQuestion aria-hidden="true" className="size-4" />为什么会这样
          </Button>
        </div>
      </div>
    </section>
  );
}

const PLOT = { width: 360, startX: 35, endX: 347, top: 18, centerY: 67, bottom: 116 };

function PendulumCurve({ period }: { period: number }) {
  const x = (time: number) => PLOT.startX + time / PENDULUM_DURATION * (PLOT.endX - PLOT.startX);
  const y = (angle: number) => PLOT.centerY - angle / PENDULUM_AMPLITUDE * (PLOT.centerY - PLOT.top);
  const points = Array.from({ length: 241 }, (_, index) => {
    const time = index / 240 * PENDULUM_DURATION;
    return `${x(time).toFixed(2)},${y(pendulumAngle(time, period)).toFixed(2)}`;
  }).join(" ");
  const firstPeriodX = x(period);

  return (
    <figure className="rounded-lg border border-[var(--fb-inactive-border)] bg-[var(--card-footer-bg)] px-2 py-2 text-sm sm:px-4">
      <figcaption className="px-2 pt-1 font-bold">摆角随时间变化</figcaption>
      <svg role="img" aria-label={`摆角在正负 ${PENDULUM_AMPLITUDE} 度间往复，前两个波峰相隔约 ${period.toFixed(2)} 秒。`} viewBox={`0 0 ${PLOT.width} 153`} className="mx-auto block w-full max-w-[520px] overflow-visible">
        {[-PENDULUM_AMPLITUDE, 0, PENDULUM_AMPLITUDE].map((angle) => (
          <g key={angle}>
            <line x1={PLOT.startX} y1={y(angle)} x2={PLOT.endX} y2={y(angle)} stroke="currentColor" opacity={angle === 0 ? 0.25 : 0.12} />
            <text x={PLOT.startX - 4} y={y(angle) + 3} textAnchor="end" fill="currentColor" fontSize="10">{angle}°</text>
          </g>
        ))}
        {[0, 2, 4, 6, 8].map((time) => <text key={time} x={x(time)} y="134" textAnchor="middle" fill="currentColor" fontSize="10">{time}</text>)}
        <text x={PLOT.endX} y="149" textAnchor="end" fill="currentColor" fontSize="10">时间（秒）</text>
        <line x1={firstPeriodX} y1={PLOT.top} x2={firstPeriodX} y2={PLOT.bottom} stroke="currentColor" strokeDasharray="3 3" opacity="0.48" />
        <polyline points={points} fill="none" stroke="var(--ai-bubble-text)" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={firstPeriodX} cy={PLOT.top} r="3.2" fill="var(--qp-3)" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </figure>
  );
}
