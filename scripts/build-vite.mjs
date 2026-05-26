import { fileURLToPath, URL } from "node:url";

async function importWithFallback(packageName, fallbackPath) {
  try {
    return await import(packageName);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    return import(new URL(fallbackPath, import.meta.url));
  }
}

const { build } = await importWithFallback("vite", "../node_modules/vite/dist/node/index.js");
const { default: react } = await importWithFallback("@vitejs/plugin-react-swc", "../node_modules/@vitejs/plugin-react-swc/index.mjs");

const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : undefined;

await build({
  configFile: false,
  mode,
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
  },
});
