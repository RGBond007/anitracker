/**
 * The same gold disc the nav uses for you, so a person reads as a person
 * anywhere. Lives apart from the page so the page and its sections can both use
 * it without importing each other.
 */
export function UserAvatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="font-mono flex shrink-0 items-center justify-center rounded-full font-medium text-ink-950"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: "linear-gradient(135deg, var(--stamp), #8a6e1c)",
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
