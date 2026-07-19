export default function AttendanceRing({ percentage, color = "var(--accent)", size = 88 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const center = size / 2;

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={center} cy={center} r={radius} />
        <circle
          className="ring-progress"
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-label">{Math.round(percentage)}%</div>
    </div>
  );
}
