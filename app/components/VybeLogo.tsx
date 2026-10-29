export default function VybeLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* V shape made of two converging lines with a dot */}
      <polygon
        points="4,6 20,32 36,6"
        fill="none"
        stroke="#E11D48"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Inner accent line */}
      <line x1="12" y1="6" x2="20" y2="20" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="6" x2="20" y2="20" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="20" cy="20" r="2.5" fill="#E11D48" />
    </svg>
  );
}
