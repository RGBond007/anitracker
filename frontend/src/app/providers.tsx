import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter } from "react-router-dom";

import { ToastViewport } from "../components/ui/Toast";
import "../lib/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  // GitHub Pages cannot rewrite deep links to index.html. Hash routing keeps the
  // real application routes usable in the static demo; production stays clean.
  const AppRouter = import.meta.env.VITE_DEMO === "true" ? HashRouter : BrowserRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter>
        {children}
        <ToastViewport />
      </AppRouter>
    </QueryClientProvider>
  );
}
