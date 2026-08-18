export function DemoBanner() {
  if (import.meta.env.VITE_DEMO !== "true") return null;

  const reset = () => {
    localStorage.removeItem("anitracker-real-demo-library-v1");
    localStorage.removeItem("anitracker-real-demo-library-v2");
    localStorage.removeItem("anitracker-real-demo-user-v1");
    window.location.assign(`${import.meta.env.BASE_URL}`);
  };

  return (
    <aside className="border-y border-stamp/35 bg-stamp/10" aria-label="Demo information">
      <div className="wrap flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[11px]">
        <strong className="font-mono uppercase tracking-[0.1em] text-stamp-text">
          Interactive demo
        </strong>
        <span className="min-w-[180px] flex-1 text-text-dim">
          Signed in as Demo User. Changes stay in this browser only.
        </span>
        <button
          type="button"
          className="font-mono min-h-8 border border-line px-2.5 text-[10px] uppercase tracking-[0.06em] text-text-dim transition hover:border-control-line hover:text-text"
          onClick={reset}
        >
          Reset demo
        </button>
        <a
          className="font-mono inline-flex min-h-8 items-center text-[10px] uppercase tracking-[0.06em] text-stamp-text hover:text-text"
          href={import.meta.env.BASE_URL.replace(/demo\/$/, "")}
        >
          Back to project ↗
        </a>
      </div>
    </aside>
  );
}
