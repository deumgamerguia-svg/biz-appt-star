export function ReportChart({ data }: { data: Array<{ dia: string; total: number }> }) {
  const width = 720;
  const height = 260;
  const margin = { top: 18, right: 18, bottom: 42, left: 38 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...data.map((item) => item.total));
  const tickCount = 4;
  const step = data.length ? innerWidth / data.length : innerWidth;
  const barWidth = Math.min(42, step * 0.58);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Gráfico de agendamentos por dia"
      className="h-full w-full overflow-visible"
      preserveAspectRatio="none"
    >
      {Array.from({ length: tickCount + 1 }, (_, index) => {
        const ratio = index / tickCount;
        const y = margin.top + innerHeight * ratio;
        const value = Math.round(maxValue * (1 - ratio));

        return (
          <g key={index}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={margin.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {value}
            </text>
          </g>
        );
      })}

      {data.map((item, index) => {
        const normalized = item.total / maxValue;
        const barHeight = innerHeight * normalized;
        const x = margin.left + index * step + (step - barWidth) / 2;
        const y = margin.top + innerHeight - barHeight;

        return (
          <g key={`${item.dia}-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(0, barHeight)}
              rx="4"
              fill="var(--primary)"
            >
              <title>{`${item.dia}: ${item.total}`}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={height - 14}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {item.dia}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
