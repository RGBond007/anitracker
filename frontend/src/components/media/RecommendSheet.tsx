import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Media } from "../../lib/api-client";
import { useFriends } from "../../features/social/useSocial";
import { useSendRecommendation } from "../../features/recommend/useRecommend";
import { useUiStore } from "../../stores/uiStore";
import { cx } from "../../lib/cx";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Textarea } from "../ui/Input";

/** The column is 280 in the database too; this is the rule, that is the backstop. */
const MAX_MESSAGE = 280;

/**
 * Hand a title to one or more friends, with an optional line about why.
 *
 * Multi-select rather than one friend at a time because recommending is usually a
 * "you three would like this" gesture, and the server takes the list in one call --
 * which is also what lets it skip the one friend who already has it waiting instead
 * of failing the whole send.
 */
export function RecommendSheet({ media, onClose }: { media: Media; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useUiStore((s) => s.toast);
  const friends = useFriends();
  const send = useSendRecommendation();

  const [chosen, setChosen] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [hasSpoilers, setHasSpoilers] = useState(false);

  const list = friends.data?.friends ?? [];
  const toggle = (id: number) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const submit = () =>
    send.mutate(
      {
        provider: media.provider,
        provider_id: media.provider_id,
        media_type: media.type,
        recipient_ids: chosen,
        message: message.trim() || null,
        has_spoilers: hasSpoilers,
      },
      {
        onSuccess: (result) => {
          // Both halves are reported. "Sent to two, one already had it" is the
          // honest summary of a partial send, and silence about the skip would
          // leave the sender thinking all three got it.
          const sent = result.sent.length;
          const skipped = result.already_pending.length;
          toast(
            skipped > 0
              ? t("recommend.sentWithSkips", { count: sent, skipped })
              : t("recommend.sent", { count: sent }),
          );
          onClose();
        },
      },
    );

  return (
    <Modal title={t("recommend.title")} onClose={onClose}>
      {friends.isLoading ? null : list.length === 0 ? (
        // An invitation, not an apology (§8).
        <p className="text-sm text-text-dim">{t("recommend.noFriends")}</p>
      ) : (
        <>
          <ul className="-mx-1 max-h-[40vh] overflow-y-auto">
            {list.map((friendship) => {
              const selected = chosen.includes(friendship.user.id);
              return (
                <li key={friendship.user.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(friendship.user.id)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-control px-1 py-2 text-left",
                      "transition-colors hover:bg-surface pointer-coarse:min-h-[44px]",
                    )}
                  >
                    <Avatar user={friendship.user} size={28} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">
                      {friendship.user.username}
                    </span>
                    <span
                      aria-hidden
                      className={cx(
                        "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border",
                        selected ? "border-stamp bg-stamp" : "border-control-line",
                      )}
                    >
                      {selected && (
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
                          <path
                            d="m5 13 4 4L19 7"
                            stroke="var(--ink-950)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3">
            <Field label={t("recommend.message")} hint={t("recommend.messageHint")}>
              <Textarea
                rows={2}
                maxLength={MAX_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("recommend.messagePlaceholder")}
              />
            </Field>
            <p className="tabular mt-1 text-right text-[11px] text-text-faint">
              {message.length}/{MAX_MESSAGE}
            </p>

            {/* A declaration, not a guarantee. The recipient's app covers the
                message anyway when the sender is further into the title — people
                are sincere and still wrong about what gives things away. */}
            <label className="mt-1 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={hasSpoilers}
                onChange={(e) => setHasSpoilers(e.target.checked)}
                className="mt-[3px] h-[15px] w-[15px] shrink-0 accent-[var(--stamp)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px]">{t("recommend.spoilerFlag")}</span>
                <span className="block text-[11.5px] text-text-faint">
                  {t("recommend.spoilerFlagHint")}
                </span>
              </span>
            </label>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button variant="quiet" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="stamp"
              disabled={chosen.length === 0 || send.isPending}
              onClick={submit}
            >
              {t("recommend.send", { count: chosen.length })}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
