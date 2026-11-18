import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        portfolio: fileURLToPath(new URL('./index.html', import.meta.url)),
        atelier: fileURLToPath(new URL('./atelier.html', import.meta.url)),
        trainer: fileURLToPath(new URL('./model-trainer.html', import.meta.url)),
      },
    },
  },
});
