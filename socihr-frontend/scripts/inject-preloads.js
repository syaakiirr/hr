import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = resolve(__dirname, '..', 'dist', 'assets')

const files = readdirSync(dist)
const htmlPath = resolve(__dirname, '..', 'dist', 'index.html')
let html = readFileSync(htmlPath, 'utf-8')

// Known chunks to speculative-preload — these are needed immediately after login
const targets = ['Layout', 'DashboardPage']

for (const file of files) {
  const match = targets.find(t => file.startsWith(t) && file.endsWith('.js'))
  if (match) {
    const link = `<link rel="modulepreload" href="/assets/${file}">`
    if (!html.includes(link)) {
      html = html.replace('</head>', `  ${link}\n  </head>`)
    }
  }
}

writeFileSync(htmlPath, html)
