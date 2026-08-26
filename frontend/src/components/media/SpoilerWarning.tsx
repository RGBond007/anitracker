import { useTranslation } from "react-i18next";

import { useSpoilerCheck, useWatchGroupForTitle } from "../../features/watch/useWatch";
import { Icon, ICONS } from "../ui/Icon";

/**
 * Who logging the next episode would leave behind.
 *
 * The whole point of a watch-together group, said at the moment it matters: not
 * on a settings page, but beside the button that would do it. It names people
 * rather than counting them, because "this puts you ahead of Mika" is something
 * you can act on and "1 person" is not.
 *
 * It never blocks and never disables anything. Someone who wants to watch on is
 * entitled to; they are only entitled to know what it costs the group first.
 */
export function SpoilerWarning({
  provider,
  providerId,
  nextUnit,
}: {
  provider: string;
  providerId: string;
  /** The position that logging one more would put the viewer at. */
  nextUnit: number;
}) {
  const { t } = useTranslation();
  const { data: group } = useWatchGroupForTitle(provider, providerId);
  const active = group && !group.is_closed && group.my_state === "joined" ? group : null;
  const { data: check } = useSpoilerCheck(active ? active.id : null, active ? nextUnit : null);

  if (!active || !check) return null;
  if (check.behind.length === 0 && !check.past_target) return null;

  const names = check.behind.map((u) => u.username);

  return (
    <p
      className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-stamp-text"
      // Polite rather than assertive: it appears as a consequence of arriving at
      // the page, not of an action, and must not interrupt anything.
      aria-live="polite"
    >
      <Icon path={ICONS.eye} size={13} className="mt-[2px] shrink-0" />
      <span>
        {names.length > 0 &&
          (names.length === 1
            ? t("watch.wouldPassOne", { name: names[0], n: nextUnit })
            : t("watch.wouldPassMany", { name: names[0], count: names.length - 1, n: nextUnit }))}
        {names.length > 0 && check.past_target && " "}
        {check.past_target && t("watch.pastTarget", { n: check.target_unit ?? 0 })}
      </span>
    </p>
  );
}
