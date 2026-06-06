import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..')
const CC_ROOT = path.join(WORKSPACE_ROOT, 'cc')
const GENERATED_ROOT = path.join(CC_ROOT, 'generated')
const SUMMARY_ROOT = path.join(CC_ROOT, 'summaries')

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

const mode = args.get('mode') || (flags.has('--manual') || args.get('query') ? 'manual' : 'auto')
const dateArg = args.get('date') || ''
const query = normalize(args.get('query') || '')
const boardFilter = normalize(args.get('board') || '')
const cityFilter = normalize(args.get('city') || '')
const intentFilter = normalizeIntent(args.get('intent') || '')
const kindFilter = normalize(args.get('kind') || '')
const generatedDirArg = args.get('generated-dir') || ''
const sinceHours = Number(args.get('since-hours') || process.env.WECHAT_MARKET_SINCE_HOURS || 6)
const limit = Number(args.get('limit') || (mode === 'manual' ? 20 : 12))

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function compact(value) {
  return normalize(value).toLowerCase().replace(/\s+/g, '')
}

function normalizeIntent(value) {
  const text = compact(value)
  if (!text) return ''
  if (['buy', '收', '求', '买'].includes(text)) return 'buy'
  if (['sell', '出', '卖', '转'].includes(text)) return 'sell'
  return text
}

function getShanghaiDateHour(dateInput) {
  const local = new Date(dateInput.getTime() + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}-${String(local.getUTCHours()).padStart(2, '0')}`
}

function getShanghaiDateTime(dateInput) {
  const local = new Date(dateInput.getTime() + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')} ${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}:${String(local.getUTCSeconds()).padStart(2, '0')}`
}

function latestGeneratedDate() {
  if (!fs.existsSync(GENERATED_ROOT)) return ''
  return fs
    .readdirSync(GENERATED_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .at(-1) || ''
}

function findLatestRunSnapshot(dateKey, preferredSinceHours) {
  const root = path.join(GENERATED_ROOT, 'runs')
  if (!fs.existsSync(root)) return null

  const snapshots = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(root, entry.name)
      const metadata = readJson(path.join(dir, 'run-metadata.json'), null)
      return { dir, metadata, name: entry.name }
    })
    .filter((item) => item.metadata?.date && fs.existsSync(path.join(item.dir, 'deduped-clusters.json')))
    .filter((item) => !dateKey || item.metadata.date === dateKey)
    .filter((item) => {
      if (!Number.isFinite(preferredSinceHours) || preferredSinceHours <= 0) return true
      return Number(item.metadata.sinceHours || 0) === preferredSinceHours
    })
    .sort((a, b) => String(a.metadata.startedAt || a.name).localeCompare(String(b.metadata.startedAt || b.name)))

  return snapshots.at(-1) || null
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex')
}

function safeName(text) {
  return normalize(text)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'all'
}

function intentText(intent) {
  if (intent === 'buy') return '收'
  if (intent === 'sell') return '出'
  return intent || '-'
}

function priceBand(row) {
  const low = Number(row.priceLow || row.low || row.normalizedPrice || 0)
  const high = Number(row.priceHigh || row.high || row.normalizedPrice || 0)
  if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0 && Math.round(low) !== Math.round(high)) {
    return `${Math.round(low)}-${Math.round(high)}`
  }
  const price = Number(row.normalizedPrice || row.referencePrice || low || high || 0)
  return price > 0 ? String(Math.round(price)) : '-'
}

function hotScore(row) {
  return Number(row.signalCount || 1) * 4 + Number(row.groupCount || 1) * 10 + Number(row.confidenceScore || 0)
}

function marketIdentity(row) {
  return [
    row.boardName || row.categoryName || '',
    row.intent || '',
    row.city || '',
    row.itemName || '',
    row.eventDate || '',
    row.specOrTier || ''
  ].join('|')
}

function itemIdentity(row) {
  return [row.boardName || row.categoryName || '', row.intent || '', row.itemName || ''].join('|')
}

