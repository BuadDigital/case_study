"use client";

import { useEffect, useId, useRef } from "react";

// animejs is loaded on demand inside effects so it stays out of the initial bundle.
type DashAnimation = { pause: () => void };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** CSS: dashDraw 1.1s ease — stroke-dashoffset 400 → 0 */
/** CSS: dashChartFade 0.8s ease 0.3s / 0.4s ease — opacity 0 → 1 */
/** SMIL donut: 1.1s cubic-bezier(0.4, 0, 0.2, 1) */

function MiniDonut({
  pct,
  color,
}: {
  pct: number;
  color: string;
}) {
  const safe = Math.max(0, Math.min(100, pct));
  const s = 46;
  const r = 18;
  const cx = 23;
  const cc = 2 * Math.PI * r;
  const off = cc * (1 - safe / 100);
  const ringRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = ringRef.current;
    if (!el) return;
    el.style.strokeDasharray = String(cc);
    if (prefersReducedMotion()) {
      el.style.strokeDashoffset = String(off);
      return;
    }
    el.style.strokeDashoffset = String(cc);
    let anim: DashAnimation | null = null;
    let cancelled = false;
    void import("animejs").then(({ animate }) => {
      if (cancelled) return;
      anim = animate(el, {
        strokeDashoffset: [cc, off],
        duration: 1100,
        ease: "outCubic",
      });
    });
    return () => {
      cancelled = true;
      anim?.pause();
    };
  }, [cc, off]);

  return (
    <svg
      viewBox={`0 0 ${s} ${s}`}
      width={s}
      height={s}
      style={{ display: "block" }}
      aria-hidden
    >
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={5}
      />
      <circle
        ref={ringRef}
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text
        x={cx}
        y={cx + 4}
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="800"
        fill="var(--heading)"
      >
        {Math.round(safe)}%
      </text>
    </svg>
  );
}

export function RingCap({
  pct,
  color,
  cap,
}: {
  pct: number;
  color: string;
  cap: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <MiniDonut pct={pct} color={color} />
      <span className="whitespace-nowrap text-[9px] text-text-3">{cap}</span>
    </div>
  );
}

export function BigRing({ pct, color }: { pct: number; color: string }) {
  const safe = Math.max(0, Math.min(100, pct));
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c * (1 - safe / 100);
  const ringRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = ringRef.current;
    if (!el) return;
    el.style.strokeDasharray = String(c);
    if (prefersReducedMotion()) {
      el.style.strokeDashoffset = String(off);
      return;
    }
    el.style.strokeDashoffset = String(c);
    let anim: DashAnimation | null = null;
    let cancelled = false;
    void import("animejs").then(({ animate }) => {
      if (cancelled) return;
      anim = animate(el, {
        strokeDashoffset: [c, off],
        duration: 1100,
        ease: "outCubic",
      });
    });
    return () => {
      cancelled = true;
      anim?.pause();
    };
  }, [c, off]);

  return (
    <svg
      viewBox="0 0 100 100"
      width={118}
      height={118}
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx={50}
        cy={50}
        r={42}
        fill="none"
        stroke="var(--border)"
        strokeWidth={9}
      />
      <circle
        ref={ringRef}
        cx={50}
        cy={50}
        r={42}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x={50}
        y={47}
        textAnchor="middle"
        fontSize="24"
        fontWeight="800"
        fill="var(--heading)"
      >
        {safe}%
      </text>
      <text
        x={50}
        y={64}
        textAnchor="middle"
        fontSize="10"
        fill="var(--text-3)"
      >
        اكتمال
      </text>
    </svg>
  );
}

export function TrendChart({
  labels,
  series,
}: {
  labels: string[];
  series: { year: string; color: string; values: number[] }[];
}) {
  const gid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const seriesKey = series.map((s) => `${s.year}:${s.values.join(",")}`).join("|");
  const W = 760;
  const H = 168;
  const padL = 30;
  const padR = 14;
  const padT = 12;
  const padB = 26;
  const pw = W - padL - padR;
  const ph = H - padT - padB;
  const n = labels.length;
  let max = 0;
  for (const s of series) {
    for (const v of s.values) if (v > max) max = v;
  }
  max = Math.ceil((max || 10) / 10) * 10;

  const X = (i: number) => padL + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
  const Y = (v: number) => padT + ph * (1 - v / max);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const lines = root.querySelectorAll<SVGPathElement>("[data-trend-line]");
    const areaLayer = root.querySelector<HTMLElement>("[data-trend-area]");
    const dotLayer = root.querySelector<HTMLElement>("[data-trend-dot]");

    if (prefersReducedMotion()) {
      lines.forEach((el) => {
        el.style.strokeDasharray = "none";
        el.style.strokeDashoffset = "0";
      });
      if (areaLayer) areaLayer.style.opacity = "1";
      if (dotLayer) dotLayer.style.opacity = "1";
      return;
    }

    const anims: DashAnimation[] = [];
    let cancelled = false;
    const len = 400;

    lines.forEach((el) => {
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
    });
    if (areaLayer) areaLayer.style.opacity = "0";
    if (dotLayer) dotLayer.style.opacity = "0";

    void import("animejs").then(({ animate }) => {
      if (cancelled) return;

      lines.forEach((el, i) => {
        anims.push(
          animate(el, {
            strokeDashoffset: [len, 0],
            duration: 1100,
            delay: i * 80,
            ease: "inOutQuad",
          }),
        );
      });

      if (areaLayer) {
        anims.push(
          animate(areaLayer, {
            opacity: [0, 1],
            duration: 800,
            delay: 300,
            ease: "inOutQuad",
          }),
        );
      }

      if (dotLayer) {
        anims.push(
          animate(dotLayer, {
            opacity: [0, 1],
            duration: 400,
            delay: 550,
            ease: "inOutQuad",
          }),
        );
      }
    });

    return () => {
      cancelled = true;
      for (const a of anims) a.pause();
    };
  }, [seriesKey, labels.join(",")]);

  const linePath = (values: number[]) =>
    values
      .map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`)
      .join(" ");
  const last = series[series.length - 1];
  const areaId = `${gid}-area`;

  return (
    <div ref={rootRef} className="relative">
      {last ? (
        <div
          data-trend-area=""
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0 }}
          aria-hidden
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full">
            <defs>
              <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={last.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={last.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path
              d={`${linePath(last.values)} L${X(n - 1)} ${padT + ph} L${X(0)} ${padT + ph} Z`}
              fill={`url(#${areaId})`}
            />
          </svg>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="relative block h-auto w-full"
        role="img"
        aria-label="اتجاه الإنجاز"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + ph * (1 - t);
          const val = Math.round(max * t);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-3)"
              >
                {val}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <path
            key={s.year}
            d={linePath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-trend-line=""
          />
        ))}
        {labels.map((lab, i) => (
          <text
            key={lab + i}
            x={X(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-3)"
          >
            {lab}
          </text>
        ))}
      </svg>
      <div
        data-trend-dot=""
        className="pointer-events-none absolute inset-0"
        style={{ opacity: 0 }}
        aria-hidden
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          {series.map((s) =>
            s.values.map((v, i) => (
              <circle
                key={`${s.year}-${i}`}
                cx={X(i)}
                cy={Y(v)}
                r={3.2}
                fill="var(--surface)"
                stroke={s.color}
                strokeWidth={2}
              />
            )),
          )}
        </svg>
      </div>
    </div>
  );
}
