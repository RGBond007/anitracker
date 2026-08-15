import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Providers } from "./app/providers";
import { Router } from "./app/router";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <Router />
    </Providers>
  </StrictMode>,
);
