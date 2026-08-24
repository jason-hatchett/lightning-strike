import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run dev`   -> hot-reloading dev server (index.html + ES modules)
// `npm run build` -> dist/index.html, a single self-contained file (all JS/CSS
//                    and the base64 sprite bundle inlined) suitable for publishing
//                    as the standalone prototype / Artifact.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000, // inline everything; no external asset requests
    chunkSizeWarningLimit: 100_000,
  },
});
