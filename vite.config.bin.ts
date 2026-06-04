import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/cli/main.ts'),
      name: 'devicebase-cli',
      formats: ['es'],
      fileName: () => 'bin/index.js',
    },
    rollupOptions: {
      external: [/^node:/],
    },
    sourcemap: false,
    emptyOutDir: false,
    outDir: 'dist',
    minify: false,
  },
})
