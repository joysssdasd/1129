import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..')
const WECHAT_ROOT = path.join(WORKSPACE_ROOT, 'wechat')
const CC_ROOT = path.join(WORKSPACE_ROOT, 'cc')
const REPORTS_ROOT = path.join(CC_ROOT, 'reports', 'drafts')
const FINAL_REPORTS_ROOT = path.join(CC_ROOT, 'reports', 'final')
const GENERATED_ROOT = path.join(CC_ROOT, 'generated')
const HISTORY_ROOT = path.join(CC_ROOT, 'history')
const LEARNING_FILE = path.join(CC_ROOT, 'learning', '日报学习记录.md')
const SITE_ORIGIN = process.argv.find((arg) => arg.startsWith('--site='))?.split('=')[1] || 'https://www.niuniubase.top'
const SHOULD_PUBLISH = process.argv.includes('--publish')
const SHOULD_PREVIEW_SYNC = process.argv.includes('--preview-sync') || SHOULD_PUBLISH
const SHOULD_DELETE_PROCESSED_WECHAT = !process.argv.includes('--keep-wechat')
const PUBLISH_LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 24)
const PUBLISH_BATCH_SIZE = Number(process.argv.find((arg) => arg.startsWith('--batch='))?.split('=')[1] || 4)
const DATE_OVERRIDE = process.argv.find((arg) => arg.startsWith('--date='))?.split('=')[1] || ''
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/.test(DATE_OVERRIDE) ? DATE_OVERRIDE : getShanghaiDateKey(new Date())
const DEFAULT_OPERATOR_WECHAT = 'niuniubase'
const MANAGED_SYNC_KIND = 'niuniubase.managed-market-sync'
const MANAGED_SYNC_PROTOCOL_VERSION = 1
const INTERNAL_MANAGED_MARKET_PREFIX = '__managed_market__'
const PROCESSING_BATCH_KIND = 'niuniubase.wechat-processing-batch'
const PROCESSING_BATCH_PROTOCOL_VERSION = 1

const CITIES = ['北京','上海','广州','深圳','杭州','南宁','武汉','天津','郑州','重庆','成都','长沙','青岛','绍兴','厦门','佛山','烟台','泉州','贵阳','大连','香港','澳门','首尔','仁川','全国']
const ARTISTS = ['周杰伦','谢霆锋','陶喆','蔡依林','凤凰传奇','张杰','李宗盛','梁静茹','薛之谦','单依纯','张震岳','黄丽玲','胡彦斌','潘玮柏','李荣浩','杨千嬅','张天赋','伍佰','周传雄','郑润泽','余佳运','陈嘉桦','顽童','ONER','BTS','SVT','CNBLUE','NEXZ','孙燕姿','刘德华']
const DIGITAL = ['i茅台','茅台','iPhone','苹果','iPad','华为','荣耀','小米','红米','OPPO','vivo','PS5','Switch','XBOX','ROG','监管机','Mate','Pura','折叠屏']
const COLLECT = ['纪念币','纪念钞','蛇钞','马钞','龙钞','龙币','云商封装龙','中国龙封装','生日钞','金银币','闷包']
const METALS = ['黄金','白金','金条','银条','粤鹏金','粤鹏银','金银条','牛头']
const OTHER = ['影城','电影票','通兑票','年卡','爱奇艺','芒果','优酷','百丽宫','百老汇','耀莱成龙','成龙']
const NOISE = [/验证码/,/查单/,/缓存/,/机器人/,/http/i,/链接/,/卖群/,/换群/]

const TICKET_PATTERNS = [
  /(?<spec>\d{3,4}|前(?:二十|十五|十|八|五|三|一)?排|前区随机|包厢|看台|内场|随机包厢|一层两侧|首层两侧|两侧\/正对(?:包厢)?|两侧|正对|CD区)\s*(?:的|[-—–]{1,2})\s*(?<prices>(?:\d{3,5}|🈚|空|售磬|\?\?)(?:\/(?:\d{3,5}|🈚|空|售磬|\?\?))*)/gu
]
const DIGITAL_PATTERNS = [
  /(?<price>\d{2,5})\s*(?<intent>收|出)\s*(?<qty>\d+(?:台|个|瓶|件|套|箱|张)?)?\s*(?<item>(?:i茅台|茅台|iPhone|苹果|iPad|华为|荣耀|小米|红米|OPPO|vivo|PS5|Switch|XBOX|ROG|监管机|Mate\s*XT|Mate\s*X\d{1,2}|Pura\s*X|Mate\s*70\s*RS|(?:iPhone\s*)?(?:16|17)(?:\s*(?:Pro(?:\s*Max)?|Plus))?)[^ ，。；;、\n]{0,24})/giu,
  /(?<price>\d{2,5})\s*(?<intent>收|出)\s*(?<qty>\d+(?:台|个|瓶|件|套|箱|张)?)?\s*(?<item>(?:7p\/7|8p|6s(?:\s*6sp)?|se2(?:\.64)?|se3代|xR组屏机|X组屏机|11组屏机|12组屏机|13组屏机|14组屏机|p9|p10|p20(?:pro)?)[^ ，。；;、\n]{0,12})/giu,
  /(?<item>(?:iPad|PS5|Switch|iPhone|苹果|华为|荣耀|小米|红米|OPPO|vivo|监管机|Mate\s*XT|Mate\s*X\d{1,2}|Pura\s*X|Mate\s*70\s*RS|(?:iPhone\s*)?(?:16|17)(?:\s*(?:Pro(?:\s*Max)?|Plus))?|7p\/7|8p|se2(?:\.64)?|se3代|xR组屏机|X组屏机|11组屏机|12组屏机|13组屏机|14组屏机|p9|p10|p20(?:pro)?)[^ ，。；;、\n]{0,20})\s*(?<price>\d{2,5})元/giu
]
const COLLECT_PATTERNS = [
  /(?<price>\d{2,5})(?<intent>收|出)(?<qty>\d+(?:个|套|包|张|件)?)?(?<item>(?:云商封装龙[^ ，。；;、\n]{0,18}|中国龙封装|智能卡银行|生日钞[^ ，。；;、\n]{0,16}|蛇钞[^ ，。；;、\n]{0,16}|马钞[^ ，。；;、\n]{0,16}|龙钞[^ ，。；;、\n]{0,16}|龙币[^ ，。；;、\n]{0,16}|纪念币[^ ，。；;、\n]{0,16}|纪念钞[^ ，。；;、\n]{0,16}))/gu
]
const METAL_PATTERNS = [
  /(?<intent>出|收)\s*(?<item>[^0-9，。；;、\n]{0,24}?(?:黄金|白金|金条|银条|粤鹏金|粤鹏银|金银条|牛头)[^0-9，。；;、\n]{0,24})\s*(?<price>\d{2,6})/gu,
  /(?<item>[^0-9，。；;、\n]{0,24}?(?:黄金|白金|金条|银条|粤鹏金|粤鹏银|金银条|牛头)[^0-9，。；;、\n]{0,24})\s*(?<price>\d{2,6})\s*(?<intent>出|收)/gu
]
const OTHER_PATTERNS = [
  /(?<intent>出|收)?\s*(?<item>(?:影城通兑票|通兑票|电影票|年卡|爱奇艺|芒果|优酷|百丽宫|百老汇|耀莱成龙|成龙)[^ ，。；;、\n]{0,24})\s*(?<price>\d{1,5}(?:\.\d+)?)/gu
]
const DIGITAL_JUNK_PATTERN = /(工作机|脱坑机|二手机|组屏机|卡贴机|监管机|小花|大花|下半截|拆机|改码|无码|有锁|无限量|国外订单|低价扣费|安卓工作机)/u
const STALE_DIGITAL_PATTERN = /(7p\/7|iphone\s*7|iphone7|iphone8|8p|6s|6sp|se2|se3|iphonexr|iphonex|苹果x|苹果xr|x组屏机|xr组屏机|11组屏机|12组屏机|13组屏机|14组屏机|红米\d|redmi\d|oppo\s*r\d+|vivox\d+|荣耀\d+|p9|p10|p20)/iu
const DIRECT_PUBLISH_HARDWARE_DIGITAL_RULES = [
  { canonical: 'iPhone17 Pro Max', regex: /(?:iphone|苹果)?17promax/iu },
  { canonical: 'iPhone17 Pro', regex: /(?:iphone|苹果)?17pro/iu },
  { canonical: 'iPhone17', regex: /(?:iphone|苹果)?17/iu },
  { canonical: 'iPhone16 Pro Max', regex: /(?:iphone|苹果)?16promax/iu },
  { canonical: 'iPhone16 Pro', regex: /(?:iphone|苹果)?16pro/iu },
  { canonical: 'iPhone16 Plus', regex: /(?:iphone|苹果)?16plus/iu },
  { canonical: 'iPhone16', regex: /(?:iphone|苹果)?16/iu },
  { canonical: '华为Mate XT', regex: /(?:华为)?matext(?:非凡大师)?|三折叠/iu },
  { canonical: '华为Mate X6', regex: /(?:华为)?matex6/iu },
  { canonical: '华为Pura X', regex: /(?:华为)?purax/iu }
]
const DIRECT_PUBLISH_HARDWARE_DIGITAL_LABELS = 'iPhone 16/16 Plus/16 Pro/16 Pro Max、iPhone 17/17 Pro/17 Pro Max、华为 Mate XT/Mate X6/Pura X'
const MAOTAI_DIRECT_PUBLISH_PATTERN = /(原箱|订单|闷包|散订单|改地址|原件|整箱)/u

