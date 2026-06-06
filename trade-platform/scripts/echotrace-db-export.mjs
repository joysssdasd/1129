import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..')
const DEFAULT_WECHAT_ROOT = path.join(WORKSPACE_ROOT, 'wechat')
const DEFAULT_DB_ROOT = path.join(DEFAULT_WECHAT_ROOT, 'EchoTrace')
const DEFAULT_OUTPUT_ROOT = path.join(DEFAULT_WECHAT_ROOT, 'auto-import', 'echotrace-db')
const GENERATED_ROOT = path.join(WORKSPACE_ROOT, 'cc', 'generated')

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const index = arg.indexOf('=')
      return [arg.slice(2, index), arg.slice(index + 1)]
    })
)

const dbRoot = path.resolve(args.get('db-root') || process.env.ECHOTRACE_DB_ROOT || DEFAULT_DB_ROOT)
const outputRoot = path.resolve(args.get('output-root') || process.env.ECHOTRACE_EXPORT_OUTPUT || DEFAULT_OUTPUT_ROOT)
const sinceHours = Number(args.get('since-hours') || process.env.WECHAT_MARKET_SINCE_HOURS || 6)
const sinceUnix = Number.isFinite(sinceHours) && sinceHours > 0 ? Math.floor(Date.now() / 1000 - sinceHours * 60 * 60) : 0

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function getShanghaiDateHour(dateInput) {
  const local = new Date(dateInput.getTime() + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}-${String(local.getUTCHours()).padStart(2, '0')}`
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex')
}

function safeName(text) {
  return String(text || 'unknown')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'unknown'
}

function pythonCandidates() {
  return [
    process.env.PYTHON,
    path.join(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe'),
    'py',
    'python'
  ].filter(Boolean)
}

function findPython() {
  for (const candidate of pythonCandidates()) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true })
    if (result.status === 0) return candidate
  }
  return ''
}

function unpackValue(value) {
  if (!value) return []
  if (value.kind === 'text') return [String(value.text || '')]
  if (value.kind !== 'bytes' || !value.base64) return []

  const buffer = Buffer.from(value.base64, 'base64')
  const candidates = []

  if (buffer.length >= 4 && buffer[0] === 0x28 && buffer[1] === 0xb5 && buffer[2] === 0x2f && buffer[3] === 0xfd) {
    try {
      candidates.push(zstdDecompressSync(buffer).toString('utf8'))
    } catch {
      // Fall through to raw decoding.
    }
  }

  candidates.push(buffer.toString('utf8'))
  return candidates
}

function cleanText(text, senderUsername = '') {
  let value = String(text || '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()

  if (senderUsername) {
    const prefix = `${senderUsername}:\n`
    if (value.startsWith(prefix)) value = value.slice(prefix.length).trim()
  }

  value = value.replace(/^[A-Za-z0-9_@.-]{3,80}:\n/, '').trim()
  return value
}

function textScore(text) {
  const value = String(text || '')
  if (value.length < 2) return -100
  let score = Math.min(value.length, 200)
  if (/[\u4e00-\u9fff]/u.test(value)) score += 80
  if (/\d{2,6}/.test(value)) score += 20
  if (/(出|收|求|卖|接|票|档|茅台|iPhone|黄金|银条|纪念|龙钞|蛇钞)/iu.test(value)) score += 40
  if (/<msgsource|^\(|�{2,}/iu.test(value)) score -= 100
  return score
}

function chooseContent(row) {
  const candidates = [
    ...unpackValue(row.messageContent),
    ...unpackValue(row.compressContent)
  ]
    .map((text) => cleanText(text, row.senderUsername))
    .filter(Boolean)

  candidates.sort((a, b) => textScore(b) - textScore(a))
  return candidates[0] || ''
}

function formatShanghaiTime(unixSeconds) {
  const value = Number(unixSeconds || 0)
  if (!Number.isFinite(value) || value <= 0) return ''
  const local = new Date(value * 1000 + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')} ${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}:${String(local.getUTCSeconds()).padStart(2, '0')}`
}

