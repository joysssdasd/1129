import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..')
const CC_ROOT = path.join(WORKSPACE_ROOT, 'cc')
const GENERATED_ROOT = path.join(CC_ROOT, 'generated')
const DEFAULT_WATCH_ROOT = path.join(WORKSPACE_ROOT, 'wechat', 'manual-export-inbox')
const STATE_FILE = path.join(GENERATED_ROOT, 'wechat-manual-export-watch-state.json')
const LOG_ROOT = path.join(GENERATED_ROOT, 'manual-export-watch-logs')

const rawArgs = process.argv.slice(2)
const args = new Map(
  rawArgs
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const index = arg.indexOf('=')
      return [arg.slice(2, index), arg.slice(index + 1)]
    })
)
const flags = new Set(rawArgs.filter((arg) => arg.startsWith('--') && !arg.includes('=')))

const watchRoot = path.resolve(args.get('watch-dir') || args.get('export-dir') || process.env.WECHAT_MANUAL_EXPORT_DIR || DEFAULT_WATCH_ROOT)
const stateFile = path.resolve(args.get('state-file') || process.env.WECHAT_MANUAL_EXPORT_STATE_FILE || STATE_FILE)
const mode = args.get('mode') || process.env.WECHAT_MANUAL_EXPORT_MODE || 'publish'
const sinceHours = Number(args.get('since-hours') || process.env.WECHAT_MARKET_SINCE_HOURS || 6)
const siteOrigin = args.get('site') || process.env.WECHAT_MARKET_SITE || 'https://www.niuniubase.top'
const limit = Number(args.get('limit') || process.env.WECHAT_MARKET_LIMIT || 24)
const batch = Number(args.get('batch') || process.env.WECHAT_MARKET_BATCH || 4)
const pollMs = Number(args.get('poll-ms') || process.env.WECHAT_MANUAL_EXPORT_POLL_MS || 3000)
const stableMs = Number(args.get('stable-ms') || process.env.WECHAT_MANUAL_EXPORT_STABLE_MS || 8000)
const retryMinutes = Number(args.get('retry-minutes') || process.env.WECHAT_MANUAL_EXPORT_RETRY_MINUTES || 15)
const once = flags.has('--once')
const processExisting = flags.has('--process-existing') || once
const offlineMode = flags.has('--offline') || process.env.WECHAT_MARKET_OFFLINE === '1'

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex')
}

function nowIso() {
  return new Date().toISOString()
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, payload) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')
}