function getShanghaiDateKey(dateInput) {
  const local = new Date(dateInput.getTime() + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }) }
function clip(text, limit) { return text && text.length > limit ? `${text.slice(0, limit - 1)}…` : (text || '') }
function sha1(text) { return crypto.createHash('sha1').update(text).digest('hex') }
function normalize(text) { return String(text || '').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim() }
function normalizeMessageBody(text) { return String(text || '').replace(/[—–]/g, '-').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() }
function compact(text) { return normalize(text).replace(/[\s🔥💥‼️❗️🈶🈚️🍉🎫⚠️]/gu, '') }
function uniqueSorted(values) { return [...new Set((values || []).filter(Boolean))].sort() }
function readJsonFile(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, '')) }
function sum(values) { return values.filter((value) => Number.isFinite(value)).reduce((total, value) => total + value, 0) }
function average(values) { const filtered = values.filter((value) => Number.isFinite(value)); return filtered.length ? sum(filtered) / filtered.length : 0 }
function formatBand(low, high) { if (!Number.isFinite(low) && !Number.isFinite(high)) return '样本不足'; if (!Number.isFinite(low)) return `${Math.round(high)}`; if (!Number.isFinite(high)) return `${Math.round(low)}`; return Math.round(low) === Math.round(high) ? `${Math.round(low)}` : `${Math.round(low)}-${Math.round(high)}` }
function percentText(value) { if (!Number.isFinite(value)) return '0%'; const rounded = Math.round(value * 10) / 10; return `${rounded > 0 ? '+' : ''}${rounded}%` }
function ticketDateLabel(text) { return text.match(/\d{1,2}月\d{1,2}(?:[./]\d{1,2}){0,3}日?/u)?.[0] || text.match(/\d{1,2}[./]\d{1,2}(?:[./]\d{1,2}){1,2}/u)?.[0] || text.match(/\d{1,2}(?:\/\d{1,2}){1,3}号?/u)?.[0] || text.match(/\d{1,2}号/u)?.[0] || '' }
function sanitizeTicketText(text) { return String(text || '').replace(/[（(]?(?:反|返)\d+(?:\/\d+)?[^)\n\r]*[）)]?/gu, ' ').replace(/(?:无票)?赔付\d+%?/gu, ' ').replace(/(?:重复购票|信息异常|位子轻微差异|小概率|支持长连|轻微差异|默认\d+-\d+区|默认1680随机区域)[^\n\r]{0,40}/gu, ' ').replace(/退差不退票/gu, ' ').replace(/不退换/gu, ' ').replace(/[+-]?\d{2,4}结算/gu, ' ').replace(/扣\d+%/gu, ' ').replace(/\s+/g, ' ').trim() }
function splitTradeSegments(text) { return String(text || '').split(/\r?\n+/).map((segment) => normalize(segment)).filter((segment) => segment && segment.length >= 4) }
function displaySpec(board, spec) { if (board === '演唱会' && /^\d{3,4}$/.test(spec || '')) return `${spec}档`; return spec || '' }
function loadEnv(file) { if (!fs.existsSync(file)) return {}; return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const idx = line.indexOf('='); return [line.slice(0, idx), line.slice(idx + 1)] })) }
function supabaseConfig() { const envFile = { ...loadEnv(path.join(PROJECT_ROOT, '.env')), ...loadEnv(path.join(PROJECT_ROOT, '.env.production')) }; const env = { ...process.env, ...envFile }; return { url: envFile.SUPABASE_URL || envFile.VITE_SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://hntiihuxqlklpiyqmlob.supabase.co', serviceKey: envFile.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '' } }
async function jsonRequest(url, token, options = {}) { const res = await fetch(url, { ...options, headers: { apikey: token, Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null } catch { data = text } if (!res.ok) throw new Error(data?.message || text || `Request failed: ${res.status}`); return data }
function cityOf(text) { return CITIES.find((city) => text.includes(city)) || '全国' }
function itemFromTicket(text) { return ARTISTS.find((item) => text.includes(item)) || '' }
function normalizeDigitalItemName(item) {
  const value = normalize(item).replace(/\s+/g, '')
  const lower = value.toLowerCase()
  if (!value) return ''
  if (lower === '7p/7') return 'iPhone7P/7'
  if (lower === '8p') return 'iPhone8P'
  if (lower === '6s6sp' || lower === '6s/6sp') return 'iPhone6s/6sp'
  if (lower.startsWith('se2')) return 'iPhoneSE2'
  if (lower === 'se3代') return 'iPhoneSE3'
  if (lower === 'x组屏机') return 'iPhoneX组屏机'
  if (lower === 'xr组屏机') return 'iPhoneXR组屏机'
  if (/^(11|12|13|14)组屏机$/iu.test(value)) return `iPhone${value.match(/^(\d{2})/u)?.[1] || ''}组屏机`
  if (/^p20pro$/iu.test(value)) return 'HuaweiP20Pro'
  if (/^p20$/iu.test(value)) return 'HuaweiP20'
  if (/^p10$/iu.test(value)) return 'HuaweiP10'
  if (/^p9$/iu.test(value)) return 'HuaweiP9'
  if (/^iphone/iu.test(value)) return value.replace(/^iphone/iu, 'iPhone')
  if (/^ipad/iu.test(value)) return value.replace(/^ipad/iu, 'iPad')
  if (/^oppo/iu.test(value)) return value.replace(/^oppo/iu, 'OPPO')
  if (/^vivox/iu.test(value)) return value.replace(/^vivox/iu, 'vivoX')
  if (/^vivo/iu.test(value)) return value.replace(/^vivo/iu, 'vivo')
  if (/^matext$/iu.test(value)) return '华为Mate XT'
  if (/^matex(\d{1,2})$/iu.test(value)) return `华为Mate X${value.match(/^matex(\d{1,2})$/iu)?.[1] || ''}`
  if (/^purax$/iu.test(value)) return '华为Pura X'
  if (/^mate70rs$/iu.test(value)) return '华为Mate 70 RS'
  return value
}
function matchDirectPublishHardwareDigitalRule(text = '') {
  const combined = normalize(text).replace(/\s+/g, '')
  if (!combined) return null
  return DIRECT_PUBLISH_HARDWARE_DIGITAL_RULES.find((rule) => rule.regex.test(combined)) || null
}
function isMaotaiDirectPublishSignal(text = '') {
  const combined = normalize(text).replace(/\s+/g, '')
  if (!/i茅台|茅台/u.test(combined)) return false
  return MAOTAI_DIRECT_PUBLISH_PATTERN.test(combined)
}
function isWhitelistedHardwareDigitalItem(itemName = '') {
  return Boolean(matchDirectPublishHardwareDigitalRule(itemName))
}
function hasWhitelistedHardwareDigitalItems(itemStats = []) {
  return itemStats.some((row) => isWhitelistedHardwareDigitalItem(row.item))
}
function normalizeManagedExtraInfo() {
  return INTERNAL_MANAGED_MARKET_PREFIX
}
function relativeWorkspacePath(fullPath) {
  return path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, '/')
}
function normalizeDigitalPublishItemName(item, rawText = '') {
  const base = normalizeDigitalItemName(item)
  const combined = normalize(`${item} ${rawText}`).replace(/\s+/g, '')
  const hardwareMatch = matchDirectPublishHardwareDigitalRule(combined)
  if (hardwareMatch) return hardwareMatch.canonical
  if (/i茅台|茅台/u.test(combined)) {
    if (/原箱/u.test(combined)) return 'i茅台原箱'
    if (/散订单/u.test(combined) && /改地址/u.test(combined)) return '茅台散订单改地址'
    if (/原件闷包/u.test(combined)) return '茅台原件闷包'
    if (/散闷包/u.test(combined)) return '茅台散闷包'
    if (/订单/u.test(combined)) return 'i茅台订单'
    if (/闷包/u.test(combined)) return 'i茅台闷包'
    return base || 'i茅台'
  }
  return base
}
function shouldDirectPublishDigital(item, rawText = '') {
  const combined = normalize(`${item} ${rawText}`).replace(/\s+/g, '')
  if (!combined) return false
  if (DIGITAL_JUNK_PATTERN.test(combined)) return false
  if (STALE_DIGITAL_PATTERN.test(combined)) return false
  if (isMaotaiDirectPublishSignal(combined)) return true
  return Boolean(matchDirectPublishHardwareDigitalRule(combined))
}
function normalizeMetalSignal(item, price, rawText = '') {
  const normalizedItem = normalize(item).replace(/\s+/g, '')
  const combined = normalize(`${item} ${rawText}`).replace(/\s+/g, '')
  const numericPrice = Number(price || 0)
  const isSilverLike = /(银条|白银|粤鹏银|牛头|悦朋|金银条)/u.test(combined) && numericPrice >= 8 && numericPrice <= 60
  const isGoldLike = /(黄金|金条|足金|金回收|回收金|粤鹏金)/u.test(combined) && numericPrice >= 700 && numericPrice <= 1500
  const isPlatinumLike = /(白金|铂金)/u.test(combined) && numericPrice >= 150 && numericPrice <= 500

  if (isSilverLike) {
    return {
      itemName: /(粤鹏|悦朋|牛头)/u.test(combined) ? '粤鹏银条' : '银条',
      spec: `${numericPrice}元/克`,
      publishable: true
    }
  }

  if (isGoldLike) {
    return {
      itemName: /(金条|粤鹏金)/u.test(combined) ? '金条' : '黄金',
      spec: `${numericPrice}元/克`,
      publishable: true
    }
  }

  if (isPlatinumLike) {
    return {
      itemName: '白金',
      spec: `${numericPrice}元/克`,
      publishable: true
    }
  }

  return {
    itemName: normalizedItem,
    spec: '',
    publishable: false
  }
}
function hasStructuredDigitalSignal(item, rawText, qty) {
  const value = normalizeDigitalPublishItemName(item, rawText)
  return Boolean(qty) || /\d/.test(value) || /(原箱|订单|闷包|改地址|组屏机|卡贴机|监管机)/u.test(`${value} ${rawText || ''}`)
}
function digitalFamilyKey(item) {
  const value = normalizeDigitalItemName(item).toLowerCase()
  if (!value) return ''
  if (value.includes('i茅台') || value.includes('茅台')) return 'maotai'
  if (value.includes('iphone') || value.includes('苹果') || /(7p\/7|8p|6s|se2|se3|x组屏机|xr组屏机|11组屏机|12组屏机|13组屏机|14组屏机)/i.test(value)) return 'apple'
  if (value.includes('redmi') || value.includes('红米')) return 'redmi'
  if (value.includes('小米')) return 'xiaomi'
  if (value.includes('oppo')) return 'oppo'
  if (value.includes('vivo')) return 'vivo'
  if (value.includes('荣耀')) return 'honor'
  if (value.includes('华为') || value.includes('huaweip')) return 'huawei'
  if (value.includes('switch')) return 'switch'
  if (value.includes('ps5')) return 'ps5'
  if (value.includes('xbox')) return 'xbox'
  if (value.includes('rog')) return 'rog'
  return value.slice(0, 24)
}
function normalizeMarketKeyPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[【】\[\]()（）{}<>《》:：,，。；;'"`|\\/]/gu, '')
    .trim()
}
function marketSpecKey(cluster) {
  return cluster.boardName === '演唱会' ? cluster.specOrTier || '' : ''
}
function marketKeyForCluster(cluster) {
  return [
    cluster.categoryName,
    cluster.intent,
    cluster.city || '全国',
    cluster.itemName,
    cluster.eventDate || '',
    marketSpecKey(cluster)
  ]
    .map((value) => normalizeMarketKeyPart(value))
    .filter(Boolean)
    .join('|')
}
function intentOf(text, board) { const buy = ['收','求','接','蹲','要'].filter((k) => text.includes(k)).length; const sell = ['出','卖','转','甩','有货','可出'].filter((k) => text.includes(k)).length; if (buy > sell) return { intent: 'buy', explicit: true }; if (sell > buy) return { intent: 'sell', explicit: true }; return { intent: board === '演唱会' ? 'sell' : '', explicit: false } }
function boardOf(text, group) { const content = `${group} ${text}`; if (COLLECT.some((k) => content.includes(k))) return '纪念币/钞'; if (METALS.some((k) => content.includes(k))) return '贵金属'; if (DIGITAL.some((k) => content.includes(k))) return '数码和茅台'; if (OTHER.some((k) => content.includes(k))) return '其他分类'; if (ARTISTS.some((k) => content.includes(k)) || ['录入','包厢','前排','看台','内场','出票','邀请函','实名','连坐'].filter((k) => content.includes(k)).length >= 2) return '演唱会'; return '' }
function choosePrices(raw, intent) { const values = String(raw || '').split('/').map((s) => s.trim()).filter((s) => /^\d{2,6}$/.test(s)).map(Number); if (!values.length) return null; return { price: intent === 'buy' ? Math.max(...values) : Math.min(...values), low: Math.min(...values), high: Math.max(...values) } }
function candidateBase(message, parsed) {
  let itemName = parsed.board === '数码和茅台'
    ? normalizeDigitalPublishItemName(parsed.item, message.text)
    : normalize(parsed.item).replace(/\s+/g, '')
  let specLabel = displaySpec(parsed.board, parsed.spec)
  let publishableOverride = true

  if (parsed.board === '贵金属') {
    const metal = normalizeMetalSignal(parsed.item, parsed.price, message.text)
    itemName = metal.itemName
    specLabel = metal.spec || specLabel
    publishableOverride = metal.publishable
  }

  if (parsed.board === '数码和茅台') {
    publishableOverride = shouldDirectPublishDigital(itemName, message.text)
  }

  const rounded = Math.round(parsed.price / 10) * 10
  const dedupeKey = [parsed.board, parsed.intent, parsed.city, itemName, parsed.date, specLabel, rounded]
    .map((x) => String(x || '').toLowerCase())
    .join('|')

  let score = 0
  if (parsed.intent) score += parsed.explicitIntent ? 20 : 12
  if (itemName) score += 20
  if (parsed.price > 0) score += 20
  if (parsed.city && parsed.city !== '全国') score += 8
  if (parsed.date) score += 7
  if (specLabel) score += 8
  if (parsed.qty) score += 10
  if (parsed.board !== '演唱会') score += 10
  if (parsed.board === '数码和茅台' && hasStructuredDigitalSignal(itemName, message.text, parsed.qty)) score += 10
  if (parsed.board === '数码和茅台' && /(订单|原箱|闷包|改地址)/u.test(`${itemName} ${message.text}`)) score += 4
  if (parsed.board === '贵金属') score += 14
  if (parsed.board === '贵金属' && /(黄金|白金|金条|银条|粤鹏)/u.test(itemName)) score += 6
  if (compact(message.text).length >= 18) score += 8
  if (parsed.board === '其他分类') score -= 15
  if (NOISE.some((pattern) => pattern.test(message.text))) score -= 30
  if (!publishableOverride) score = Math.min(score, 68)

  const title = clip(
    `[${parsed.city}] ${itemName}${parsed.date ? ` ${parsed.date}` : ''}${specLabel ? ` ${specLabel}` : ''} ${parsed.intent === 'buy' ? '收' : '出'}`
      .replace(/\s+/g, ' ')
      .trim(),
    96
  )
  const extraInfo = normalizeManagedExtraInfo()
  const kind =
    publishableOverride && score >= 80 && parsed.intent && itemName && parsed.price > 0
      ? 'publishable'
      : score >= 60 && parsed.intent && itemName && parsed.price > 0
        ? 'report_only'
        : 'noise'

  return {
    candidateId: sha1(`${message.messageId}|${dedupeKey}|${parsed.price}`),
    source: {
      source_file: message.sourceFile,
      source_group: message.groupName,
      source_message_id: message.messageId,
      source_time: message.time,
      source_sender_name: message.sender,
      raw_text: message.text,
      raw_full_text: message.rawText || message.text
    },
    boardName: parsed.board,
    categoryName: parsed.board,
    intent: parsed.intent,
    itemName,
    city: parsed.city,
    eventDate: parsed.date,
    specOrTier: specLabel,
    quantity: parsed.qty || '',
    priceText: parsed.priceText || '',
    normalizedPrice: parsed.price,
    priceLow: parsed.low || parsed.price,
    priceHigh: parsed.high || parsed.price,
    confidenceScore: Math.max(0, Math.min(100, score)),
    kind,
    directPublish: kind === 'publishable',
    keywords: [itemName, parsed.board, parsed.city, parsed.date, specLabel, parsed.intent === 'buy' ? '收' : '出'].filter(Boolean),
    title,
    extraInfo,
    dedupeKey
  }
}
function parseTicket(message, board) { const cleanedText = sanitizeTicketText(message.text); const { intent, explicit } = intentOf(cleanedText, board); const item = itemFromTicket(cleanedText); const city = cityOf(cleanedText); const date = ticketDateLabel(cleanedText); const candidates = []; const seen = new Set(); for (const pattern of TICKET_PATTERNS) { pattern.lastIndex = 0; for (const match of cleanedText.matchAll(pattern)) { const spec = normalize(match.groups?.spec || ''); const prices = choosePrices(match.groups?.prices || '', intent || 'sell'); if (!item || !spec || !prices) continue; if (/^\d+$/.test(spec) && Number(spec) > 2400) continue; if (prices.price < 300 || prices.price > 20000) continue; const key = `${spec}|${prices.price}`; if (seen.has(key)) continue; seen.add(key); candidates.push(candidateBase({ ...message, text: cleanedText }, { board, intent: intent || 'sell', explicitIntent: explicit, item, city, date, spec, priceText: `${spec} ${match.groups?.prices || ''}`, price: prices.price, low: prices.low, high: prices.high })) } } const regular = candidates.find((c) => !/(前|包厢|内场|VIP|CD区)/.test(c.specOrTier || '')); const premium = candidates.find((c) => /(前|包厢|内场|VIP|CD区)/.test(c.specOrTier || '')); return [regular, premium].filter(Boolean).filter((c, i, arr) => arr.findIndex((x) => x.candidateId === c.candidateId) === i) }
function parseWithPatterns(message, board, patterns) { const candidates = []; const seen = new Set(); for (const segment of splitTradeSegments(message.text)) { const segmentMessage = { ...message, rawText: message.text, text: segment }; const { intent: inferred, explicit } = intentOf(segment, board); for (const pattern of patterns) { pattern.lastIndex = 0; for (const match of segment.matchAll(pattern)) { const price = Number(match.groups?.price || 0); if (!Number.isFinite(price) || price <= 0) continue; if (board === '其他分类' && price < 5) continue; const item = normalize(match.groups?.item || '').replace(/^[出收求卖接转\s]+/u, '').replace(/\s+/g, ''); if (!item) continue; const qty = normalize(match.groups?.qty || ''); const intentToken = match.groups?.intent || ''; const intent = intentToken === '收' ? 'buy' : intentToken === '出' ? 'sell' : inferred; if (!intent) continue; const key = `${item}|${price}|${qty}|${intent}`; if (seen.has(key)) continue; seen.add(key); candidates.push(candidateBase(segmentMessage, { board, intent, explicitIntent: Boolean(intentToken) || explicit, item, city: cityOf(segment), date: '', spec: qty, qty, priceText: `${price}${intent === 'buy' ? '收' : '出'}`, price, low: price, high: price })) } } } return candidates.slice(0, board === '数码和茅台' ? 12 : 4) }
function parseMessage(message) { const board = boardOf(message.text, message.groupName); if (!board || message.text.length < 6) return []; if (board === '演唱会') return parseTicket(message, board); if (board === '数码和茅台') return parseWithPatterns(message, board, DIGITAL_PATTERNS); if (board === '纪念币/钞') return parseWithPatterns(message, board, COLLECT_PATTERNS); if (board === '贵金属') return parseWithPatterns(message, board, METAL_PATTERNS); if (board === '其他分类') return parseWithPatterns(message, board, OTHER_PATTERNS); return [] }
function loadMessages() {
  const rows = []
  const sourceFiles = []
  for (const dir of fs.readdirSync(WECHAT_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === 'EchoTrace') continue
    const fullDir = path.join(WECHAT_ROOT, dir.name)
    for (const file of fs.readdirSync(fullDir)) {
      if (!file.endsWith('.json')) continue
      const fullFile = path.join(fullDir, file)
      sourceFiles.push(fullFile)
      const payload = readJsonFile(fullFile)
      const groupName = payload?.session?.name || payload?.session?.displayName || path.basename(file, '.json')
      for (const row of (payload.messages || [])) {
        const text = normalizeMessageBody(typeof row?.content === 'string' ? row.content : '')
        if (!text || row?.type !== '文本消息') continue
        rows.push({
          sourceFile: path.relative(WORKSPACE_ROOT, fullFile).replace(/\\/g, '/'),
          groupName,
          messageId: row?.localId || sha1(`${fullFile}|${row?.formattedTime}|${text}`),
          time: row?.formattedTime || row?.createTime || '',
          sender: row?.senderDisplayName || row?.senderUsername || '未知发送人',
          text
        })
      }
    }
  }
  const seen = new Map()
  const messages = rows.filter((message) => {
    const key = `${message.sender}|${compact(message.text)}`
    const currentTime = new Date(message.time || Date.now())
    const lastTime = seen.get(key)
    if (lastTime && Math.abs(currentTime - lastTime) <= 6 * 60 * 60 * 1000) return false
    seen.set(key, currentTime)
    return true
  })
  return {
    messages,
    sourceFiles: uniqueSorted(sourceFiles)
  }
}
function dedupeCandidates(candidates) { const map = new Map(); for (const candidate of candidates) { if (!map.has(candidate.dedupeKey)) { map.set(candidate.dedupeKey, { ...candidate, signalCount: 1, groupNames: new Set([candidate.source.source_group]) }) } else { const current = map.get(candidate.dedupeKey); current.signalCount += 1; current.groupNames.add(candidate.source.source_group); current.priceLow = Math.min(current.priceLow, candidate.priceLow || candidate.normalizedPrice); current.priceHigh = Math.max(current.priceHigh, candidate.priceHigh || candidate.normalizedPrice); if (candidate.confidenceScore > current.confidenceScore) { current.confidenceScore = candidate.confidenceScore; current.title = candidate.title; current.extraInfo = candidate.extraInfo; current.keywords = candidate.keywords } } } return [...map.values()].map((cluster) => { cluster.groupCount = cluster.groupNames.size; cluster.groupNames = [...cluster.groupNames]; if (cluster.groupCount >= 2) cluster.confidenceScore = Math.min(100, cluster.confidenceScore + 6); if (cluster.signalCount >= 3) cluster.confidenceScore = Math.min(100, cluster.confidenceScore + 6); if (cluster.confidenceScore >= 80 && cluster.kind !== 'noise') { cluster.kind = 'publishable'; cluster.directPublish = true } else if (cluster.confidenceScore >= 60 && cluster.kind !== 'noise') { cluster.kind = 'report_only'; cluster.directPublish = false } else { cluster.kind = 'noise'; cluster.directPublish = false } return cluster }).sort((a, b) => b.confidenceScore - a.confidenceScore) }
async function loadPublishingContext(config) { const categories = await jsonRequest(`${config.url}/rest/v1/categories?select=id,name,is_active&is_active=eq.true&order=sort_order.asc`, config.serviceKey); const admins = await jsonRequest(`${config.url}/rest/v1/users?select=id,wechat_id,is_admin&is_admin=eq.true&limit=20`, config.serviceKey); const settings = await jsonRequest(`${config.url}/rest/v1/system_settings?select=key,value&category=eq.service`, config.serviceKey); const customerWechat = settings.find((item) => item.key === 'customer_wechat')?.value || DEFAULT_OPERATOR_WECHAT; const operator = admins.find((item) => item.wechat_id === customerWechat) || admins[0]; return { categoryMap: Object.fromEntries(categories.map((row) => [row.name, row.id])), operator } }
function familyKeyForCluster(cluster) {
  if (cluster.boardName === '数码和茅台') return `digital:${digitalFamilyKey(cluster.itemName)}`
  if (cluster.boardName === '演唱会') return `concert:${String(cluster.itemName || '').toLowerCase()}`
  return ''
}
function buildPlan(clusters, categoryMap) { const caps = { '演唱会': 6, '数码和茅台': 6, '贵金属': 1, '纪念币/钞': 4, '其他分类': 1 }; const sourceCaps = { '演唱会': 2, '数码和茅台': 6, '贵金属': 2, '纪念币/钞': 4, '其他分类': 2 }; const familyCaps = { '演唱会': 2, '数码和茅台': 1 }; const seedBoards = ['贵金属', '数码和茅台', '纪念币/钞', '演唱会']; const used = {}; const sourceUsed = {}; const familyUsed = {}; const identityUsed = new Set(); const ordered = [...clusters].sort((a, b) => b.confidenceScore - a.confidenceScore || (b.signalCount || 0) - (a.signalCount || 0) || (b.groupCount || 0) - (a.groupCount || 0)); const plan = []; const canUse = (cluster) => { if (cluster.kind !== 'publishable' || !cluster.directPublish) return false; if (!categoryMap[cluster.categoryName]) return false; const cap = Object.prototype.hasOwnProperty.call(caps, cluster.boardName) ? caps[cluster.boardName] : 2; if ((used[cluster.boardName] || 0) >= cap) return false; const identityKey = marketKeyForCluster(cluster); if (identityUsed.has(identityKey)) return false; const sourceCap = Object.prototype.hasOwnProperty.call(sourceCaps, cluster.boardName) ? sourceCaps[cluster.boardName] : 2; if ((sourceUsed[cluster.source.source_file] || 0) >= sourceCap) return false; const familyKey = familyKeyForCluster(cluster); const familyCap = Object.prototype.hasOwnProperty.call(familyCaps, cluster.boardName) ? familyCaps[cluster.boardName] : Infinity; if (familyKey && (familyUsed[familyKey] || 0) >= familyCap) return false; return true }; const addCluster = (cluster) => { const identityKey = marketKeyForCluster(cluster); const familyKey = familyKeyForCluster(cluster); identityUsed.add(identityKey); sourceUsed[cluster.source.source_file] = (sourceUsed[cluster.source.source_file] || 0) + 1; used[cluster.boardName] = (used[cluster.boardName] || 0) + 1; if (familyKey) familyUsed[familyKey] = (familyUsed[familyKey] || 0) + 1; plan.push({ sourceType: 'wechat_group', sourceRef: cluster.source.source_file, title: cluster.title, itemName: cluster.itemName, city: cluster.city, eventDate: cluster.eventDate, specOrTier: cluster.specOrTier, quantity: cluster.quantity || '', marketKey: identityKey, keywords: clip(cluster.keywords.join(','), 198), price: Number(cluster.normalizedPrice), tradeType: cluster.intent === 'buy' ? 1 : 2, intent: cluster.intent, extraInfo: cluster.extraInfo, categoryId: categoryMap[cluster.categoryName], categoryName: cluster.categoryName, expireHours: 24 * 7, viewLimit: 100, originConfidence: cluster.confidenceScore, dedupeKey: cluster.dedupeKey, rawSnapshot: clip(cluster.source.raw_text, 480), signalCount: cluster.signalCount, groupCount: cluster.groupCount }) }; for (const boardName of seedBoards) { const seed = ordered.find((cluster) => cluster.boardName === boardName && canUse(cluster)); if (seed) addCluster(seed) } for (const cluster of ordered) { if (!canUse(cluster)) continue; addCluster(cluster); if (plan.length >= PUBLISH_LIMIT) break } return plan }
function rowsForBoard(name, clusters, plan) {
  const planRows = plan
    .filter((row) => row.categoryName === name)
    .map((row) => ({
      itemName: row.itemName,
      title: row.title,
      intent: row.intent,
      signalCount: row.signalCount || 1,
      groupCount: row.groupCount || 1,
      priceLow: row.price,
      priceHigh: row.price,
      referencePrice: row.price,
      confidenceScore: row.originConfidence || 0,
      marketKey: row.marketKey
    }))
  if (planRows.length) return planRows
  return clusters
    .filter((row) => row.boardName === name && row.kind !== 'noise')
    .map((row) => ({
      itemName: row.itemName,
      title: row.title,
      intent: row.intent,
      signalCount: row.signalCount || 1,
      groupCount: row.groupCount || 1,
      priceLow: row.priceLow || row.normalizedPrice,
      priceHigh: row.priceHigh || row.normalizedPrice,
      referencePrice: average([row.priceLow || row.normalizedPrice, row.priceHigh || row.normalizedPrice].filter(Boolean)),
      confidenceScore: row.confidenceScore || 0,
      marketKey: marketKeyForCluster(row)
    }))
}

function buildItemStats(rows) {
  const itemMap = new Map()
  for (const row of rows) {
    if (!itemMap.has(row.itemName)) {
      itemMap.set(row.itemName, {
        item: row.itemName,
        titles: [],
        signals: 0,
        groups: 0,
        buys: 0,
        sells: 0,
        low: Infinity,
        high: 0,
        referencePrices: [],
        confidence: [],
        marketKeys: new Set()
      })
    }
    const item = itemMap.get(row.itemName)
    item.signals += Number(row.signalCount || 0)
    item.groups += Number(row.groupCount || 0)
    if (row.intent === 'buy') item.buys += 1
    if (row.intent === 'sell') item.sells += 1
    item.low = Math.min(item.low, Number(row.priceLow || row.referencePrice || 0) || Infinity)
    item.high = Math.max(item.high, Number(row.priceHigh || row.referencePrice || 0) || 0)
    item.referencePrices.push(Number(row.referencePrice || row.priceLow || row.priceHigh || 0) || 0)
    item.confidence.push(Number(row.confidenceScore || 0))
    if (row.title) item.titles.push(row.title)
    if (row.marketKey) item.marketKeys.add(row.marketKey)
  }

  return [...itemMap.values()]
    .map((item) => {
      const low = Number.isFinite(item.low) ? item.low : 0
      const high = Number.isFinite(item.high) ? item.high : 0
      const referencePrice = average(item.referencePrices)
      const supportScore = item.signals * 2 + item.groups + average(item.confidence) / 25
      const demandScore = item.buys * 2 + item.groups + item.signals / 2
      const supplyScore = item.sells * 2 + item.groups + item.signals / 2
      return {
        item: item.item,
        titles: item.titles.slice(0, 3),
        signals: item.signals,
        groups: item.groups,
        buys: item.buys,
        sells: item.sells,
        low,
        high,
        referencePrice,
        confidence: average(item.confidence),
        supportScore,
        demandScore,
        supplyScore,
        marketKeys: [...item.marketKeys]
      }
    })
    .sort((a, b) => b.supportScore - a.supportScore || b.groups - a.groups || b.signals - a.signals)
}

function classifySupplyDemand(buyCount, sellCount) {
  if (sellCount >= buyCount * 2 && sellCount >= 2) return '供给强'
  if (buyCount >= sellCount * 1.5 && buyCount >= 2) return '需求强'
  return '相对平衡'
}

function classifyTrend(itemStats, buyCount, sellCount) {
  const wide = itemStats.some((row) => row.low > 0 && row.high > row.low * 1.35)
  if (wide) return '分化'
  if (buyCount > sellCount) return '偏强'
  if (sellCount > buyCount) return '偏弱'
  return '震荡'
}

function boardObserve(name, topItems, supply, trend, itemStats = []) {
  const labels = topItems.map((row) => row.item).join('、') || '头部标的'
  if (name === '演唱会') {
    return `票务里 ${labels} 最活跃，当前挂站信号仍以主流看台档和少量高溢价档位为主。`
  }
  if (name === '数码和茅台') {
    const hardwareRows = itemStats.filter((row) => isWhitelistedHardwareDigitalItem(row.item))
    const maotaiRows = itemStats.filter((row) => /i茅台|茅台/u.test(row.item))
    if (!hardwareRows.length && maotaiRows.length) {
      return `今天数码板块只保留 ${labels} 这类高流动性茅台盘，旗舰手机回收价还不够连续，宁可空着也不挂旧机。`
    }
    if (!hardwareRows.length) {
      return `今天没有足够高质量的旗舰机回收盘进站，当前继续坚持白名单，只等 ${DIRECT_PUBLISH_HARDWARE_DIGITAL_LABELS} 这类标的。`
    }
    return `数码板块只保留 ${hardwareRows.map((row) => row.item).join('、')} 这类白名单标的，${maotaiRows.length ? `茅台盘用 ${maotaiRows.map((row) => row.item).join('、')} 做成交锚点。` : '旧机和废料盘继续拦在站外。'}`
  }
  if (name === '纪念币/钞') {
    return `纪念币钞里 ${labels} 的报价最规整，买盘和卖盘都能看到明确挂价。`
  }
  if (name === '贵金属') {
    return '贵金属样本仍偏少，目前更像是小规模现货流转，价值在于补齐板块存在感。'
  }
  return `${name} 里 ${labels} 的报价最集中，当前供需表现为 ${supply}、盘面节奏为 ${trend}。`
}

function boardForecast(name, supply, trend, itemStats = []) {
  if (name === '演唱会') {
    if (trend === '分化') return '高价档继续分化，主流看台档更适合挂站养成交。'
    if (supply === '需求强') return '强势买盘短线仍可能抬价，核心档位更容易先被接走。'
    return '供给偏多的票务盘更容易先松动，优先观察主流档位是否回落。'
  }
  if (name === '数码和茅台') {
    if (!hasWhitelistedHardwareDigitalItems(itemStats)) {
      return `继续等 ${DIRECT_PUBLISH_HARDWARE_DIGITAL_LABELS} 这类白名单机型出现连续回收价，当前宁缺毋滥。`
    }
    return supply === '需求强' ? '高频回收机型和原箱茅台短线仍有抬价空间。' : '先以库存消化为主，短线偏稳或略弱。'
  }
  if (name === '纪念币/钞') {
    return supply === '需求强' ? '热门封装货若继续有买盘抬价，板块情绪会继续偏强。' : '主流价带已比较集中，短线大概率围绕当前区间成交。'
  }
  if (name === '贵金属') {
    return '先看窄幅整理，后续要继续补连续报价群，才能判断是否会从展示盘变成实用盘。'
  }
  return '短线先看主流价带是否守住，等待更多连续报价确认方向。'
}

function loadPreviousReportState(currentDateKey) {
  if (!fs.existsSync(GENERATED_ROOT)) return null
  const candidates = fs
    .readdirSync(GENERATED_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && entry.name < currentDateKey)
    .map((entry) => entry.name)
    .sort()
  const previousDateKey = candidates[candidates.length - 1]
  if (!previousDateKey) return null
  const reportFile = path.join(GENERATED_ROOT, previousDateKey, 'report-v2.json')
  if (!fs.existsSync(reportFile)) return null
  try {
    return JSON.parse(fs.readFileSync(reportFile, 'utf8'))
  } catch {
    return null
  }
}

function describeRiseMove(item, previousItem) {
  if (!item) return '主升暂不明显，今天更像存量盘延续。'
  const band = formatBand(item.low, item.high)
  if (!previousItem) {
    return `${item.item} 是今天的新强势项，当前主流价带 ${band}，需求和曝光都在前排。`
  }
  const priceDeltaPct = previousItem.referencePrice > 0 ? ((item.referencePrice - previousItem.referencePrice) / previousItem.referencePrice) * 100 : 0
  const signalDelta = item.signals - previousItem.signals
  return `${item.item} 偏强，主流 ${band}，较上一轮 ${signalDelta >= 0 ? '信号增量' : '热度略回落'} ${Math.abs(signalDelta)}，价格变化 ${percentText(priceDeltaPct)}。`
}

function describeFallMove(item, previousItem) {
  if (!item) return '主跌暂不明显，盘面整体还算稳定。'
  const band = formatBand(item.low, item.high)
  if (!previousItem) {
    return `${item.item} 当前卖盘更重，主流 ${band}，但更像新出现的偏弱盘，不是持续阴跌。`
  }
  const priceDeltaPct = previousItem.referencePrice > 0 ? ((item.referencePrice - previousItem.referencePrice) / previousItem.referencePrice) * 100 : 0
  const signalDelta = item.signals - previousItem.signals
  return `${item.item} 偏弱，主流 ${band}，较上一轮 ${signalDelta >= 0 ? '热度未放大' : '热度回落'} ${Math.abs(signalDelta)}，价格变化 ${percentText(priceDeltaPct)}。`
}

function pickMover(itemStats, previousSection, direction) {
  const previousMap = new Map((previousSection?.itemStats || []).map((row) => [row.item, row]))
  const scored = itemStats.map((row) => {
    const previous = previousMap.get(row.item) || null
    const priceDeltaPct = previous?.referencePrice > 0 ? ((row.referencePrice - previous.referencePrice) / previous.referencePrice) * 100 : 0
    const signalDelta = row.signals - Number(previous?.signals || 0)
    const score =
      direction === 'up'
        ? (previous ? priceDeltaPct : 6) + signalDelta * 1.5 + (row.buys - row.sells) * 2 + row.groups
        : (previous ? -priceDeltaPct : 4) + (Number(previous?.signals || 0) - row.signals) * 1.2 + (row.sells - row.buys) * 2 + (row.groups <= 1 ? 1 : 0)
    return { ...row, previous, score, priceDeltaPct, signalDelta }
  })
  const filtered = scored.filter((row) =>
    direction === 'up'
      ? row.buys >= row.sells || row.priceDeltaPct > 3 || row.signalDelta > 0 || (!row.previous && row.supportScore >= 20)
      : row.sells > row.buys || row.priceDeltaPct < -3 || row.signalDelta < 0
  )
  return filtered.sort((a, b) => b.score - a.score)[0] || null
}

function boardSummary(name, clusters, plan, previousState) {
  const rows = rowsForBoard(name, clusters, plan)
  if (!rows.length) {
    return {
      name,
      hot: [],
      bands: [],
      supply: '相对平衡',
      trend: '震荡',
      observe: '当日有效样本偏少。',
      forecast: '短线先看横盘，等更多连续报价。',
      mainRise: '主升暂不明显，今天样本仍不足。',
      mainFall: '主跌暂不明显，今天样本仍不足。',
      itemStats: [],
      buyCount: 0,
      sellCount: 0,
      demandStrength: 0,
      supplyStrength: 0
    }
  }

  const itemStats = buildItemStats(rows)
  const buyCount = sum(rows.map((row) => (row.intent === 'buy' ? 1 : 0)))
  const sellCount = sum(rows.map((row) => (row.intent === 'sell' ? 1 : 0)))
  const supply = classifySupplyDemand(buyCount, sellCount)
  const trend = classifyTrend(itemStats, buyCount, sellCount)
  const top = itemStats.slice(0, 3)
  const riseItem = pickMover(itemStats, previousState?.sections?.find((section) => section.name === name), 'up')
  const fallItem = pickMover(itemStats, previousState?.sections?.find((section) => section.name === name), 'down')

  return {
    name,
    hot: top.map((row) => row.item),
    bands: top.map((row) => `${row.item} 主流 ${formatBand(row.low, row.high)}`),
    supply,
    trend,
    observe: boardObserve(name, top, supply, trend, itemStats),
    forecast: boardForecast(name, supply, trend, itemStats),
    mainRise: describeRiseMove(riseItem, riseItem?.previous),
    mainFall: describeFallMove(fallItem, fallItem?.previous),
    itemStats,
    buyCount,
    sellCount,
    demandStrength: sum(itemStats.map((row) => row.demandScore)),
    supplyStrength: sum(itemStats.map((row) => row.supplyScore))
  }
}

function buildGlobalPulse(sections) {
  const strongestDemand = [...sections].sort((a, b) => ((b.buyCount + 1) / (b.sellCount + 1)) * Math.sqrt(Math.max(1, sum(b.itemStats.map((row) => row.signals)))) - ((a.buyCount + 1) / (a.sellCount + 1)) * Math.sqrt(Math.max(1, sum(a.itemStats.map((row) => row.signals)))))[0]
  const strongestSupply = [...sections].sort((a, b) => ((b.sellCount + 1) / (b.buyCount + 1)) * Math.sqrt(Math.max(1, sum(b.itemStats.map((row) => row.signals)))) - ((a.sellCount + 1) / (a.buyCount + 1)) * Math.sqrt(Math.max(1, sum(a.itemStats.map((row) => row.signals)))))[0]
  const hottestBoard = [...sections].sort((a, b) => sum(b.itemStats.map((row) => row.signals)) - sum(a.itemStats.map((row) => row.signals)))[0]
  const riseLeads = sections.map((section) => section.mainRise).filter(Boolean).slice(0, 2)
  const fallLeads = sections.map((section) => section.mainFall).filter(Boolean).slice(0, 2)
  return {
    strongestDemand: strongestDemand?.name || '暂无',
    strongestSupply: strongestSupply?.name || '暂无',
    hottestBoard: hottestBoard?.name || '暂无',
    riseLeads,
    fallLeads
  }
}

function buildPromoVariants(sections, pulse, meta) {
  const concert = sections.find((section) => section.name === '演唱会')
  const digital = sections.find((section) => section.name === '数码和茅台')
  const collect = sections.find((section) => section.name === '纪念币/钞')
  const metal = sections.find((section) => section.name === '贵金属')
  const leadConcert = concert?.hot[0] || '票务头部盘'
  const digitalHasHardware = hasWhitelistedHardwareDigitalItems(digital?.itemStats || [])
  const leadDigital = digital?.hot[0] || '数码回收盘'
  const digitalNarrative = digitalHasHardware
    ? `${leadDigital} 给出清晰回收锚价`
    : `${leadDigital} 托住数码板块，但旗舰机回收盘今天继续宁缺毋滥`
  const leadCollect = collect?.hot[0] || '纪念币钞主流盘'
  const leadMetal = metal?.hot[0] || '贵金属现货盘'

  return {
    titles: [
      `牛牛日报：${leadConcert}领跑，${digitalHasHardware ? `${leadDigital}接力` : '数码宁缺毋滥'}，四板块都有实盘`,
      `今天哪些还在强，哪些开始松：${leadConcert}、${leadDigital}、${leadCollect} 实盘速览`,
      `四板块并重的实盘日报：票务热、数码严选、纪念币清晰、贵金属补位`
    ],
    friendCircle: `今天的盘面不再只有票务。${leadConcert} 继续活跃，${digitalNarrative}，${leadCollect} 和 ${leadMetal} 也都能讲清楚。今天站内精选 ${meta.planCount} 条活盘，四个板块都能拿出有参考价值的实盘判断。`,
    groupFlash: `【牛牛日报快讯】1. 最热板块是 ${pulse.hottestBoard}；2. 需求最强的是 ${pulse.strongestDemand}，供给最强的是 ${pulse.strongestSupply}；3. 今天站内精选 ${meta.planCount} 条，四板块都有可看盘。`,
    siteLead: `今天四个板块都能整理出有参考价值的实盘信号。票务继续带流量，数码和茅台只保留能真正成交的目标，纪念币钞最适合做高质量补位，贵金属负责补齐品类存在感。${digitalHasHardware ? '' : '旗舰旧机一律不硬挂，宁可少也不污染站内盘面。'}`
      .trim(),
    shortAlert: `四板块都有活盘，不再只是票务独撑。`
  }
}

function buildReport(messages, clusters, plan) {
  const previousState = loadPreviousReportState(DATE_KEY)
  const sections = ['演唱会', '数码和茅台', '贵金属', '纪念币/钞'].map((name) => boardSummary(name, clusters, plan, previousState))
  const groupCount = new Set(messages.map((row) => row.groupName)).size
  const publishable = clusters.filter((row) => row.kind === 'publishable').length
  const reportOnly = clusters.filter((row) => row.kind === 'report_only').length
  const pulse = buildGlobalPulse(sections)
  const promo = buildPromoVariants(sections, pulse, {
    groupCount,
    messageCount: messages.length,
    planCount: plan.length
  })

  const digitalHasHardware = hasWhitelistedHardwareDigitalItems(sections[1]?.itemStats || [])
  const overview = `今天的盘面不再只是票务独走。${sections[0].hot.slice(0, 2).join('、') || '票务头部盘'} 继续扛流量，${sections[1].hot[0] || '数码和茅台盘'} 只保留还能真正成交的目标${digitalHasHardware ? '' : '，手机回收盘继续坚持白名单、宁缺毋滥'}，${sections[3].hot[0] || '纪念币钞主流盘'} 和 ${sections[2].hot[0] || '贵金属盘口'} 也都能支撑内容补位。`
  const lines = [
    `# 牛牛日报 | ${DATE_KEY}`,
    '',
    '## 今日结论',
    '',
    overview,
    '',
    `今天整理出 ${publishable} 条高置信可发站信号，另有 ${reportOnly} 条只适合做行情参考。最终精选 ${plan.length} 条有效盘口，适合直接挂站和对外宣发。`,
    '',
    '## 主升主跌',
    '',
    `- 今日主升观察：${sections.map((section) => `${section.name}：${section.mainRise}`).join('；')}`,
    `- 今日主跌观察：${sections.map((section) => `${section.name}：${section.mainFall}`).join('；')}`,
    '',
    '## 供需强弱',
    '',
    `- 最强需求板块：${pulse.strongestDemand}`,
    `- 最强供给板块：${pulse.strongestSupply}`,
    `- 今日最热板块：${pulse.hottestBoard}`,
    '',
  ]

  for (const section of sections) {
    lines.push(
      `## ${section.name}`,
      '',
      `- 热门标的：${section.hot.join('、') || '样本较少'}`,
      `- 主流价带：${section.bands.join('；') || '样本不足'}`,
      `- 供需判断：${section.supply}`,
      `- 主升：${section.mainRise}`,
      `- 主跌：${section.mainFall}`,
      `- 今日观察：${section.observe}`,
      `- 明日预判：${section.forecast}`,
      ''
    )
  }

  lines.push(
    '## 宣传短文案',
    '',
    `- 朋友圈版：${promo.friendCircle}`,
    `- 社群快讯版：${promo.groupFlash}`,
    `- 站内导语版：${promo.siteLead}`,
    `- 一句话提醒：${promo.shortAlert}`,
    '',
    '## 标题备选',
    '',
    ...promo.titles.map((title) => `- ${title}`),
    '',
    '## 明日观察清单',
    '',
    ...(plan.slice(0, 6).map((row) => `- ${row.title}`) || ['- 暂无足够高置信样本'])
  )

  return {
    markdown: `${lines.join('\n')}\n`,
    meta: {
      date: DATE_KEY,
      groupCount,
      messageCount: messages.length,
      publishableSignalCount: publishable,
      reportOnlySignalCount: reportOnly,
      planCount: plan.length,
      previousDate: previousState?.meta?.date || null
    },
    pulse,
    sections,
    promo
  }
}

function buildManagedSyncManifest(messages, rawCandidates, clusters, plan, report, operator) {
  const activeMarketKeys = [...new Set(plan.map((row) => row.marketKey).filter(Boolean))]
  const sourceFiles = [...new Set(plan.map((row) => row.sourceRef).filter(Boolean))]
  const planHash = sha1(
    JSON.stringify(
      plan.map((row) => ({
        marketKey: row.marketKey,
        title: row.title,
        price: row.price,
        tradeType: row.tradeType,
        categoryId: row.categoryId
      }))
    )
  )
  const runId = `wechat-market-${DATE_KEY}-${planHash.slice(0, 10)}`
  const planId = `plan-${DATE_KEY}-${planHash.slice(0, 12)}`

  return {
    kind: MANAGED_SYNC_KIND,
    protocolVersion: MANAGED_SYNC_PROTOCOL_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      workflow: 'wechat-market-daily',
      timezone: 'Asia/Shanghai',
      siteOrigin: SITE_ORIGIN,
      sourceDate: DATE_KEY,
      sourceFiles
    },
    run: {
      runId,
      runDate: DATE_KEY,
      dryRun: false
    },
    operator: {
      userId: operator?.id || '',
      wechatId: DEFAULT_OPERATOR_WECHAT
    },
    report: {
      date: report.meta.date,
      previousDate: report.meta.previousDate || null,
      strongestDemand: report.pulse.strongestDemand,
      strongestSupply: report.pulse.strongestSupply,
      hottestBoard: report.pulse.hottestBoard,
      titles: report.promo.titles.slice(0, 3)
    },
    stats: {
      groupCount: report.meta.groupCount,
      messageCount: messages.length,
      rawCandidateCount: rawCandidates.length,
      clusterCount: clusters.length,
      publishableSignalCount: report.meta.publishableSignalCount,
      reportOnlySignalCount: report.meta.reportOnlySignalCount,
      planCount: plan.length
    },
    plan: {
      planId,
      planHash,
      payloadHash: planHash,
      syncMode: 'managed_market',
      deactivateMissing: true,
      activeMarketKeys,
      posts: plan
    },
    confirmation: {
      mode: 'model_confirmed_direct_publish',
      contactWechat: DEFAULT_OPERATOR_WECHAT,
      note: '模型负责确认有效交易信号，执行层只负责托管同步、替换旧价和下架缺席旧盘。'
    }
  }
}

function buildBatchManifest(manifest, posts, options = {}) {
  const activeMarketKeys = options.activeMarketKeys || manifest.plan.activeMarketKeys || []
  const payloadHash = sha1(
    JSON.stringify({
      posts: posts.map((row) => ({
        marketKey: row.marketKey,
        title: row.title,
        price: row.price,
        tradeType: row.tradeType,
        categoryId: row.categoryId
      })),
      activeMarketKeys,
      deactivateMissing: options.deactivateMissing === true,
      dryRun: options.dryRun === true,
      phase: options.phase || ''
    })
  )

  return {
    ...manifest,
    generatedAt: new Date().toISOString(),
    run: {
      ...manifest.run,
      dryRun: options.dryRun === true
    },
    execution: {
      phase: options.phase || 'sync-batch',
      batchIndex: Number.isFinite(options.batchIndex) ? options.batchIndex : null,
      batchCount: Number.isFinite(options.batchCount) ? options.batchCount : null
    },
    plan: {
      ...manifest.plan,
      payloadHash,
      deactivateMissing: options.deactivateMissing === true,
      activeMarketKeys,
      posts
    }
  }
}

function coreOutputPaths(dateKey = DATE_KEY) {
  const outputDir = path.join(GENERATED_ROOT, dateKey)
  return [
    path.join(outputDir, 'processing-manifest.json'),
    path.join(outputDir, 'raw-candidates.json'),
    path.join(outputDir, 'deduped-clusters.json'),
    path.join(outputDir, 'publish-plan.json'),
    path.join(outputDir, 'managed-sync-manifest.json'),
    path.join(outputDir, 'report-v2.json'),
    path.join(REPORTS_ROOT, `${dateKey}-牛牛日报.md`),
    path.join(REPORTS_ROOT, `${dateKey}-牛牛日报-V2.md`),
    path.join(FINAL_REPORTS_ROOT, `${dateKey}-牛牛日报-正式版.md`),
    path.join(HISTORY_ROOT, `${dateKey}-自动处理.md`)
  ]
}

function buildProcessingManifest(sourceFiles = []) {
  const relativeFiles = uniqueSorted(sourceFiles.map((file) => relativeWorkspacePath(file)))
  return {
    kind: PROCESSING_BATCH_KIND,
    protocolVersion: PROCESSING_BATCH_PROTOCOL_VERSION,
    batchId: sha1(JSON.stringify({ date: DATE_KEY, files: relativeFiles })),
    date: DATE_KEY,
    generatedAt: new Date().toISOString(),
    sourceFileCount: relativeFiles.length,
    sourceFiles: relativeFiles,
    cleanupPolicy: {
      deleteProcessedWechatFiles: SHOULD_DELETE_PROCESSED_WECHAT,
      requiredOutputs: coreOutputPaths(DATE_KEY).map((file) => relativeWorkspacePath(file))
    }
  }
}

function writeProcessingManifest(processingManifest) {
  const outputDir = path.join(GENERATED_ROOT, DATE_KEY)
  ensureDir(outputDir)
  fs.writeFileSync(path.join(outputDir, 'processing-manifest.json'), JSON.stringify(processingManifest, null, 2), 'utf8')
}

function verifyCoreOutputs(dateKey = DATE_KEY) {
  const requiredFiles = coreOutputPaths(dateKey)
  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file))
  return {
    ok: missingFiles.length === 0,
    requiredFiles: requiredFiles.map((file) => relativeWorkspacePath(file)),
    missingFiles: missingFiles.map((file) => relativeWorkspacePath(file))
  }
}

