import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";

import App from "./App";
import { QueryClientWrapper, ThemeProvider } from "./app/providers";
import { getThemePreference } from "@/features/settings/api/theme.api";

const initialTheme = await getThemePreference().catch(() => "system" as const);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientWrapper>
      <ThemeProvider defaultTheme={initialTheme} storageKey="pet-focus-theme">
        <App />
        <Toaster position="top-right" richColors expand />
      </ThemeProvider>
    </QueryClientWrapper>
  </React.StrictMode>,
);
