import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { User } from "../../lib/api-client";
import { useRemoveAvatar, useUploadAvatar } from "../../features/auth/useAuth";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { ImageCropper } from "../../components/ui/ImageCropper";
import { Modal } from "../../components/ui/Modal";
import { errorMessage, useSavedFlag } from "./parts";

/** What the server accepts. Checked here only so the answer is instant. */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The profile picture, above the fields that name the same person.
 *
 * Picking a file opens the cropper rather than uploading straight away: a phone
 * photo is 4:3 and the thing that matters in it is rarely dead centre. What the
 * cropper produces is a 512-pixel square, which is what the server would have
 * made anyway -- the difference is that the person uploading chose which square.
 */
export function AvatarField({ me }: { me: User }) {
  const { t } = useTranslation();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const [saved, flashSaved] = useSavedFlag();

  const [chosen, setChosen] = useState<File | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const choose = (file: File | undefined) => {
    if (!file) return;
    // Both of these are re-checked by the server; saying so here just saves a
    // round trip and names the problem while the file picker is still in mind.
    if (!ACCEPTED.includes(file.type)) {
      setRejected(t("settings.avatarWrongType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setRejected(t("settings.avatarTooBig"));
      return;
    }
    setRejected(null);
    setChosen(file);
  };

  const send = (blob: Blob) =>
    upload.mutate(blob, {
      onSuccess: () => {
        setChosen(null);
        flashSaved();
      },
    });

  const error = rejected ?? errorMessage(upload.error) ?? errorMessage(remove.error);

  return (
    <div className="mb-8 flex flex-wrap items-center gap-5 border-b border-line pb-8">
      <Avatar user={me} size={88} decorative />

      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold">{t("settings.avatar")}</p>
        <p className="mt-0.5 max-w-prose text-[12.5px] text-text-dim">{t("settings.avatarHint")}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              // Cleared so choosing the same file twice still fires a change.
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            className="px-3.5 py-2 text-[13px]"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {me.avatar_url ? t("settings.avatarChange") : t("settings.avatarUpload")}
          </Button>

          {me.avatar_url && (
            <Button
              variant="quiet"
              className="px-3 py-2 text-[13px]"
              disabled={remove.isPending}
              onClick={() => remove.mutate(undefined, { onSuccess: () => flashSaved() })}
            >
              {t("settings.avatarRemove")}
            </Button>
          )}

          {saved !== null && (
            <span role="status" className="text-[12.5px] text-stamp-text">
              {t("settings.avatarSaved")}
            </span>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-2 text-[12.5px] text-stamp-text">
            {error}
          </p>
        )}
      </div>

      {/* A dialog on a desktop, a sheet up from the bottom on a phone -- the
          same component the rest of the app opens for a focused decision. */}
      {chosen && (
        <Modal title={t("settings.avatarCropTitle")} onClose={() => setChosen(null)}>
          <ImageCropper
            file={chosen}
            busy={upload.isPending}
            onCancel={() => setChosen(null)}
            onCropped={send}
            labels={{
              zoom: t("settings.avatarZoom"),
              cancel: t("common.cancel"),
              save: upload.isPending ? t("settings.avatarSaving") : t("settings.avatarSave"),
              hint: t("settings.avatarCropHint"),
              failed: t("settings.avatarUnreadable"),
            }}
          />
        </Modal>
      )}
    </div>
  );
}
