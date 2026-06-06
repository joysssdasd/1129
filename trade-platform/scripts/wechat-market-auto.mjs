import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..')
const DEFAULT_WECHAT_ROOT = path.join(WORKSPACE_ROOT, 'wechat')
const DEFAULT_IMPORT_ROOT = path.join(DEFAULT_WECHAT_ROOT, 'auto-import')
const GENERATED_ROOT = path.join(WORKSPACE_ROOT, 'cc', 'generated')
const RUN_OUTPUT_ROOT = path.join(GENERATED_ROOT, 'runs')
const LOG_ROOT = path.join(GENERATED_ROOT, 'automation-logs')
const STATE_FILE = path.join(GENERATED_ROOT, 'wechat-market-automation-state.json')
const DEFAULT_ECHOTRACE_EXE = path.join(process.env.USERPROFILE || 'C:\\Users\\big', 'Downloads', 'echotrace-windows-v3.1.0', 'echotrace.exe')

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const index = arg.indexOf('=')
      return [arg.slice(2, index), arg.slice(index + 1)]
    })
)

const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--') && !arg.includes('=')))

const mode = args.get('mode') || process.env.WECHAT_MARKET_MODE || 'preview'
const shouldPublish = mode === 'publish' || flags.has('--publish')
const sinceHours = Number(args.get('since-hours') || process.env.WECHAT_MARKET_SINCE_HOURS || 6)
const sourceDir = path.resolve(args.get('source-dir') || process.env.WECHAT_MARKET_EXPORT_DIR || DEFAULT_WECHAT_ROOT)
const wechatRoot = path.resolve(args.get('wechat-root') || process.env.WECHAT_MARKET_SOURCE_DIR || DEFAULT_WECHAT_ROOT)
const siteOrigin = args.get('site') || process.env.WECHAT_MARKET_SITE || ''
const autoExpireOrigin = args.get('auto-expire-site') || process.env.WECHAT_MARKET_AUTO_EXPIRE_SITE || siteOrigin || 'https://www.niuniubase.top'
const limit = args.get('limit') || process.env.WECHAT_MARKET_LIMIT || ''
const batch = args.get('batch') || process.env.WECHAT_MARKET_BATCH || ''
const skipImport = flags.has('--skip-import')
const skipDbExport = flags.has('--skip-db')
const skipEchoTrace = flags.has('--skip-echotrace')
const skipSummary = flags.has('--skip-summary')
const offlineMode = flags.has('--offline') || process.env.WECHAT_MARKET_OFFLINE === '1'
const dbRoot = path.resolve(args.get('db-root') || process.env.ECHOTRACE_DB_ROOT || path.join(wechatRoot, 'EchoTrace'))
const echoTraceExe = path.resolve(args.get('echotrace-exe') || process.env.ECHOTRACE_EXE || DEFAULT_ECHOTRACE_EXE)
const rawEchoTraceCliTimeoutMs = Number(args.get('echotrace-timeout-ms') || process.env.ECHOTRACE_CLI_TIMEOUT_MS || 120000)
const echoTraceCliTimeoutMs = Number.isFinite(rawEchoTraceCliTimeoutMs) && rawEchoTraceCliTimeoutMs > 0
  ? rawEchoTraceCliTimeoutMs
  : 120000

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function getShanghaiDateKey(dateInput) {
  const local = new Date(dateInput.getTime() + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`
}

function getShanghaiDateHour(dateInput) {
  const local = new Date(dateInput.getTime() + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}-${String(local.getUTCHours()).padStart(2, '0')}`
}

function isInside(child, parent) {
  const relative = path.relative(parent, child)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function collectJsonFiles(root) {
  if (!fs.existsSync(root)) return []

  const files = []
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'EchoTrace') continue
        visit(fullPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        files.push(fullPath)
      }
    }
  }

  visit(root)
  return files
}