function shouldKeepText(text) {
  const value = String(text || '').trim()
  if (value.length < 4) return false
  if (/(加入群聊|退出群聊|撤回了一条消息|拍了拍)/u.test(value)) return false
  return true
}

function runSqliteDump(python, outputJsonl) {
  const script = path.join(PROJECT_ROOT, 'scripts', 'echotrace-sqlite-dump.py')
  return spawnSync(python, [script, `--db-root=${dbRoot}`, `--since=${sinceUnix}`, `--output-jsonl=${outputJsonl}`], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  })
}

function writeExports(rows) {
  const outputDir = path.join(outputRoot, getShanghaiDateHour(new Date()))
  ensureDir(outputDir)

  const groups = new Map()
  for (const row of rows) {
    const content = chooseContent(row)
    if (!shouldKeepText(content)) continue

    const key = `${row.account}|${row.session}`
    if (!groups.has(key)) {
      groups.set(key, {
        account: row.account,
        session: {
          wxid: row.session,
          nickname: row.sessionName,
          remark: row.sessionName,
          displayName: row.sessionName,
          type: '群聊',
          lastTimestamp: 0,
          messageCount: 0
        },
        messages: []
      })
    }

    const group = groups.get(key)
    const createTime = Number(row.createTime || 0)
    group.session.lastTimestamp = Math.max(group.session.lastTimestamp || 0, createTime)
    group.messages.push({
      localId: row.localId,
      serverId: row.serverId,
      createTime,
      formattedTime: formatShanghaiTime(createTime),
      type: '文本消息',
      localType: row.localType,
      content,
      isSend: 0,
      senderUsername: row.senderUsername || '',
      senderDisplayName: row.senderDisplayName || row.senderUsername || '未知发送人',
      source: 'echotrace-db'
    })
  }

  let fileCount = 0
  let messageCount = 0
  for (const group of groups.values()) {
    group.messages.sort((a, b) => Number(a.createTime || 0) - Number(b.createTime || 0))
    group.session.messageCount = group.messages.length
    if (!group.messages.length) continue

    const fileName = `${safeName(group.session.displayName)}_${sha1(`${group.account}|${group.session.wxid}`).slice(0, 12)}.json`
    fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify({
      session: group.session,
      messages: group.messages
    }, null, 2), 'utf8')
    fileCount += 1
    messageCount += group.messages.length
  }

  return { outputDir, fileCount, messageCount }
}

function main() {
  if (!fs.existsSync(dbRoot)) {
    console.log(JSON.stringify({ dbRoot, outputDir: null, fileCount: 0, messageCount: 0, skipped: true, reason: 'db root not found' }, null, 2))
    return
  }

  const python = findPython()
  if (!python) {
    throw new Error('No usable Python executable found for SQLite export.')
  }

  ensureDir(GENERATED_ROOT)
  const dumpPath = path.join(GENERATED_ROOT, `echotrace-db-dump-${Date.now()}.jsonl`)
  const result = runSqliteDump(python, dumpPath)
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'EchoTrace SQLite dump failed.')
  }

  const rows = []
  const errors = []
  const dumpText = fs.existsSync(dumpPath) ? fs.readFileSync(dumpPath, 'utf8') : ''
  for (const line of dumpText.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line)
      if (row.kind === 'message') rows.push(row)
      if (row.kind === 'error') errors.push(row)
    } catch {
      errors.push({ kind: 'error', error: `Invalid JSON line: ${line.slice(0, 120)}` })
    }
  }

  try {
    fs.rmSync(dumpPath, { force: true })
  } catch {
    // Best-effort cleanup only.
  }

  const writeResult = writeExports(rows)
  console.log(JSON.stringify({
    dbRoot,
    python,
    sinceHours,
    sinceUnix,
    scannedRows: rows.length,
    errors: errors.slice(0, 20),
    errorCount: errors.length,
    ...writeResult
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error?.message || String(error))
  process.exit(1)
}
