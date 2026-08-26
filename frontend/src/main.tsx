import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Providers, queryClient } from "./app/providers";
import { Router } from "./app/router";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Above the providers, so a throw inside one of them is still caught and
        still has somewhere to be shown. */}
    <ErrorBoundary onReset={() => queryClient.clear()}>
      <Providers>
        <Router />
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
);