function copyJsonExports() {
  if (skipImport || !fs.existsSync(sourceDir)) {
    return { copiedCount: 0, skippedCount: 0, importDir: null }
  }

  const sourceIsWechatRoot = path.resolve(sourceDir) === path.resolve(wechatRoot)
  if (sourceIsWechatRoot || isInside(sourceDir, wechatRoot)) {
    return { copiedCount: 0, skippedCount: 0, importDir: null }
  }

  const importDir = path.join(DEFAULT_IMPORT_ROOT, getShanghaiDateKey(new Date()))
  ensureDir(importDir)

  let copiedCount = 0
  let skippedCount = 0
  for (const file of collectJsonFiles(sourceDir)) {
    const relative = path.relative(sourceDir, file)
    const target = path.join(importDir, relative)
    ensureDir(path.dirname(target))

    const sourceStat = fs.statSync(file)
    const targetExists = fs.existsSync(target)
    const targetStat = targetExists ? fs.statSync(target) : null
    if (targetExists && targetStat?.size === sourceStat.size && targetStat.mtimeMs >= sourceStat.mtimeMs) {
      skippedCount += 1
      continue
    }

    fs.copyFileSync(file, target)
    fs.utimesSync(target, sourceStat.atime, sourceStat.mtime)
    copiedCount += 1
  }

  return { copiedCount, skippedCount, importDir }
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
    let settled = false
    let timedOut = false
    let timeout = null
    let forceTimeout = null
    const cleanup = () => {
      if (timeout) clearTimeout(timeout)
      if (forceTimeout) clearTimeout(forceTimeout)
    }
    const settleResolve = (payload) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(payload)
    }
    const settleReject = (error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', settleReject)
    child.on('close', (code, signal) => {
      settleResolve({ code, signal, stdout, stderr, timedOut })
    })

    const timeoutMs = Number(options.timeoutMs || 0)
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true
        stderr += `\nProcess timed out after ${timeoutMs} ms.`
        try { child.kill() } catch {}
        forceTimeout = setTimeout(() => {
          try { child.kill('SIGKILL') } catch {}
          settleResolve({ code: null, signal: 'timeout', stdout, stderr, timedOut })
        }, 5000)
      }, timeoutMs)
    }
  })
}

function runNodeScript(script, scriptArgs) {
  return runProcess(process.execPath, [script, ...scriptArgs], { cwd: PROJECT_ROOT })
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

async function autoExpirePosts(adminId) {
  if (!shouldPublish) return { skipped: true, reason: 'not in publish mode' }
  if (offlineMode) return { skipped: true, reason: 'offline mode' }
  if (!adminId) return { skipped: true, reason: 'missing admin user id' }

  const endpoint = `${autoExpireOrigin.replace(/\/$/, '')}/api/admin/auto-expire-posts`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-user-id': adminId
    },
    body: JSON.stringify({ expireDays: 3 })
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }

  if (!res.ok || data?.success === false) {
    throw new Error(data?.error?.message || text || `Auto-expire request failed: ${res.status}`)
  }

  return {
    skipped: false,
    endpoint,
    status: res.status,
    total: Number(data?.data?.total || 0),
    expiredCount: Number(data?.data?.expiredCount || 0),
    sourceCounts: data?.data?.sourceCounts || {}
  }
}

function writeRunLog(runId, payload) {
  ensureDir(LOG_ROOT)
  const logFile = path.join(LOG_ROOT, `${runId}.json`)
  fs.writeFileSync(logFile, JSON.stringify(payload, null, 2), 'utf8')
  return logFile
}

function copyDailyOutputsToRunSnapshot(runId, dateKey, metadata) {
  const sourceDir = path.join(GENERATED_ROOT, dateKey)
  const outputDir = path.join(RUN_OUTPUT_ROOT, runId)
  ensureDir(outputDir)

  const files = [
    'raw-candidates.json',
    'deduped-clusters.json',
    'publish-plan.json',
    'managed-sync-manifest.json',
    'managed-sync-preview.json',
    'managed-sync-execution.json',
    'report-v2.json'
  ]

  for (const fileName of files) {
    const source = path.join(sourceDir, fileName)
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(outputDir, fileName))
    }
  }

  fs.writeFileSync(path.join(outputDir, 'run-metadata.json'), JSON.stringify(metadata, null, 2), 'utf8')
  return outputDir
}

async function runEchoTraceCli(startedAt) {
  if (skipEchoTrace) {
    return { skipped: true, reason: 'skip flag enabled' }
  }
  if (!fs.existsSync(echoTraceExe)) {
    return { skipped: true, reason: 'echotrace executable not found', echoTraceExe }
  }

  const outputDir = path.join(DEFAULT_IMPORT_ROOT, 'echotrace-cli', getShanghaiDateHour(startedAt))
  ensureDir(outputDir)

  const cutoff = Number.isFinite(sinceHours) && sinceHours > 0
    ? new Date(Date.now() - sinceHours * 60 * 60 * 1000)
    : startedAt
  const startDate = getShanghaiDateKey(cutoff)
  const endDate = getShanghaiDateKey(new Date(startedAt.getTime() + 24 * 60 * 60 * 1000))
  const cliArgs = [
    '-e',
    outputDir,
    '--format',
    'json',
    '--start',
    startDate,
    '--end',
    endDate
  ]

  const cliStartedAt = Date.now()
  const result = await runProcess(echoTraceExe, cliArgs, {
    cwd: path.dirname(echoTraceExe),
    timeoutMs: echoTraceCliTimeoutMs
  })
  return {
    echoTraceExe,
    outputDir,
    startDate,
    endDate,
    timeoutMs: echoTraceCliTimeoutMs,
    durationMs: Date.now() - cliStartedAt,
    exitCode: result.code,
    signal: result.signal || null,
    timedOut: Boolean(result.timedOut),
    stdoutTail: result.stdout.slice(-2000),
    stderrTail: result.stderr.slice(-2000)
  }
}

