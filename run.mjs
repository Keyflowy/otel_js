import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , entry, ...args] = process.argv

if (!entry) {
  console.error('Usage: node ./run.mjs /path/to/.output/server/index.mjs [app args...]')
  process.exit(1)
}

const rootDir = dirname(fileURLToPath(import.meta.url))
const tracingPath = resolve(rootDir, 'tracing.js')
const hookPath = resolve(rootDir, 'node_modules/@opentelemetry/instrumentation/hook.mjs')

const child = spawn(process.execPath, [
  '--experimental-loader',
  hookPath,
  '--import',
  tracingPath,
  entry,
  ...args
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit'
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
