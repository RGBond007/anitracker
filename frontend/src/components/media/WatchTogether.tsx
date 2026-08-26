import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Media, WatchGroup } from "../../lib/api-client";
import {
  useCloseWatchGroup,
  useCreateWatchGroup,
  useInviteToWatchGroup,
  useJoinWatchGroup,
  useLeaveWatchGroup,
  useSetWatchTarget,
  useWatchGroupForTitle,
} from "../../features/watch/useWatch";
import { useFriends } from "../../features/social/useSocial";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Icon, ICONS } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { NumberInput } from "../ui/Input";
import { Field } from "../ui/Field";
import { cx } from "../../lib/cx";

/**
 * Watching one show with a few friends, at roughly the same pace.
 *
 * Coordination and nothing else: a roster, everyone's episode, and the one the
 * group is aiming at next. No playback, no session, no chat — the app never
 * learns whether anyone actually sat down together, and does not need to.
 *
 * Absent from a title nobody has proposed, so the page is unchanged for the
 * overwhelming majority of things in a library.
 */
export function WatchTogether({ media }: { media: Media }) {
  const { t } = useTranslation();
  const { data: group } = useWatchGroupForTitle(media.provider, media.provider_id);
  const [starting, setStarting] = useState(false);

  if (!group) {
    return (
      <>
        <button
          type="button"
          onClick={() => setStarting(true)}
          className={cx(
            "flex w-full items-center justify-center gap-1.5 rounded-control px-2.5 py-2",
            "text-[12.5px] text-text-dim transition-colors hover:text-text",
          )}
        >
          <Icon path={ICONS.friends} size={14} />
          {t("watch.start")}
        </button>
        {starting && <StartSheet media={media} onClose={() => setStarting(false)} />}
      </>
    );
  }

  return <GroupPanel group={group} />;
}

