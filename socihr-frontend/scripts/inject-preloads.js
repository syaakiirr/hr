import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distAssets = resolve(__dirname, '..', 'dist', 'assets')
const distRoot = resolve(__dirname, '..', 'dist')

const files = readdirSync(distAssets)
const htmlPath = resolve(distRoot, 'index.html')
let html = readFileSync(htmlPath, 'utf-8')

// 1. Inline CSS — replace <link rel="stylesheet"> with inline <style>
html = html.replace(
  /<link rel="stylesheet" crossorigin href="\/assets\/([^"]+\.css)">/,
  (match, cssFile) => {
    const cssPath = resolve(distAssets, cssFile)
    const css = readFileSync(cssPath, 'utf-8')
    const kb = (statSync(cssPath).size / 1024).toFixed(1)
    console.log(`  Inlined ${cssFile} (${kb} KB)`)
    return `<style>${css}</style>`
  }
)

// 2. Modulepreload for critical post-login chunks
for (const file of files) {
  const match = ['Layout', 'DashboardPage'].find(t => file.startsWith(t) && file.endsWith('.js'))
  if (match) {
    const link = `<link rel="modulepreload" href="/assets/${file}">`
    if (!html.includes(link)) {
      html = html.replace('</head>', `  ${link}\n  </head>`)
    }
  }
}

writeFileSync(htmlPath, html)
console.log('  ✓ modulepreload links injected')