function matchesFilters(row) {
  if (boardFilter && !compact(row.boardName || row.categoryName).includes(compact(boardFilter))) return false
  if (cityFilter && !compact(row.city).includes(compact(cityFilter))) return false
  if (intentFilter && normalizeIntent(row.intent) !== intentFilter) return false
  if (kindFilter && compact(row.kind) !== compact(kindFilter)) return false

  if (query) {
    const haystack = compact([
      row.title,
      row.boardName,
      row.categoryName,
      row.itemName,
      row.city,
      row.eventDate,
      row.specOrTier,
      row.quantity,
      ...(Array.isArray(row.keywords) ? row.keywords : []),
      row.source?.source_group,
      row.source?.raw_text
    ].filter(Boolean).join(' '))
    if (!haystack.includes(compact(query))) return false
  }

  return true
}

function summarizeBoard(rows) {
  const boards = new Map()
  for (const row of rows) {
    const board = row.boardName || row.categoryName || '未分类'
    if (!boards.has(board)) {
      boards.set(board, {
        name: board,
        signalCount: 0,
        groupCount: 0,
        publishableCount: 0,
        buyCount: 0,
        sellCount: 0,
        topRows: []
      })
    }
    const boardRow = boards.get(board)
    boardRow.signalCount += Number(row.signalCount || 1)
    boardRow.groupCount += Number(row.groupCount || 1)
    if (row.kind === 'publishable') boardRow.publishableCount += 1
    if (row.intent === 'buy') boardRow.buyCount += 1
    if (row.intent === 'sell') boardRow.sellCount += 1
    boardRow.topRows.push(row)
  }

  return [...boards.values()]
    .map((board) => ({
      ...board,
      topRows: board.topRows.sort((a, b) => hotScore(b) - hotScore(a)).slice(0, 5)
    }))
    .sort((a, b) => b.signalCount - a.signalCount)
}

function buildItemSnapshot(rows) {
  const map = new Map()
  for (const row of rows) {
    const key = itemIdentity(row)
    if (!map.has(key)) {
      map.set(key, {
        key,
        boardName: row.boardName || row.categoryName || '',
        intent: row.intent || '',
        itemName: row.itemName || '',
        signals: 0,
        groups: 0,
        prices: [],
        score: 0
      })
    }
    const item = map.get(key)
    item.signals += Number(row.signalCount || 1)
    item.groups += Number(row.groupCount || 1)
    item.score += hotScore(row)
    const price = Number(row.normalizedPrice || row.referencePrice || 0)
    if (Number.isFinite(price) && price > 0) item.prices.push(price)
  }

  return [...map.values()].map((item) => {
    item.referencePrice = item.prices.length
      ? Math.round(item.prices.reduce((total, value) => total + value, 0) / item.prices.length)
      : 0
    delete item.prices
    return item
  })
}

function findPreviousSnapshot(currentDateHour) {
  const root = path.join(SUMMARY_ROOT, 'auto')
  if (!fs.existsSync(root)) return null

  const files = []
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(fullPath)
      if (entry.isFile() && entry.name.endsWith('-summary.json')) files.push(fullPath)
    }
  }
  visit(root)

  const candidates = files
    .map((file) => ({ file, payload: readJson(file, null) }))
    .filter((item) => item.payload?.meta?.dateHour && item.payload.meta.dateHour < currentDateHour)
    .sort((a, b) => a.payload.meta.dateHour.localeCompare(b.payload.meta.dateHour))

  return candidates.at(-1)?.payload || null
}

function describeChange(row, previousMap) {
  const previous = previousMap.get(itemIdentity(row))
  if (!previous) return '新出现/上一轮未入榜'
  const signalDelta = Number(row.signalCount || 1) - Number(previous.signals || 0)
  const currentPrice = Number(row.normalizedPrice || row.referencePrice || 0)
  const previousPrice = Number(previous.referencePrice || 0)
  const priceDelta = currentPrice > 0 && previousPrice > 0 ? currentPrice - previousPrice : 0
  const signalText = signalDelta === 0 ? '热度持平' : `热度${signalDelta > 0 ? '+' : ''}${signalDelta}`
  const priceText = priceDelta === 0 ? '价格持平' : `价格${priceDelta > 0 ? '+' : ''}${Math.round(priceDelta)}`
  return `${signalText}，${priceText}`
}

