import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

const isStatic = process.env.NITRO_PRESET === 'static'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern:
          '((components|hooks|tabs|utils)\\.(tsx|ts|jsx|js))|((components|hooks|tabs|utils)\\/)',
      },
      spa: {
        enabled: isStatic,
        prerender: {
          outputPath: '/index.html',
        },
      },
      prerender: {
        enabled: isStatic,
        crawlLinks: true,
      },
    }),
    viteReact(),
  ],
  optimizeDeps: {
    include: ['framer-motion'],
  },
})
