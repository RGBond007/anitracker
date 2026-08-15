import { useTranslation } from "react-i18next";

import type { EntryStatus, MediaType } from "../../lib/api-client";

/**
 * "Watching" vs "Reading" and "Plan to watch" vs "Plan to read" are the same stored
 * status with different wording per media type — resolved here, once.
 */
export function useStatusLabel() {
  const { t } = useTranslation();
  return (status: EntryStatus, type: MediaType) =>
    status === "current" || status === "planned"
      ? t(`status.${status}_${type}`)
      : t(`status.${status}`);
}
