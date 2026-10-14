const DONUT_R = 14;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;

type CaseStudyProgressDonutProps = {
  pct: number;
  color: string;
  label: string;
  sub: string;
};

export function CaseStudyProgressDonut({
  pct,
  color,
  label,
  sub,
}: CaseStudyProgressDonutProps) {
  const offset = DONUT_CIRC * (1 - pct / 100);
  return (
    <div className="flex items-center gap-1.5">
      <svg
        width="44"
        height="44"
        viewBox="0 0 36 36"
        className="block shrink-0"
        aria-hidden="true"
      >
        <circle
          cx="18"
          cy="18"
          r={DONUT_R}
          fill="none"
          stroke="var(--border)"
          strokeWidth="3.5"
        />
        <circle
          cx="18"
          cy="18"
          r={DONUT_R}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={`${DONUT_CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
        <text
          x="18"
          y="18"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-text text-[7.5px] font-bold"
        >
          {pct}%
        </text>
      </svg>
      <div className="flex flex-col gap-px">
        <span className="text-[10px] font-semibold leading-tight text-text-2">
          {label}
        </span>
        <span className="text-[9px] leading-tight text-text-3">{sub}</span>
      </div>
    </div>
  );
}
