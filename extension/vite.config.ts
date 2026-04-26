import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const extRoot = path.resolve(__dirname);
const projectRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
      // Replace next/link with a simple <a> tag in the extension build
      'next/link': path.resolve(extRoot, 'src/stubs/next-link.tsx'),
      // Replace next-themes with a no-op
      'next-themes': path.resolve(extRoot, 'src/stubs/next-themes.ts'),
    },
  },
  root: path.resolve(extRoot, 'src'),
  build: {
    outDir: path.resolve(extRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(extRoot, 'src/newtab.html'),
      },
    },
  },
});
