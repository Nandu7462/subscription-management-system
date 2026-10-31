import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backend = path.join(root, 'backend')
const frontend = path.join(root, 'frontend')
const python = path.join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const children = []
const run = (command, args, cwd = backend) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Setup command failed (${result.status})`)
}
const start = (command, args, cwd) => {
  const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true })
  children.push(child)
  child.on('error', error => { console.error(error.message); shutdown(1) })
  child.on('exit', code => { if (!stopping) shutdown(code || 0) })
}
let stopping = false
function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
async function responds(url, check) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(1500) }); return response.ok && check(await response.text()) }
  catch { return false }
}
async function waitForService(url, check) {
  for (let attempt = 0; attempt < 25; attempt++) {
    if (stopping) throw new Error('Startup was stopped.')
    if (await responds(url, check)) return
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Service did not become ready: ${url}`)
}

try {
  if (!existsSync(python)) throw new Error('Create backend/.venv and install backend/requirements.txt first. See README.md.')
  const envPath = path.join(backend, '.env')
  const env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  if (!env || /DATABASE_URL=.*127\.0\.0\.1:55432/.test(env)) run(python, ['scripts/dev_postgres.py', 'start', '--configure'])
  run(python, ['-m', 'alembic', 'upgrade', 'head'])
  const apiRunning = await responds('http://127.0.0.1:8000/api/v1/health', text => text.includes('subscription-management-backend'))
  const uiRunning = await responds('http://127.0.0.1:5173/', text => text.includes('Brightloop'))
  if (apiRunning) console.log('Reusing the backend already running on port 8000.')
  else start(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], backend)
  await waitForService('http://127.0.0.1:8000/api/v1/health/ready', text => text.includes('ready'))
  if (uiRunning) console.log('Reusing the frontend already running on port 5173.')
  else {
    const vite = path.join(frontend, 'node_modules/vite/bin/vite.js')
    if (!existsSync(vite)) throw new Error('Run npm install in frontend first.')
    start(process.execPath, [vite, '--host', '127.0.0.1'], frontend)
  }
  await waitForService('http://127.0.0.1:5173/', text => text.includes('Brightloop'))
  console.log('\nFrontend: http://127.0.0.1:5173\nAPI docs: http://127.0.0.1:8000/docs\nDatabase: configured in backend/.env\n')
  process.on('SIGINT', () => shutdown())
  process.on('SIGTERM', () => shutdown())
} catch (error) { console.error(error.message); shutdown(1) }
