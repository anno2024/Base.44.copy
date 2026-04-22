import base44 from "@base44/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  logLevel: "error", // Suppress warnings, only show errors
  server: {
    allowedHosts: [".ngrok-free.dev", ".ngrok-free.app"],
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: false,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === "true",
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true,
    }),
    react(),
  ],
});
