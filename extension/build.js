import { build } from "vite";
import react from "@vitejs/plugin-react";

async function run() {
  console.log("Building main extension assets (popup, sandbox, background)...");
  // 1. Build main extension (popup, sandbox, background)
  await build({
    plugins: [react()],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: "popup.html",
          sandbox: "sandbox.html",
          background: "src/background.ts",
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === "background") return "background.js";
            return "assets/[name]-[hash].js";
          },
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
  });

  // 2. Build content scripts one by one to force IIFE format (preventing code-splitting)
  const contentScripts = [
    { name: "fiverr", path: "src/content/fiverr.ts", out: "content/fiverr.js" },
    { name: "fiverr_gig", path: "src/content/fiverr_gig.ts", out: "content/fiverr_gig.js" },
    { name: "fiverr_jobs", path: "src/content/fiverr_jobs.ts", out: "content/fiverr_jobs.js" },
    { name: "upwork_gig", path: "src/content/upwork_gig.ts", out: "content/upwork_gig.js" },
    { name: "upwork", path: "src/content/upwork.ts", out: "content/upwork.js" },
  ];

  for (const script of contentScripts) {
    console.log(`Building content script: ${script.name}...`);
    await build({
      configFile: false, // disable loading default vite.config.ts
      build: {
        outDir: "dist",
        emptyOutDir: false, // DO NOT clean outDir, otherwise previous builds are deleted
        rollupOptions: {
          input: {
            [script.name]: script.path,
          },
          output: {
            entryFileNames: script.out,
            format: "iife",
            inlineDynamicImports: true,
          },
        },
      },
    });
  }
  
  console.log("Extension successfully built in extension/dist");
}

run().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