/** Propose the group and pick who comes along. */
function StartSheet({ media, onClose }: { media: Media; onClose: () => void }) {
  const { t } = useTranslation();
  const friends = useFriends();
  const create = useCreateWatchGroup();
  const [chosen, setChosen] = useState<number[]>([]);

  const list = friends.data?.friends ?? [];
  const toggle = (id: number) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <Modal title={t("watch.startTitle")} onClose={onClose}>
      {list.length === 0 ? (
        <p className="text-sm text-text-dim">{t("watch.noFriends")}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-text-dim">{t("watch.startBody")}</p>
          <ul className="-mx-1 max-h-[40vh] overflow-y-auto">
            {list.map((f) => (
              <li key={f.user.id}>
                <button
                  type="button"
                  aria-pressed={chosen.includes(f.user.id)}
                  onClick={() => toggle(f.user.id)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-control px-1 py-2 text-left",
                    "transition-colors hover:bg-surface pointer-coarse:min-h-[44px]",
                  )}
                >
                  <Avatar user={f.user} size={26} decorative />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{f.user.username}</span>
                  <Tick on={chosen.includes(f.user.id)} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="stamp"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(
              {
                provider: media.provider,
                provider_id: media.provider_id,
                media_type: media.type,
                invite_ids: chosen,
              },
              { onSuccess: onClose },
            )
          }
        >
          {t("watch.create", { count: chosen.length })}
        </Button>
      </div>
    </Modal>
  );
}

/** The roster, the target, and the ways out. */
function GroupPanel({ group }: { group: WatchGroup }) {
  const { t } = useTranslation();
  const join = useJoinWatchGroup();
  const leave = useLeaveWatchGroup();
  const closeGroup = useCloseWatchGroup();
  const setTarget = useSetWatchTarget();
  const inviteMore = useInviteToWatchGroup();
  const friends = useFriends();

  const [editingTarget, setEditingTarget] = useState(false);
  const [draft, setDraft] = useState("");
  const [inviting, setInviting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const joined = group.members.filter((m) => m.state === "joined");
  const invited = group.members.filter((m) => m.state === "invited");
  const isMember = group.my_state === "joined";

  // Whoever is furthest back sets the pace, and saying so is the point.
  const slowest = joined
    .map((m) => m.progress ?? 0)
    .reduce((low, p) => Math.min(low, p), Number.POSITIVE_INFINITY);

  const notYetInvited = (friends.data?.friends ?? []).filter(
    (f) => !group.members.some((m) => m.user.id === f.user.id && m.state !== "left"),
  );

  return (
    <section
      aria-labelledby="watch-together"
      className="rounded-control border border-line bg-surface p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3
          id="watch-together"
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-stamp-text"
        >
          {t("watch.heading")}
        </h3>
        {group.is_closed && (
          <span className="text-[11px] text-text-faint">{t("watch.closed")}</span>
        )}
      </div>

      {group.my_state === "invited" && !group.is_closed && (
        <div className="mt-2">
          <p className="text-[12.5px] text-text-dim">{t("watch.invitedYou")}</p>
          <div className="mt-2 flex gap-1.5">
            <Button
              variant="stamp"
              className="px-3 py-1.5 text-[12.5px]"
              disabled={join.isPending}
              onClick={() => join.mutate(group.id)}
            >
              {t("watch.accept")}
            </Button>
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-[12.5px]"
              onClick={() => leave.mutate(group.id)}
            >
              {t("watch.decline")}
            </Button>
          </div>
        </div>
      )}

      {/* The roster. Everyone's episode, for everyone in the group and nobody else. */}
      <ul className="mt-2.5 space-y-1.5">
        {joined.map((member) => (
          <li key={member.user.id} className="flex items-center gap-2 text-[12.5px]">
            <Avatar user={member.user} size={20} decorative />
            <span className="min-w-0 flex-1 truncate">
              {member.user.username}
              {member.is_owner && (
                <span className="ml-1.5 text-[10px] text-text-faint">{t("watch.owner")}</span>
              )}
            </span>
            <span
              className={cx(
                "tabular shrink-0 text-[12px]",
                (member.progress ?? 0) > slowest ? "text-stamp-text" : "text-text-dim",
              )}
            >
              {member.progress == null
                ? t("watch.notTracking")
                : t("watch.atEpisode", { n: member.progress })}
            </span>
          </li>
        ))}
        {invited.map((member) => (
          <li
            key={member.user.id}
            className="flex items-center gap-2 text-[12.5px] text-text-faint"
          >
            <Avatar user={member.user} size={20} decorative />
            <span className="min-w-0 flex-1 truncate">{member.user.username}</span>
            <span className="shrink-0 text-[11px]">{t("watch.pending")}</span>
          </li>
        ))}
      </ul>

      {/* The target: one number the group agrees on, changeable by any member. */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <p className="text-[12.5px] text-text-dim">
          {group.target_unit != null
            ? t("watch.target", { n: group.target_unit })
            : t("watch.noTarget")}
        </p>
        {isMember && !group.is_closed && (
          <button
            type="button"
            onClick={() => {
              setDraft(group.target_unit != null ? String(group.target_unit) : "");
              setEditingTarget(true);
            }}
            className="text-[12px] text-text-faint transition-colors hover:text-stamp-text"
          >
            {t("watch.setTarget")}
          </button>
        )}
      </div>

      {isMember && !group.is_closed && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {notYetInvited.length > 0 && (
            <button
              type="button"
              onClick={() => setInviting(true)}
              className="text-[12px] text-text-faint transition-colors hover:text-text"
            >
              {t("watch.inviteMore")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            className="text-[12px] text-text-faint transition-colors hover:text-text"
          >
            {group.i_own_it ? t("watch.close") : t("watch.leave")}
          </button>
        </div>
      )}

      {editingTarget && (
        <Modal title={t("watch.setTargetTitle")} onClose={() => setEditingTarget(false)}>
          <Field label={t("watch.targetLabel")} hint={t("watch.targetHint")}>
            <NumberInput
              min={1}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="quiet"
              onClick={() =>
                setTarget.mutate(
                  { id: group.id, target: null },
                  { onSuccess: () => setEditingTarget(false) },
                )
              }
            >
              {t("watch.clearTarget")}
            </Button>
            <div className="flex gap-2">
              <Button variant="quiet" onClick={() => setEditingTarget(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="stamp"
                disabled={!draft.trim() || setTarget.isPending}
                onClick={() =>
                  setTarget.mutate(
                    { id: group.id, target: Number(draft) },
                    { onSuccess: () => setEditingTarget(false) },
                  )
                }
              >
                {t("watch.saveTarget")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {inviting && (
        <Modal title={t("watch.inviteMore")} onClose={() => setInviting(false)}>
          <ul className="-mx-1 max-h-[40vh] overflow-y-auto">
            {notYetInvited.map((f) => (
              <li key={f.user.id}>
                <button
                  type="button"
                  disabled={inviteMore.isPending}
                  onClick={() =>
                    inviteMore.mutate(
                      { id: group.id, userIds: [f.user.id] },
                      { onSuccess: () => setInviting(false) },
                    )
                  }
                  className={cx(
                    "flex w-full items-center gap-3 rounded-control px-1 py-2 text-left",
                    "transition-colors hover:bg-bg pointer-coarse:min-h-[44px]",
                  )}
                >
                  <Avatar user={f.user} size={26} decorative />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{f.user.username}</span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {confirmLeave && (
        <Modal
          title={group.i_own_it ? t("watch.closeTitle") : t("watch.leaveTitle")}
          onClose={() => setConfirmLeave(false)}
        >
          <p className="text-sm text-text-dim">
            {group.i_own_it ? t("watch.closeBody") : t("watch.leaveBody")}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setConfirmLeave(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="stamp"
              disabled={leave.isPending || closeGroup.isPending}
              onClick={() =>
                group.i_own_it
                  ? closeGroup.mutate(group.id, { onSuccess: () => setConfirmLeave(false) })
                  : leave.mutate(group.id, { onSuccess: () => setConfirmLeave(false) })
              }
            >
              {group.i_own_it ? t("watch.close") : t("watch.leave")}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border",
        on ? "border-stamp bg-stamp" : "border-control-line",
      )}
    >
      {on && (
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
  );
}
