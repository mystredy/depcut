// Blog posts have no author photo upload, only authorName — this generated
// initials badge is the only avatar a byline can show. Color is derived from
// the name itself (a stable hash into a small fixed palette) so the same
// author always gets the same color without storing one anywhere.
const AVATAR_COLORS = ["#1D4ED8", "#7C3AED", "#DB2777", "#DC2626", "#D97706", "#059669", "#0891B2", "#4F46E5"];

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  // A single word (a brand name like "BigTech" rather than "First Last") —
  // fall back to its internal capital letters so "BigTech" reads as "BT"
  // instead of just its first two characters.
  const capitals = trimmed.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) return (capitals[0] + capitals[1]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function AuthorAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={className ?? "flex size-10 items-center justify-center rounded-full text-sm font-bold text-white"}
      style={{ background: colorForName(name) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  );
}
