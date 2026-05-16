import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { App } from "@/App";
import { queryClient } from "@/lib/query";
import "@/styles/theme.css";
import "@/styles/app.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element no encontrado");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(7, 9, 26, 0.95)",
            color: "var(--void-text, #e2e8f0)",
            border: "1px solid var(--void-border-strong, #334155)",
            fontFamily: "monospace",
            fontSize: "12px",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "rgba(7, 9, 26, 0.95)",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "rgba(7, 9, 26, 0.95)",
            },
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