function tableRows(rows, previousMap, maxRows) {
  if (!rows.length) {
    return ['| - | 暂无 | 暂无 | - | - | - | 0/0 | 本窗口没有命中交易信号 |']
  }
  return rows.slice(0, maxRows).map((row, index) => (
    `| ${index + 1} | ${row.boardName || row.categoryName || '-'} | ${row.itemName || '-'} | ${intentText(row.intent)} | ${row.city || '全国'} | ${priceBand(row)} | ${Number(row.signalCount || 1)}/${Number(row.groupCount || 1)} | ${describeChange(row, previousMap)} |`
  ))
}

function rawExamples(rows, maxRows) {
  return rows.slice(0, maxRows).map((row, index) => {
    const source = row.source || {}
    const text = normalize(source.raw_text || source.raw_full_text || '').slice(0, 180)
    return `${index + 1}. ${row.title || row.itemName || '未命名行情'}\n   来源：${source.source_group || '-'} / ${source.source_time || '-'} / ${source.source_sender_name || '-'}\n   原文：${text || '-'}`
  })
}

function buildMarkdown({ dateKey, dateHour, generatedAt, report, rows, matchedRows, boards, previousMap, topRows, plan, previousSnapshot }) {
  const filters = [
    query ? `关键词：${query}` : '',
    boardFilter ? `板块：${boardFilter}` : '',
    cityFilter ? `城市：${cityFilter}` : '',
    intentFilter ? `方向：${intentText(intentFilter)}` : '',
    kindFilter ? `类型：${kindFilter}` : ''
  ].filter(Boolean)

  const hottest = boards[0]
  const planLines = plan.length
    ? plan.slice(0, 10).map((item, index) => `${index + 1}. ${item.title}，${intentText(item.intent)}，价格 ${Math.round(Number(item.price || 0)) || '-'}，准备${item.postId ? '更新' : '发布'}`)
    : ['暂无准备上传的交易信息。']

  const boardLines = boards.slice(0, 6).flatMap((board) => [
    `### ${board.name}`,
    `- 热度：${board.signalCount} 条信号，约 ${board.groupCount} 个群次；可发布簇 ${board.publishableCount} 个。`,
    `- 供需：收 ${board.buyCount} / 出 ${board.sellCount}。`,
    `- 热门：${board.topRows.map((row) => `${row.itemName || row.title} ${priceBand(row)}`).join('；') || '-'}`,
    ''
  ])

  return [
    `# 微信行情${mode === 'manual' ? '手动查询' : '6小时总结'} | ${dateHour}`,
    '',
    `生成时间：${generatedAt}`,
    `数据日期：${dateKey}`,
    `时间窗口：最近 ${Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : 6} 小时`,
    filters.length ? `筛选条件：${filters.join('，')}` : '',
    '',
    '## 总览',
    '',
    `- 本次候选信号簇：${rows.length} 个；当前筛选命中：${matchedRows.length} 个。`,
    `- 可发布信号簇：${rows.filter((row) => row.kind === 'publishable').length} 个；发布计划：${plan.length} 条。`,
    `- 最热板块：${hottest?.name || report?.pulse?.hottestBoard || '-'}。`,
    `- 对比基准：${previousSnapshot ? previousSnapshot.meta.dateHour : '暂无上一轮自动总结'}。`,
    '',
    '## 最热行情',
    '',
    '| 排名 | 板块 | 标的 | 方向 | 城市 | 主流价 | 信号/群 | 较上一轮 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...tableRows(topRows, previousMap, limit),
    '',
    '## 板块观察',
    '',
    ...boardLines,
    '## 准备上传',
    '',
    ...planLines.map((line) => `- ${line}`),
    '',
    '## 原始线索摘录',
    '',
    ...rawExamples(topRows, Math.min(10, limit)),
    ''
  ].filter((line) => line !== '').join('\n')
}

