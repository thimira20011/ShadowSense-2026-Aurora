import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup:      "popup.html",
        sandbox:    "sandbox.html",
        background: "src/background.ts",
        fiverr:     "src/content/fiverr.ts",
        fiverr_gig: "src/content/fiverr_gig.ts",
        upwork_gig: "src/content/upwork_gig.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background")  return "background.js";
          if (chunkInfo.name === "fiverr")      return "content/fiverr.js";
          if (chunkInfo.name === "fiverr_gig")  return "content/fiverr_gig.js";
          if (chunkInfo.name === "upwork_gig")  return "content/upwork_gig.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