function getShanghaiDateHour(dateInput) {
  const local = new Date(dateInput.getTime() + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}-${String(local.getUTCHours()).padStart(2, '0')}`
}

function collectJsonFiles(root) {
  if (!fs.existsSync(root)) return []

  const files = []
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        const stat = fs.statSync(fullPath)
        files.push({
          path: fullPath,
          relativePath: path.relative(root, fullPath).replace(/\\/g, '/'),
          size: stat.size,
          mtimeMs: Math.round(stat.mtimeMs)
        })
      }
    }
  }

  visit(root)
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

function snapshotExportDir() {
  const files = collectJsonFiles(watchRoot)
  const payload = files.map((file) => `${file.relativePath}:${file.size}:${file.mtimeMs}`).join('\n')
  const totalSize = files.reduce((total, file) => total + file.size, 0)
  const latestMtimeMs = files.reduce((latest, file) => Math.max(latest, file.mtimeMs), 0)
  return {
    signature: sha1(payload),
    fileCount: files.length,
    totalSize,
    latestMtimeMs,
    files
  }
}

function runProcess(executable, processArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, processArgs, {
      cwd: options.cwd || PROJECT_ROOT,
      env: process.env,
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr })
    })
  })
}

function parseSummary(stdout) {
  const trimmed = stdout.trim()
  if (!trimmed) return null

  const start = trimmed.lastIndexOf('\n{')
  const jsonText = start >= 0 ? trimmed.slice(start + 1) : trimmed
  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

function buildPipelineArgs() {
  return [
    path.join(PROJECT_ROOT, 'scripts', 'wechat-market-auto.mjs'),
    `--mode=${mode === 'publish' ? 'publish' : 'preview'}`,
    '--skip-echotrace',
    '--skip-db',
    `--source-dir=${watchRoot}`,
    `--wechat-root=${watchRoot}`,
    `--since-hours=${Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : 6}`,
    `--limit=${Number.isFinite(limit) && limit > 0 ? limit : 24}`,
    `--batch=${Number.isFinite(batch) && batch > 0 ? batch : 4}`
  ]
}

function buildPipelineCommand() {
  const pipelineArgs = buildPipelineArgs()
  if (siteOrigin) pipelineArgs.push(`--site=${siteOrigin}`)
  if (offlineMode) pipelineArgs.push('--offline')
  return {
    executable: process.execPath,
    args: pipelineArgs
  }
}

function shouldRetryFailedSignature(state, signature) {
  if (state.lastFailedSignature !== signature) return true
  const failedAt = Date.parse(state.lastFailedAt || '')
  if (!Number.isFinite(failedAt)) return true
  return Date.now() - failedAt >= Math.max(1, retryMinutes) * 60 * 1000
}

async function runPipeline(snapshot, state) {
  const startedAt = new Date()
  const runId = `${getShanghaiDateHour(startedAt)}-${snapshot.signature.slice(0, 10)}`
  const pipelineCommand = buildPipelineCommand()

  console.log(`[${nowIso()}] Processing manual export: ${snapshot.fileCount} json files, mode=${mode}`)
  const result = await runProcess(pipelineCommand.executable, pipelineCommand.args, { cwd: PROJECT_ROOT })
  const summary = parseSummary(result.stdout)
  const finishedAt = new Date()

  const payload = {
    runId,
    watchRoot,
    mode,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    signature: snapshot.signature,
    fileCount: snapshot.fileCount,
    totalSize: snapshot.totalSize,
    latestMtimeMs: snapshot.latestMtimeMs,
    pipelineExecutable: pipelineCommand.executable,
    pipelineArgs: pipelineCommand.args,
    exitCode: result.code,
    signal: result.signal || null,
    summary,
    stdoutTail: result.stdout.slice(-4000),
    stderrTail: result.stderr.slice(-4000)
  }

  ensureDir(LOG_ROOT)
  const logFile = path.join(LOG_ROOT, `${runId}.json`)
  writeJson(logFile, payload)

  const nextState = {
    ...state,
    watchRoot,
    mode,
    updatedAt: nowIso(),
    lastRunId: runId,
    lastSignature: snapshot.signature,
    lastLogFile: logFile,
    lastSummary: summary
  }

  if (result.code === 0) {
    console.log(`[${nowIso()}] Manual export processed successfully. log=${logFile}`)
    return {
      ...nextState,
      lastProcessedSignature: snapshot.signature,
      lastProcessedAt: nowIso(),
      lastFailedSignature: '',
      lastFailedAt: ''
    }
  }

  console.error(result.stderr || result.stdout || 'Manual export processing failed.')
  return {
    ...nextState,
    lastFailedSignature: snapshot.signature,
    lastFailedAt: nowIso()
  }
}

async function main() {
  ensureDir(watchRoot)
  ensureDir(GENERATED_ROOT)

  let state = readJson(stateFile, {})
  let currentSignature = ''
  let changedAt = Date.now()
  let running = false
  let sawEmptySinceStart = false
  let handledFirstNonEmptySnapshot = false

  console.log(`[${nowIso()}] Watching manual EchoTrace exports: ${watchRoot}`)
  console.log(`[${nowIso()}] Export format must be JSON. mode=${mode}, sinceHours=${sinceHours}`)

  while (true) {
    const snapshot = snapshotExportDir()

    if (!snapshot.fileCount) {
      sawEmptySinceStart = true
      currentSignature = ''
      changedAt = Date.now()
      if (once) {
        console.log(`[${nowIso()}] No json files found in ${watchRoot}.`)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(1000, pollMs)))
      continue
    }

    if (snapshot.signature !== currentSignature) {
      currentSignature = snapshot.signature
      changedAt = Date.now()
      console.log(`[${nowIso()}] Export change detected: ${snapshot.fileCount} json files`)
    }

    const stableForMs = Date.now() - changedAt
    const alreadyProcessed = state.lastProcessedSignature === snapshot.signature
    const shouldBaseline = !state.lastProcessedSignature && !processExisting && !sawEmptySinceStart && !handledFirstNonEmptySnapshot
    const canRetry = shouldRetryFailedSignature(state, snapshot.signature)

    if (!running && stableForMs >= Math.max(1000, stableMs) && !alreadyProcessed) {
      handledFirstNonEmptySnapshot = true
      if (shouldBaseline) {
        state = {
          ...state,
          watchRoot,
          mode,
          updatedAt: nowIso(),
          baselineSignature: snapshot.signature,
          lastProcessedSignature: snapshot.signature,
          lastProcessedAt: nowIso(),
          note: 'Initial files were recorded as baseline. New manual exports will trigger processing.'
        }
        writeJson(stateFile, state)
        console.log(`[${nowIso()}] Existing files recorded as baseline. Waiting for the next export.`)
        if (once) return
      } else if (canRetry) {
        running = true
        try {
          state = await runPipeline(snapshot, state)
          writeJson(stateFile, state)
        } finally {
          running = false
        }
        if (once) return
      }
    }

    if (once && alreadyProcessed) {
      console.log(`[${nowIso()}] This export has already been processed.`)
      return
    }

    await new Promise((resolve) => setTimeout(resolve, Math.max(1000, pollMs)))
  }
}

main().catch((error) => {
  ensureDir(GENERATED_ROOT)
  const failedState = {
    runId: `manual-watch-failed-${Date.now()}`,
    watchRoot,
    mode,
    failedAt: nowIso(),
    error: error?.message || String(error)
  }
  writeJson(stateFile, failedState)
  console.error(error)
  process.exit(1)
})
