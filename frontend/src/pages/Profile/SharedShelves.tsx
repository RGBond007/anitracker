import { useTranslation } from "react-i18next";

import { useSharedShelves } from "../../features/social/useMoments";
import { SectionHead } from "../../components/layout/Rail";
import { Icon, ICONS } from "../../components/ui/Icon";

/**
 * The shelves someone chose to put on their profile.
 *
 * Names and counts only — not the titles on them. A shared shelf says "here is a
 * thing I curate"; opening it is a further step and one the owner has not been
 * asked to allow, so this stops at the shelf rather than guessing.
 *
 * Absent when nothing is shared, which is every profile until somebody ticks the
 * box. Shelves are private working space by default and the server enforces that;
 * this component would render nothing even if it forgot to.
 */
export function SharedShelves({ username }: { username: string }) {
  const { t } = useTranslation();
  const { data } = useSharedShelves(username);

  const shelves = data ?? [];
  if (shelves.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHead>{t("moments.sharedShelves", { name: username })}</SectionHead>
      <ul className="flex flex-wrap gap-2">
        {shelves.map((shelf) => (
          <li
            key={shelf.id}
            className="rounded-control border border-line bg-surface px-3 py-2"
          >
            <p className="flex items-center gap-1.5 text-[13px]">
              <Icon path={ICONS.library} size={13} className="text-text-faint" />
              {shelf.name}
              <span className="tabular text-[11.5px] text-text-faint">{shelf.item_count}</span>
            </p>
            {shelf.description && (
              <p className="mt-0.5 max-w-[36ch] text-[11.5px] text-text-faint">
                {shelf.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
