import { useTranslation } from "react-i18next";

import { errorKey } from "./errors";

/**
 * The one place a failed request turns into a sentence a person can read.
 *
 * Every form used to render `String(error)` itself, which meant eleven copies of
 * the same mistake and eleven places for an English string to survive a language
 * change.
 */
export function useErrorMessage(): (error: unknown) => string | undefined {
  const { t } = useTranslation();
  return (error: unknown) => (error ? t(errorKey(error)) : undefined);
}
