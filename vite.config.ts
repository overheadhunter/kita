import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

// https://vite.dev/config/
// cloudflare() runs worker/index.ts with a local D1 during `pnpm dev` and bundles it on `pnpm build`; see wrangler.jsonc
export default defineConfig({
  plugins: [vue(), tailwindcss(), cloudflare()],
})
