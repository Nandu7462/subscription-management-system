import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backend = path.join(root, 'backend')
const python = path.join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const stopDirectory = path.join(backend, '.stack-check')
mkdirSync(stopDirectory, { recursive: true })
const stopFile = path.join(stopDirectory, `stop-${randomUUID()}`)
const child = spawn(python, ['scripts/check_stack.py', ...process.argv.slice(2)], { cwd: backend, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, STACK_TEST_STOP_FILE: stopFile } })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { if (existsSync(stopFile)) unlinkSync(stopFile); process.exitCode = code ?? 1 })
// On Windows, kill('SIGINT') terminates Python without running its cleanup.
// A stop file lets the test harness shut down and remove its own schema cleanly.
process.on('SIGINT', () => writeFileSync(stopFile, 'stop'))
process.on('SIGTERM', () => writeFileSync(stopFile, 'stop'))
