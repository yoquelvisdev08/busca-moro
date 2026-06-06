import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { App } from "@/App";
import { queryClient } from "@/lib/query";
import "@/lib/version";
import "@/styles/globals.css";

// Font face imports (self-hosted via @fontsource)
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        containerClassName="!z-[10000]"
        containerStyle={{ top: 72 }}
        gutter={12}
        toastOptions={{
          className: "sx-toast",
          duration: 3500,
          style: {
            background: "var(--sx-surface-high)",
            color: "var(--sx-text)",
            border: "1px solid var(--sx-border-strong)",
            boxShadow: "var(--sx-glow-primary)",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "12px",
            maxWidth: 420,
          },
          success: {
            duration: 3500,
            iconTheme: {
              primary: "var(--sx-success)",
              secondary: "var(--sx-surface-high)",
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: "var(--sx-danger)",
              secondary: "var(--sx-surface-high)",
            },
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
