import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { App } from "@/App";
import { queryClient } from "@/lib/query";
import "@/lib/version";
import "@/styles/globals.css";
import "@/styles/poseidon-theme.css";

import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        containerStyle={{ top: 72 }}
        toastOptions={{
          duration: 3500,
          style: {
            background: "var(--sx-surface-high)",
            color: "var(--sx-text)",
            border: "1px solid var(--sx-border-strong)",
            fontSize: "13px",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
