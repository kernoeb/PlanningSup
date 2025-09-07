// generate stub index.html files for dev entry
import { execSync } from 'node:child_process'
import fs from 'fs-extra'
import chokidar from 'chokidar'
import { isDev, port, r } from './utils'

/**
 * Stub index.html to use Vite in development
 */
async function stubIndexHtml() {
  await fs.ensureDir(r(`extension/dist/`))
  let data = await fs.readFile(r(`../../apps/web/index.html`), 'utf-8')
  data = data
    .replace('"/src/main.ts"', `"http://localhost:${port}/src/main.ts"`)
    .replace('<div id="app"></div>', '<div id="app">Vite server did not start</div>')
  await fs.writeFile(r(`extension/dist/index.html`), data, 'utf-8')
}

function writeManifest() {
  execSync('bun ./scripts/manifest.ts', { stdio: 'inherit' })
}

writeManifest()

if (isDev) {
  stubIndexHtml()
  chokidar.watch([r('src/manifest.ts'), r('package.json')])
    .on('change', () => {
      writeManifest()
    })
}