function main() {
  const preferredSinceHours = Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : 0
  const snapshot = generatedDirArg
    ? { dir: path.resolve(generatedDirArg), metadata: null }
    : findLatestRunSnapshot(dateArg, preferredSinceHours)
  const fallbackDateKey = dateArg || latestGeneratedDate()
  const generatedDir = snapshot?.dir || (fallbackDateKey ? path.join(GENERATED_ROOT, fallbackDateKey) : '')
  if (!generatedDir) throw new Error('No generated market data found.')

  const clusters = readJson(path.join(generatedDir, 'deduped-clusters.json'), [])
  const report = readJson(path.join(generatedDir, 'report-v2.json'), null)
  const plan = readJson(path.join(generatedDir, 'publish-plan.json'), [])
  const runMetadata = snapshot?.metadata || readJson(path.join(generatedDir, 'run-metadata.json'), null)
  const dateKey = dateArg || report?.meta?.date || runMetadata?.date || fallbackDateKey

  const clusterRows = Array.isArray(clusters) ? clusters : []

  const dateHour = getShanghaiDateHour(new Date())
  const generatedAt = getShanghaiDateTime(new Date())
  const previousSnapshot = findPreviousSnapshot(dateHour)
  const previousMap = new Map((previousSnapshot?.snapshot?.items || []).map((item) => [item.key, item]))

  const rows = [...clusterRows].sort((a, b) => hotScore(b) - hotScore(a))
  const matchedRows = rows.filter(matchesFilters)
  const activeRows = mode === 'manual' || query || boardFilter || cityFilter || intentFilter || kindFilter ? matchedRows : rows
  const topRows = activeRows.slice(0, Math.max(1, limit))
  const boards = summarizeBoard(activeRows)
  const snapshotItems = buildItemSnapshot(rows)

  const markdown = buildMarkdown({
    dateKey,
    dateHour,
    generatedAt,
    report,
    rows,
    matchedRows,
    boards,
    previousMap,
    topRows,
    plan,
    previousSnapshot
  })

  const baseDir = path.join(SUMMARY_ROOT, mode === 'manual' ? 'manual' : 'auto', dateKey)
  ensureDir(baseDir)
  const windowLabel = Number.isFinite(sinceHours) && sinceHours > 0 ? `${sinceHours}h` : 'all'
  const suffix = mode === 'manual'
    ? `query-${safeName(query || [boardFilter, cityFilter, intentFilter].filter(Boolean).join('-') || 'all')}-${windowLabel}-${sha1(JSON.stringify({ query, boardFilter, cityFilter, intentFilter, kindFilter, sinceHours, generatedDir })).slice(0, 8)}`
    : `summary-${windowLabel}`
  const baseName = `${dateHour}-${suffix}`
  const markdownPath = path.join(baseDir, `${baseName}.md`)
  const jsonPath = path.join(baseDir, `${baseName}.json`)

  const payload = {
    meta: {
      mode,
      date: dateKey,
      dateHour,
      generatedAt,
      sinceHours,
      generatedDir,
      previousDateHour: previousSnapshot?.meta?.dateHour || null
    },
    filters: { query, board: boardFilter, city: cityFilter, intent: intentFilter, kind: kindFilter, limit },
    stats: {
      clusterCount: rows.length,
      matchedCount: matchedRows.length,
      publishableCount: rows.filter((row) => row.kind === 'publishable').length,
      planCount: plan.length
    },
    topRows,
    boards,
    plan,
    snapshot: { items: snapshotItems },
    markdownPath,
    jsonPath
  }

  fs.writeFileSync(markdownPath, markdown, 'utf8')
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8')

  const latestMarkdown = path.join(SUMMARY_ROOT, mode === 'manual' ? 'latest-manual-summary.md' : 'latest-auto-summary.md')
  const latestJson = path.join(SUMMARY_ROOT, mode === 'manual' ? 'latest-manual-summary.json' : 'latest-auto-summary.json')
  ensureDir(SUMMARY_ROOT)
  fs.writeFileSync(latestMarkdown, markdown, 'utf8')
  fs.writeFileSync(latestJson, JSON.stringify(payload, null, 2), 'utf8')

  console.log(JSON.stringify({
    mode,
    date: dateKey,
    dateHour,
    matchedCount: matchedRows.length,
    topCount: topRows.length,
    markdownPath,
    jsonPath,
    latestMarkdown,
    latestJson
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error?.message || String(error))
  process.exit(1)
}
