import { create } from "zustand";

import type { TitleLanguage } from "../lib/api-client";

export type Theme = "dark" | "light";

interface Toast {
  id: number;
  message: string;
}

/**
 * UI-only state. Server state lives in TanStack Query and never enters this store —
 * that separation is the "no bloat" line from the plan (§5).
 *
 * `titleLanguage` and `theme` are *caches* of the authoritative user record; the
 * server copy is written through the profile mutation, this copy just avoids a
 * flash of the wrong language before /api/me resolves.
 */
interface UiState {
  theme: Theme;
  titleLanguage: TitleLanguage;
  listTab: string;
  /** Grid of covers, or a compact row per title — a phone preference, remembered. */
  libraryView: "grid" | "list";
  toasts: Toast[];
  setTheme: (theme: Theme) => void;
  setTitleLanguage: (lang: TitleLanguage) => void;
  setListTab: (tab: string) => void;
  setLibraryView: (view: "grid" | "list") => void;
  toast: (message: string) => void;
  dismissToast: (id: number) => void;
}

const THEME_KEY = "anitrack-theme";
const LANG_KEY = "anitrack-title-language";
const VIEW_KEY = "anitrack-library-view";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

let nextToastId = 1;

export const useUiStore = create<UiState>((set) => ({
  theme: (localStorage.getItem(THEME_KEY) as Theme) ?? "dark",
  titleLanguage: (localStorage.getItem(LANG_KEY) as TitleLanguage) ?? "romaji",
  listTab: "current",
  libraryView: (localStorage.getItem(VIEW_KEY) as "grid" | "list") ?? "grid",
  toasts: [],

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  setTitleLanguage: (titleLanguage) => {
    localStorage.setItem(LANG_KEY, titleLanguage);
    set({ titleLanguage });
  },
  setListTab: (listTab) => set({ listTab }),
  setLibraryView: (libraryView) => {
    localStorage.setItem(VIEW_KEY, libraryView);
    set({ libraryView });
  },

  toast: (message) =>
    set((state) => ({ toasts: [...state.toasts, { id: nextToastId++, message }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Applied before React mounts so there is no wrong-theme flash.
applyTheme((localStorage.getItem(THEME_KEY) as Theme) ?? "dark");
