import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { applyAccent } from "../../lib/accent";
import { DEFAULT_INSTANCE_NAME, usesBuiltInBrand } from "../../lib/brand";
import { readCachedBrand } from "../../lib/brandCache";

/**
 * How long the app may take to boot before it admits that it is taking a while.
 *
 * Long enough that a cold Raspberry Pi or a database still spinning up does not
 * get accused of being broken on every single load, short enough that nobody
 * sits in front of an unexplained screen wondering whether to hit reload.
 */
export const SLOW_STARTUP_MS = 8_000;

/**
 * What the app shows while it is finding out who you are and what this instance
 * is called — the two requests that must land before any route can be chosen.
 *
 * This used to be `<div className="min-h-dvh" />`: a correct, invisible
 * placeholder. On a laptop against a local server it is a flicker nobody sees.
 * On a NAS, a Pi, a waking database or a phone on bad signal it is several
 * seconds of blank page, and a blank page is indistinguishable from a broken
 * deployment — which is exactly the moment a self-hoster starts restarting
 * containers that were never unhealthy.
 *
 * Nothing here animates its way in (§6). The screen is painted as it is; only
 * the progress indicator moves, because a still one would be a lie.
 */
export function StartupScreen() {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  // Read once, not on every render: the value cannot change while this screen
  // is up, since the response that would change it is the one being waited on.
  const [cached] = useState(readCachedBrand);

  // Layout effect, not a plain one: this runs before the browser paints, so an
  // instance with its own accent never shows a frame of the default gold and
  // then switches. The router re-applies the served value once it has it.
  useLayoutEffect(() => applyAccent(cached?.accentColor), [cached]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_STARTUP_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const publicAsset = (name: string) => `${import.meta.env.BASE_URL}${name}`;
  const instanceName = cached?.instanceName ?? DEFAULT_INSTANCE_NAME;
  const usesDefaultBrand = usesBuiltInBrand(instanceName, cached?.logoUrl);
  // A remembered logo url can have been deleted since it was cached, and the
  // header already treats that as "draw the bundled icon" rather than a hole.
  const customLogo = cached?.logoUrl && !logoFailed ? cached.logoUrl : null;

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-10">
      <div className="flex w-full max-w-[260px] flex-col items-center">
        {/* Every mark here is decorative: the status line below names the
            instance, so labelling the artwork too would read it out twice. */}
        {usesDefaultBrand ? (
          <>
            <img src={publicAsset("logo.png")} alt="" className="brand-dark-only h-auto w-full" />
            {/* The bundled wordmark is drawn for ink, so light mode uses the
                same icon-plus-name lockup the header falls back to. */}
            <span className="brand-light-only brand-light-lockup flex-col items-center gap-3.5">
              <img src={publicAsset("icon-192.png")} alt="" className="h-14 w-14 rounded-[12px]" />
              <span className="font-display text-[19px] font-bold tracking-[0.02em]">
                {instanceName.toUpperCase()}
              </span>
            </span>
          </>
        ) : (
          <>
            <img
              src={customLogo ?? publicAsset("icon-192.png")}
              alt=""
              className="h-14 w-14 rounded-[12px] object-contain"
              onError={() => setLogoFailed(true)}
            />
            <span className="mt-3.5 text-center font-display text-[19px] font-bold tracking-[0.02em]">
              {instanceName.toUpperCase()}
            </span>
          </>
        )}

        <div className="mt-8 h-[2px] w-full overflow-hidden bg-line" aria-hidden>
          <div className="startup-progress h-full w-1/3 bg-stamp" />
        </div>

        {/**
         * One live region for the whole boot, holding one sentence at a time, so
         * a screen reader hears "Loading <instance>" once and then hears about
         * the delay only if there is one. The text is present from the first
         * paint, so it is also there for anyone reading rather than listening.
         */}
        <p role="status" className="font-mono mt-4 text-center text-[11px] text-text-dim">
          {slow ? t("startup.slow") : t("startup.loading", { name: instanceName })}
        </p>
      </div>
    </div>
  );
}
