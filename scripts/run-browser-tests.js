import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer, preview } from 'vite'

const live = process.argv.includes('--live')
const frontendPort = live ? 5174 : 4173
const configFile = live ? 'playwright.live.config.js' : 'playwright.config.js'
let backend
let frontend

async function waitFor(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The local process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return
  child.kill()
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

try {
  if (live) {
    backend = spawn(process.execPath, ['backend/src/server.js'], {
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    })
    await waitFor('http://127.0.0.1:3000/api/products')
    frontend = await createServer({
      server: { host: '127.0.0.1', port: frontendPort, strictPort: true },
    })
    await frontend.listen()
  } else {
    frontend = await preview({
      preview: { host: '127.0.0.1', port: frontendPort, strictPort: true },
    })
  }

  const runner = spawn(process.execPath, [
    'node_modules/@playwright/test/cli.js',
    'test',
    `--config=${configFile}`,
  ], {
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  const [exitCode] = await once(runner, 'exit')
  process.exitCode = exitCode ?? 1
} finally {
  if (frontend) await frontend.close()
  await stopChild(backend)
}
