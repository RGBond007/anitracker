import { Component, Fragment, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/Button";
import { buildCrashReport } from "../../lib/diagnostics";
// The screen is mounted outside `Providers`, so it cannot rely on that module
// having initialised i18next. Importing it here is a no-op when it already has.
import "../../lib/i18n";

/**
 * The last thing standing when a render throws.
 *
 * React's answer to an exception during render is to unmount the entire tree: not
 * a broken panel on a working page, but a white document with nothing in it and
 * nothing in the UI saying why. On a self-hosted instance that is indistinguishable
 * from a container that died, which sends someone to `docker logs` for a fault that
 * was only ever in the browser — the same confusion the startup screen was built to
 * end, arriving from the other direction.
 *
 * So the tree is wrapped once, at the root, above every provider: a boundary any
 * lower leaves the shell it lives in able to take the page down with it. What that
 * costs is granularity — one bad component still replaces the whole screen — which
 * a per-route boundary can buy back later without changing anything here, since
 * this takes `children` and nothing else.
 *
 * It catches what React can catch: an exception thrown while rendering, in a
 * lifecycle, or in a constructor below it. An event handler that throws, a rejected
 * promise and anything outside the render pass never reach a boundary in any React
 * version, and this one does not pretend otherwise.
 */
interface Props {
  children: ReactNode;
  /**
   * Run before the tree is rebuilt. The root passes the query cache's `clear`:
   * the likeliest cause of a render crash is a component meeting a payload it did
   * not expect, and retrying against the same cached copy of it would only crash
   * again in the same place.
   */
  onReset?: () => void;
}

interface State {
  error: unknown;
  componentStack: string | null;
  /** Bumped on every retry, to force the subtree to be built from scratch. */
  attempt: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // The console is the only log a browser-side crash has. Kept even though the
    // screen prints the same trace, because someone debugging with devtools open
    // should not have to expand a `<details>` to find it.
    console.error("Unhandled rendering error", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleRetry = () => {
    this.props.onReset?.();
    this.setState((previous) => ({
      error: null,
      componentStack: null,
      attempt: previous.attempt + 1,
    }));
  };

  render() {
    if (this.state.error !== null) {
      return (
        <ErrorScreen
          error={this.state.error}
          componentStack={this.state.componentStack}
          onRetry={this.handleRetry}
        />
      );
    }

    // Keyed so a retry unmounts and rebuilds the tree rather than re-rendering
    // components that are still holding the state that broke them.
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

/**
 * The recovery screen. Deliberately made of nothing: no query, no router, no
 * instance data, no artwork that has to load. Everything it needs is already in
 * memory by the time it renders, because it is what gets drawn when the things
 * that fetch have already failed — and a fallback that can throw is not one.
 */
function ErrorScreen({
  error,
  componentStack,
  onRetry,
}: {
  error: unknown;
  componentStack: string | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const report = buildCrashReport({
    error,
    componentStack,
    href: window.location.href,
    userAgent: navigator.userAgent,
    version: __APP_VERSION__,
    at: new Date().toISOString(),
  });

  // A full load rather than a route change: the router is inside the tree that
  // just came down, and the point of this button is to be rid of every piece of
  // state the crash happened in. `BASE_URL` is `/` in production and the demo's
  // subdirectory on Pages, where the hash router then resolves `/` itself.
  const home = import.meta.env.BASE_URL;

  const copy = () => {
    void navigator.clipboard.writeText(report).then(
      () => setCopied(true),
      // Refused (a denied permission, a document that lost focus). The report is
      // on screen and selectable, so the honest answer is to say nothing.
      () => setCopied(false),
    );
  };

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-[560px]">
        {/* Scoped to the sentence, not the screen: an alert region is read out
            whole, and wrapping the trace in one would recite a stack trace. */}
        <div role="alert">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stamp-text">
            {t("error.kicker")}
          </p>
          <h1 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-[-0.01em]">
            {t("error.title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-dim">{t("error.body")}</p>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button variant="primary" onClick={onRetry}>
            {t("common.retry")}
          </Button>
          <a
            href={home}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-hairline px-[18px] py-3 text-sm font-medium text-text transition hover:border-hairline-strong"
          >
            {t("error.home")}
          </a>
        </div>

        <details className="mt-9 rounded-control border border-line">
          <summary className="cursor-pointer list-none px-5 py-3.5 text-[13px] text-text-dim transition hover:text-text">
            {t("error.details")}
          </summary>
          <div className="border-t border-line px-5 py-4">
            <p className="text-[12.5px] leading-relaxed text-text-faint">{t("error.detailsHint")}</p>
            {/* The copied text is this element's text: there is no second, fuller
                version travelling to the clipboard that nobody has read. */}
            <pre className="font-mono mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-text-dim">
              {report}
            </pre>
            {/* Absent without the Clipboard API, which a self-hosted instance
                reached over plain http does not have. The trace above is still
                there to select — a button that silently does nothing is worse. */}
            {window.isSecureContext && navigator.clipboard ? (
              <Button variant="quiet" className="mt-2 px-0" onClick={copy}>
                {copied ? t("error.copied") : t("error.copy")}
              </Button>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}
