import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateUser, useUserAdmin, useUsers } from "../../features/auth/useAuth";
import type { User } from "../../lib/api-client";
import { cx } from "../../lib/cx";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog, ICONS, Icon, SectionHeading, errorMessage } from "./parts";

/**
 * The people on this instance.
 *
 * The old panel kept an empty create-account form pinned above the list, which
 * made "add someone" the loudest thing on a screen that is mostly for reading.
 * Creation moved into a modal — a bottom sheet on a phone, since `Modal` docks
 * there — and the list gets the space back.
 */
export function UsersSection({ me }: { me: User }) {
  const { t } = useTranslation();
  const { data: users } = useUsers();
  const { update, remove } = useUserAdmin();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users ?? [];
    return (users ?? []).filter(
      (u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  const error = errorMessage(update.error ?? remove.error);

  return (
    <section>
      <SectionHeading
        title={t("settings.users")}
        description={users ? t("settings.userCount", { count: users.length }) : undefined}
        action={
          <Button variant="stamp" onClick={() => setCreating(true)}>
            <Icon path={ICONS.plus} size={15} />
            {t("settings.createUser")}
          </Button>
        }
      />

      <div className="relative">
        <Icon
          path={ICONS.search}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
        />
        <Input
          type="search"
          className="pl-9"
          aria-label={t("settings.searchUsers")}
          placeholder={t("settings.searchUsers")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-stamp-text">
          {error}
        </p>
      )}

      <ul className="mt-2 divide-y divide-line">
        {matches.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-4 py-3.5">
            {/* The same face as everywhere else, so an admin scanning this list
                recognises people by the picture they chose. */}
            <Avatar user={user} size={30} decorative className="mr-1" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm">
                <span className="truncate font-medium">{user.username}</span>
                {user.id === me.id && (
                  <span className="shrink-0 rounded-pill border border-line px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-text-dim">
                    {t("settings.you")}
                  </span>
                )}
                {/* The role is on every row, not only the interesting one —
                    an absent badge is not a statement. */}
                <span
                  className={cx(
                    "shrink-0 rounded-pill border px-2 py-0.5 text-[10.5px] uppercase tracking-wide",
                    user.role === "admin"
                      ? "border-stamp/50 text-stamp-text"
                      : "border-line text-text-faint",
                  )}
                >
                  {user.role === "admin" ? t("settings.roleAdmin") : t("settings.roleUser")}
                </span>
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-text-faint">
                {user.email}
                {user.must_change_password && ` · ${t("settings.pendingFirstLogin")}`}
              </p>
            </div>

            {/* No menu on your own row: an admin cannot demote or delete
                themselves by accident, and the server refuses it anyway. */}
            {user.id !== me.id && (
              <RowMenu
                label={t("settings.userActions", { name: user.username })}
                items={[
                  {
                    label: user.role === "admin" ? t("settings.makeUser") : t("settings.makeAdmin"),
                    onSelect: () =>
                      update.mutate({
                        id: user.id,
                        patch: { role: user.role === "admin" ? "user" : "admin" },
                      }),
                  },
                  {
                    label: t("settings.deleteUser"),
                    danger: true,
                    onSelect: () => setDeleting(user),
                  },
                ]}
              />
            )}
          </li>
        ))}
      </ul>

      {users && matches.length === 0 && (
        <p className="border-t border-line py-8 text-center text-sm text-text-dim">
          {t("settings.noUserMatch", { query: query.trim() })}
        </p>
      )}

      {creating && <CreateUserSheet onClose={() => setCreating(false)} />}

      {deleting && (
        <ConfirmDialog
          title={t("settings.deleteUser")}
          body={t("settings.deleteUserConfirm", { name: deleting.username })}
          confirmLabel={t("settings.deleteUser")}
          pending={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSettled: () => setDeleting(null),
            })
          }
        />
      )}
    </section>
  );
}

/**
 * The three-dot menu. Every item is a real button with a text label, so the
 * destructive one says "Delete" rather than relying on colour to warn.
 */
function RowMenu({
  label,
  items,
}: {
  label: string;
  items: { label: string; onSelect: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "flex h-9 w-9 items-center justify-center rounded-control text-text-dim transition-colors",
          "hover:bg-surface hover:text-text pointer-coarse:h-11 pointer-coarse:w-11",
          open && "bg-surface text-text",
        )}
      >
        <Icon path={ICONS.more} size={18} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-control border border-line bg-surface py-1"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={i === 0 ? first : undefined}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cx(
                "block w-full px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-bg",
                item.danger ? "text-stamp-text" : "text-text",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Creating an account on someone's behalf. The generated password is displayed
 * once, here, and never again — the server hashes it and keeps no clear copy, so
 * this sheet is the only chance to write it down. Closing it is therefore an
 * explicit "Done", not a stray click.
 */
function CreateUserSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateUser();
  const [form, setForm] = useState({ username: "", email: "" });
  const [copied, setCopied] = useState(false);
  const issued = create.data;

  const valid = form.username.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  if (issued) {
    return (
      <Modal title={t("settings.createdUser", { name: issued.user.username })} onClose={onClose}>
        <p className="mb-4 text-sm leading-relaxed text-text-dim">{t("settings.tempOnce")}</p>
        <Field label={t("settings.temporaryPassword")}>
          <Input
            className="tabular"
            readOnly
            value={issued.temporary_password}
            onFocus={(e) => e.currentTarget.select()}
          />
        </Field>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button
            onClick={() => {
              void navigator.clipboard?.writeText(issued.temporary_password);
              setCopied(true);
            }}
          >
            {copied ? t("settings.copied") : t("settings.copy")}
          </Button>
          <Button
            onClick={() => {
              setForm({ username: "", email: "" });
              setCopied(false);
              create.reset();
            }}
          >
            {t("settings.createAnother")}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {t("settings.done")}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t("settings.createUser")} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !create.isPending) create.mutate(form);
        }}
      >
        <Field label={t("auth.username")}>
          <Input
            value={form.username}
            autoComplete="off"
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label={t("auth.email")}>
          <Input
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <p className="text-xs leading-relaxed text-text-faint">{t("settings.createUserHint")}</p>
        {create.error && (
          <p role="alert" className="text-sm text-stamp-text">
            {errorMessage(create.error)}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="stamp" disabled={!valid || create.isPending}>
            {create.isPending ? t("settings.saving") : t("settings.createUser")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