async function main() {
  ensureDir(GENERATED_ROOT)

  const startedAt = new Date()
  const runId = `${getShanghaiDateKey(startedAt)}-${startedAt.toISOString().replace(/[:.]/g, '-')}`
  const echoTraceResult = await runEchoTraceCli(startedAt)

  let dbExportResult = null
  if (!skipDbExport) {
    const dbResult = await runNodeScript(path.join(PROJECT_ROOT, 'scripts', 'echotrace-db-export.mjs'), [
      `--db-root=${dbRoot}`,
      `--since-hours=${Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : 6}`
    ])
    dbExportResult = {
      exitCode: dbResult.code,
      summary: parseSummary(dbResult.stdout),
      stdoutTail: dbResult.stdout.slice(-2000),
      stderrTail: dbResult.stderr.slice(-2000)
    }
    if (dbResult.code !== 0) {
      throw new Error(dbResult.stderr || dbResult.stdout || 'EchoTrace DB export failed.')
    }
  }

  const importResult = copyJsonExports()

  const dailyArgs = [
    `--wechat-root=${wechatRoot}`,
    `--since-hours=${Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : 6}`
  ]

  if (shouldPublish) {
    dailyArgs.push('--publish')
  } else {
    dailyArgs.push('--preview-sync')
  }

  if (offlineMode) dailyArgs.push('--offline')
  if (siteOrigin) dailyArgs.push(`--site=${siteOrigin}`)
  if (limit) dailyArgs.push(`--limit=${limit}`)
  if (batch) dailyArgs.push(`--batch=${batch}`)

  const result = await runNodeScript(path.join(PROJECT_ROOT, 'scripts', 'wechat-market-daily.mjs'), dailyArgs)
  const summary = parseSummary(result.stdout)
  const runOutputDir = result.code === 0
    ? copyDailyOutputsToRunSnapshot(runId, summary?.date || getShanghaiDateKey(startedAt), {
      runId,
      date: summary?.date || getShanghaiDateKey(startedAt),
      mode: shouldPublish ? 'publish' : 'preview',
      sinceHours,
      startedAt: startedAt.toISOString(),
      sourceDir,
      wechatRoot,
      dbRoot,
      echoTraceExe,
      summary
    })
    : null
  let marketSummaryResult = null
  if (!skipSummary && result.code === 0) {
    const summaryArgs = [
      '--mode=auto',
      `--date=${summary?.date || getShanghaiDateKey(startedAt)}`,
      `--generated-dir=${runOutputDir}`,
      `--since-hours=${Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : 6}`
    ]
    const summaryResult = await runNodeScript(path.join(PROJECT_ROOT, 'scripts', 'wechat-market-summary.mjs'), summaryArgs)
    marketSummaryResult = {
      exitCode: summaryResult.code,
      summary: parseSummary(summaryResult.stdout),
      stdoutTail: summaryResult.stdout.slice(-2000),
      stderrTail: summaryResult.stderr.slice(-2000)
    }
  }
  let autoExpireResult = { skipped: true, reason: 'publish step failed' }
  if (result.code === 0) {
    try {
      autoExpireResult = await autoExpirePosts(summary?.publishResult?.operatorUserId || summary?.operatorUserId || '')
    } catch (error) {
      autoExpireResult = {
        skipped: false,
        failed: true,
        error: error?.message || String(error)
      }
    }
  }
  const finishedAt = new Date()

  const state = {
    runId,
    mode: shouldPublish ? 'publish' : 'preview',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    sourceDir,
    wechatRoot,
    dbRoot,
    echoTraceExe,
    sinceHours,
    offlineMode,
    echoTraceResult,
    dbExportResult,
    importResult,
    marketSummaryResult,
    autoExpireResult,
    runOutputDir,
    exitCode: result.code,
    summary,
    stdoutTail: result.stdout.slice(-4000),
    stderrTail: result.stderr.slice(-4000)
  }

  const logFile = writeRunLog(runId, state)
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, logFile }, null, 2), 'utf8')

  if (result.code !== 0) {
    console.error(result.stderr || result.stdout)
    process.exit(result.code || 1)
  }

  console.log(JSON.stringify({ ...state, logFile }, null, 2))
}

main().catch((error) => {
  ensureDir(GENERATED_ROOT)
  const failedState = {
    runId: `failed-${Date.now()}`,
    mode: shouldPublish ? 'publish' : 'preview',
    failedAt: new Date().toISOString(),
    error: error?.message || String(error)
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(failedState, null, 2), 'utf8')
  console.error(error)
  process.exit(1)
})
