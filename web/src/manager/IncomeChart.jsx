// Small inline SVG bar chart — revenue by day. No charting dependency,
// single series (identity carried by the section title, no legend needed).
const WIDTH = 640;
const HEIGHT = 180;
const PADDING_BOTTOM = 24;
const PADDING_TOP = 12;
const BAR_GAP = 8;

export default function IncomeChart({ data }) {
  if (data.length === 0) {
    return <p style={{ color: "#8a8378", fontSize: 13 }}>No revenue data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const barWidth = (WIDTH - BAR_GAP * (data.length - 1)) / data.length;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      role="img"
      aria-label="Revenue by day"
    >
      {data.map((d, i) => {
        const barHeight = Math.max((d.revenue / max) * plotHeight, 2);
        const x = i * (barWidth + BAR_GAP);
        const y = PADDING_TOP + (plotHeight - barHeight);
        return (
          <g key={d.day}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill="var(--dash-accent)"
            >
              <title>{`${d.day}: ₹${d.revenue}`}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize="9"
              fill="#8a8378"
            >
              {d.day.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
