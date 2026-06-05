// Version injected at build time — see vite.config.ts
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
export const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP ?? "unknown";

console.log(
  `%c Orion %c v${APP_VERSION} %c built ${BUILD_TIMESTAMP} `,
  "background: #22d3ee; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 2px 0 0 2px;",
  "background: #1c1e30; color: #22d3ee; padding: 2px 6px;",
  "background: #1c1e30; color: #859397; padding: 2px 6px; border-radius: 0 2px 2px 0;",
);