function writeOutputs(rawCandidates, clusters, plan, report, manifest) {
  const outputDir = path.join(GENERATED_ROOT, DATE_KEY)
  ensureDir(outputDir)
  ensureDir(REPORTS_ROOT)
  ensureDir(FINAL_REPORTS_ROOT)
  ensureDir(HISTORY_ROOT)

  fs.writeFileSync(path.join(outputDir, 'raw-candidates.json'), JSON.stringify(rawCandidates, null, 2), 'utf8')
  fs.writeFileSync(path.join(outputDir, 'deduped-clusters.json'), JSON.stringify(clusters, null, 2), 'utf8')
  fs.writeFileSync(path.join(outputDir, 'publish-plan.json'), JSON.stringify(plan, null, 2), 'utf8')
  fs.writeFileSync(path.join(outputDir, 'managed-sync-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  fs.writeFileSync(path.join(outputDir, 'report-v2.json'), JSON.stringify(report, null, 2), 'utf8')
  fs.writeFileSync(path.join(REPORTS_ROOT, `${DATE_KEY}-牛牛日报.md`), report.markdown, 'utf8')
  fs.writeFileSync(path.join(REPORTS_ROOT, `${DATE_KEY}-牛牛日报-V2.md`), report.markdown, 'utf8')
  fs.writeFileSync(path.join(FINAL_REPORTS_ROOT, `${DATE_KEY}-牛牛日报-正式版.md`), report.markdown, 'utf8')
  fs.writeFileSync(
    path.join(HISTORY_ROOT, `${DATE_KEY}-自动处理.md`),
    `# ${DATE_KEY} 自动处理\n\n- 原始候选：${rawCandidates.length}\n- 去重后信号簇：${clusters.length}\n- 准备发站：${plan.length}\n- 原始文件：${uniqueSorted(rawCandidates.map((row) => row.source.source_file)).length}\n- 最强需求板块：${report.pulse.strongestDemand}\n- 最强供给板块：${report.pulse.strongestSupply}\n- 今日最热板块：${report.pulse.hottestBoard}\n- 核心输出校验：待写入完成后执行\n`,
    'utf8'
  )

  if (fs.existsSync(LEARNING_FILE) && !fs.readFileSync(LEARNING_FILE, 'utf8').includes(`## ${DATE_KEY} 自动处理回放`)) {
    fs.appendFileSync(
      LEARNING_FILE,
      `\n## ${DATE_KEY} 自动处理回放\n\n- 本次扫描 ${new Set(rawCandidates.map((row) => row.source.source_group)).size} 个群、${rawCandidates.length} 条候选，去重后保留 ${clusters.length} 个信号簇\n- 日报 V2 已补上主升主跌、供需强弱和多版本宣传短文案\n- 票务重复刷屏依然最重，6 小时内同发送人重复文案去重必须保留\n- 非票务板块里，i茅台账号服务类消息噪音高，订单和原箱收货更适合直接进站\n- 纪念币钞目前以封装龙类买盘最清楚，贵金属仍需要继续补真实报价群\n`,
      'utf8'
    )
  }
}
function deleteProcessedWechatFiles(sourceFiles = []) {
  const deletedFiles = []
  const missingFiles = []
  const failedFiles = []
  const touchedDirs = new Set()

  for (const fullFile of uniqueSorted(sourceFiles)) {
    try {
      if (!fs.existsSync(fullFile)) {
        missingFiles.push(fullFile)
        continue
      }
      fs.unlinkSync(fullFile)
      deletedFiles.push(fullFile)
      touchedDirs.add(path.dirname(fullFile))
    } catch (error) {
      failedFiles.push({
        file: fullFile,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const removedDirs = []
  for (const dir of [...touchedDirs].sort((a, b) => b.length - a.length)) {
    try {
      if (!fs.existsSync(dir)) continue
      if (fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir)
        removedDirs.push(dir)
      }
    } catch {}
  }

  return {
    deletedCount: deletedFiles.length,
    missingCount: missingFiles.length,
    failedCount: failedFiles.length,
    deletedFiles: deletedFiles.map((file) => path.relative(WORKSPACE_ROOT, file).replace(/\\/g, '/')),
    missingFiles: missingFiles.map((file) => path.relative(WORKSPACE_ROOT, file).replace(/\\/g, '/')),
    failedFiles: failedFiles.map((row) => ({
      ...row,
      file: path.relative(WORKSPACE_ROOT, row.file).replace(/\\/g, '/')
    })),
    removedDirs: removedDirs.map((dir) => path.relative(WORKSPACE_ROOT, dir).replace(/\\/g, '/'))
  }
}
function writeProcessedWechatCleanup(cleanupResult, outputVerification = null) {
  if (!cleanupResult) return
  const outputDir = path.join(GENERATED_ROOT, DATE_KEY)
  ensureDir(outputDir)
  const payload = {
    ...cleanupResult,
    outputVerification
  }
  fs.writeFileSync(path.join(outputDir, 'processed-wechat-cleanup.json'), JSON.stringify(payload, null, 2), 'utf8')
  fs.appendFileSync(
    path.join(HISTORY_ROOT, `${DATE_KEY}-自动处理.md`),
    `\n## 原始聊天文件清理\n\n- 删除文件：${cleanupResult.deletedCount}\n- 缺失文件：${cleanupResult.missingCount}\n- 删除失败：${cleanupResult.failedCount}\n- 核心输出校验：${outputVerification?.ok ? '通过' : '未通过'}\n`,
    'utf8'
  )
}
function writeExecutionOutputs(previewResult, publishResult) {
  const outputDir = path.join(GENERATED_ROOT, DATE_KEY)
  ensureDir(outputDir)
  if (previewResult) {
    fs.writeFileSync(path.join(outputDir, 'managed-sync-preview.json'), JSON.stringify(previewResult, null, 2), 'utf8')
  }
  if (publishResult) {
    fs.writeFileSync(path.join(outputDir, 'managed-sync-execution.json'), JSON.stringify(publishResult, null, 2), 'utf8')
  }
}

async function requestManagedSync(manifest, adminId) {
  const res = await fetch(`${SITE_ORIGIN.replace(/\/$/, '')}/api/admin/wechat-auto-publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-user-id': adminId },
    body: JSON.stringify({ manifest })
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok || !data?.success) throw new Error(data?.error?.message || text || 'Failed to sync managed market posts')
  return data.data
}

async function previewManagedSync(manifest, adminId) {
  const previewManifest = buildBatchManifest(manifest, manifest.plan.posts, {
    dryRun: true,
    deactivateMissing: true,
    activeMarketKeys: manifest.plan.activeMarketKeys,
    phase: 'preview'
  })
  return requestManagedSync(previewManifest, adminId)
}

async function publishPlan(manifest, adminId) {
  const plan = manifest.plan.posts || []
  if (!plan.length) return { publishedCount: 0, failedCount: 0, posts: [] }
  const batches = []
  for (let index = 0; index < plan.length; index += Math.max(1, PUBLISH_BATCH_SIZE)) {
    batches.push(plan.slice(index, index + Math.max(1, PUBLISH_BATCH_SIZE)))
  }

  const aggregate = {
    operatorUserId: adminId,
    operatorWechatId: DEFAULT_OPERATOR_WECHAT,
    publishedCount: 0,
    updatedCount: 0,
    refreshedCount: 0,
    deactivatedCount: 0,
    failedCount: 0,
    posts: [],
    createdPosts: [],
    updatedPosts: [],
    refreshedPosts: [],
    deactivatedPosts: [],
    failures: [],
    actions: [],
    syncMeta: null
  }

  for (let index = 0; index < batches.length; index += 1) {
    const batchManifest = buildBatchManifest(manifest, batches[index], {
      deactivateMissing: false,
      phase: 'sync-batch',
      batchIndex: index + 1,
      batchCount: batches.length
    })
    const result = await requestManagedSync(batchManifest, adminId)
    aggregate.operatorUserId = result.operatorUserId || aggregate.operatorUserId
    aggregate.operatorWechatId = result.operatorWechatId || aggregate.operatorWechatId
    aggregate.publishedCount += Number(result.publishedCount || 0)
    aggregate.updatedCount += Number(result.updatedCount || 0)
    aggregate.refreshedCount += Number(result.refreshedCount || 0)
    aggregate.failedCount += Number(result.failedCount || 0)
    aggregate.posts.push(...(result.posts || []))
    aggregate.createdPosts.push(...(result.createdPosts || []))
    aggregate.updatedPosts.push(...(result.updatedPosts || []))
    aggregate.refreshedPosts.push(...(result.refreshedPosts || []))
    aggregate.failures.push(...(result.failures || []))
    aggregate.actions.push(...(result.actions || []))
    aggregate.syncMeta = result.syncMeta || aggregate.syncMeta
  }

  const finalizeManifest = buildBatchManifest(manifest, [], {
    deactivateMissing: true,
    activeMarketKeys: manifest.plan.activeMarketKeys,
    phase: 'finalize',
    batchIndex: batches.length,
    batchCount: batches.length
  })
  const finalize = await requestManagedSync(finalizeManifest, adminId)
  aggregate.operatorUserId = finalize.operatorUserId || aggregate.operatorUserId
  aggregate.operatorWechatId = finalize.operatorWechatId || aggregate.operatorWechatId
  aggregate.deactivatedCount = Number(finalize.deactivatedCount || 0)
  aggregate.deactivatedPosts = finalize.deactivatedPosts || []
  aggregate.failedCount += Number(finalize.failedCount || 0)
  aggregate.failures.push(...(finalize.failures || []))
  aggregate.actions.push(...(finalize.actions || []))
  aggregate.syncMeta = finalize.syncMeta || aggregate.syncMeta
  return aggregate
}

const loaded = loadMessages()
const processingManifest = buildProcessingManifest(loaded.sourceFiles)
writeProcessingManifest(processingManifest)
const messages = loaded.messages
const rawCandidates = messages.flatMap((message) => parseMessage(message)).filter((row) => row.itemName && row.normalizedPrice > 0)
const clusters = dedupeCandidates(rawCandidates)
const config = supabaseConfig()
const { categoryMap, operator } = await loadPublishingContext(config)
const plan = buildPlan(clusters, categoryMap)
const report = buildReport(messages, clusters, plan)
const manifest = buildManagedSyncManifest(messages, rawCandidates, clusters, plan, report, operator)
writeOutputs(rawCandidates, clusters, plan, report, manifest)
const previewResult = SHOULD_PREVIEW_SYNC ? await previewManagedSync(manifest, operator.id) : null
if (SHOULD_PUBLISH && Number(previewResult?.failedCount || 0) > 0) {
  throw new Error(`Managed sync preview failed with ${previewResult.failedCount} errors. Aborting publish.`)
}
const publishResult = SHOULD_PUBLISH ? await publishPlan(manifest, operator.id) : null
writeExecutionOutputs(previewResult, publishResult)
const outputVerification = verifyCoreOutputs(DATE_KEY)
const cleanupResult = SHOULD_DELETE_PROCESSED_WECHAT
  ? outputVerification.ok
    ? deleteProcessedWechatFiles(loaded.sourceFiles)
    : {
        deletedCount: 0,
        missingCount: 0,
        failedCount: 0,
        deletedFiles: [],
        missingFiles: [],
        failedFiles: [],
        removedDirs: [],
        skipped: true,
        reason: 'core outputs missing; processed source files were kept'
      }
  : null
writeProcessedWechatCleanup(cleanupResult, outputVerification)
console.log(JSON.stringify({ date: DATE_KEY, sourceMessages: messages.length, rawCandidates: rawCandidates.length, clusters: clusters.length, publishPlanCount: plan.length, operatorUserId: operator.id, previewResult, publishResult, outputVerification, cleanupResult }, null, 2))
