import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api, type User } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";
import { useUiStore } from "../../stores/uiStore";

/** Mirrors the authoritative user record into the UI-only caches (theme, language). */
function useSyncPreferences() {
  const { i18n } = useTranslation();
  const setTheme = useUiStore((s) => s.setTheme);
  const setTitleLanguage = useUiStore((s) => s.setTitleLanguage);

  return (user: User) => {
    setTheme(user.theme);
    setTitleLanguage(user.title_language);
    if (i18n.language !== user.ui_language) void i18n.changeLanguage(user.ui_language);
  };
}

export function useMe() {
  const sync = useSyncPreferences();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const user = await api.me();
      sync(user);
      return user;
    },
    retry: false,
    staleTime: 60 * 1000,
  });
}

function useAuthSuccess() {
  const queryClient = useQueryClient();
  const sync = useSyncPreferences();
  return (user: User) => {
    sync(user);
    queryClient.setQueryData(queryKeys.me, user);
    void queryClient.invalidateQueries({ queryKey: queryKeys.instance });
  };
}

export function useLogin() {
  const onSuccess = useAuthSuccess();
  return useMutation({
    mutationFn: ({ identifier, password }: { identifier: string; password: string }) =>
      api.login(identifier, password),
    onSuccess,
  });
}

export function useRegister() {
  const onSuccess = useAuthSuccess();
  return useMutation({ mutationFn: api.register, onSuccess });
}

export function useSetup() {
  const onSuccess = useAuthSuccess();
  return useMutation({ mutationFn: api.setup, onSuccess });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.clear();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const sync = useSyncPreferences();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (user) => {
      sync(user);
      queryClient.setQueryData(queryKeys.me, user);
      toast("Profile saved");
    },
  });
}

export function useChangePassword() {
  const toast = useUiStore((s) => s.toast);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      api.changePassword(current, next),
    onSuccess: () => {
      // Clears `must_change_password`, which is what the router keys the forced
      // change screen off — without refetching `me` the user stays stuck on it.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast("Password changed");
    },
  });
}

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: api.users });
}

export function useUserAdmin() {
  const queryClient = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.users });

  return {
    update: useMutation({
      mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) =>
        api.updateUser(id, patch),
      onSuccess: () => {
        invalidate();
        toast("User updated");
      },
    }),
    remove: useMutation({
      mutationFn: api.deleteUser,
      onSuccess: () => {
        invalidate();
        toast("User deleted");
      },
    }),
  };
}

/**
 * Creates an account with a one-time password. The result is kept on the mutation
 * rather than toasted, because the temporary password has to stay on screen long
 * enough to be copied — a toast that vanishes would lose it for good.
 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

/** "Sign out everywhere" — bumps `token_version`, keeping only this device valid. */
export function useRevokeSessions() {
  const toast = useUiStore((s) => s.toast);
  const { t } = useTranslation();
  return useMutation({
    mutationFn: api.revokeSessions,
    onSuccess: () => toast(t("settings.revoked")),
  });
}
