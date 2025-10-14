import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-updater',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.startsWith('/updater/')) {
            const filePath = path.resolve(__dirname, '..', req.url.slice(1))
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json')
              fs.createReadStream(filePath).pipe(res)
              return
            }
          }
          next()
        })
      }
    }
  ],
  server: {
    fs: {
      allow: ['..']
    }
  }
})
