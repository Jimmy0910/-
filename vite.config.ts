import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'C:/Users/jimmy/AppData/Local/Temp/mistake-notebook-dist',
    emptyOutDir: true,
    minify: false
  }
})
