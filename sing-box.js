/**
 * Sub-Store sing-box 配置生成脚本
 * 适配版本: sing-box v1.13.x (Stable) ~ v1.13.14
 * 全中文化版本（含地区组）
 *
 * $arguments.name  = 订阅/集合名称
 * $arguments.type  = "col" 或 "1" 表示 collection，其余为 subscription
 *
 * 多订阅模式：
 * $arguments.name  = 订阅A    $arguments.type  = 1
 * $arguments.name1 = 订阅B    $arguments.type1 = 1
 * $arguments.name2 = 订阅C    $arguments.type2 = 1
 */

const { name, type } = $arguments

const COMPATIBLE_TAG = 'COMPATIBLE'
const compatibleOutbound = { tag: COMPATIBLE_TAG, type: 'direct' }

// ─── 地区分组（全中文 tag）───
const REGION_MAP = [
  {
    tags: ['香港', '香港-自动'],
    regex: /港|🇭🇰|hongkong|hong\s*kong|\bhk\b/i,
  },
  {
    tags: ['台湾', '台湾-自动'],
    regex: /台[湾灣]|🇹🇼|taiwan|\btw\b/i,
  },
  {
    tags: ['日本', '日本-自动'],
    regex: /日本|🇯🇵|japan|\bjp\b/i,
  },
  {
    tags: ['韩国', '韩国-自动'],
    regex: /韩[国國]|🇰🇷|korea|south\s*korea|\bkr\b/i,
  },
  {
    tags: ['新加坡', '新加坡-自动'],
    regex: /新加坡|🇸🇬|singapore|\bsg\b/i,
  },
  {
    tags: ['美国', '美国-自动'],
    regex: /美[国國]|🇺🇸|united\s*states|\bus\b/i,
  },
  {
    tags: ['全部节点', '全部节点-自动'],
    regex: null,
  },
]

// ─── 1. 解析模板 ───
let config
try {
  config = JSON.parse($files[0])
} catch (e) {
  throw new Error('[sing-box] 模板 JSON 解析失败：' + e.message)
}

// ─── 2. 构建订阅源列表 ───
const rawSources = []

if ($arguments.name) {
  rawSources.push({
    name: $arguments.name,
    type: $arguments.type || 'sub',
  })
}

let idx = 1
while ($arguments[`name${idx}`]) {
  rawSources.push({
    name: $arguments[`name${idx}`],
    type: $arguments[`type${idx}`] || 'sub',
  })
  idx++
}

if (rawSources.length === 0) {
  throw new Error('[sing-box] 未找到任何订阅参数，请配置 name 或 name1/name2...')
}

const isMulti = rawSources.length > 1
const sources = rawSources.map((s, i) => ({
  ...s,
  prefix: isMulti
    ? (i < 26 ? String.fromCharCode(65 + i) : String(i + 1))
    : null,
}))

// ─── 3. 逐个拉取订阅节点 ───
const allProxies = []

for (const source of sources) {
  let proxies
  try {
    proxies = await produceArtifact({
      name: source.name,
      type: /^1$|col/i.test(source.type) ? 'collection' : 'subscription',
      platform: 'sing-box',
      produceType: 'internal',
    })
  } catch (e) {
    console.log(`[WARN] 订阅 "${source.name}" 拉取失败，已跳过：${e.message}`)
    continue
  }

  if (!proxies || proxies.length === 0) {
    console.log(`[WARN] 订阅 "${source.name}" 未返回任何节点，已跳过`)
    continue
  }

  if (source.prefix) {
    proxies.forEach(p => {
      p.tag = `[${source.prefix}] ${p.tag}`
    })
  }

  allProxies.push(...proxies)
  console.log(`[INFO] 订阅 "${source.name}" 成功拉取 ${proxies.length} 个节点（前缀: ${source.prefix || '无'}）`)
}

if (allProxies.length === 0) {
  throw new Error('[sing-box] 所有订阅均未获取到节点，请检查配置。')
}

console.log(`[INFO] 共拉取节点 ${allProxies.length} 个，来自 ${sources.length} 个订阅`)

// ─── 4. 将全部节点追加到 outbounds ───
config.outbounds.push(...allProxies)

// ─── 5. 按地区分组填入节点 tag ───
config.outbounds.forEach(outbound => {
  if (!Array.isArray(outbound.outbounds)) return
  for (const region of REGION_MAP) {
    if (region.tags.includes(outbound.tag)) {
      outbound.outbounds.push(...getTags(allProxies, region.regex))
      break
    }
  }
})

// ─── 6. 空分组兜底 ───
let compatibleAdded = false
config.outbounds.forEach(outbound => {
  if (
    Array.isArray(outbound.outbounds) &&
    outbound.outbounds.length === 0
  ) {
    if (!compatibleAdded) {
      config.outbounds.push(compatibleOutbound)
      compatibleAdded = true
    }
    outbound.outbounds.push(COMPATIBLE_TAG)
  }
})

// ─── 7. 顶层输出 ───
$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  if (!regex) return proxies.map(p => p.tag)
  return proxies.filter(p => regex.test(p.tag)).map(p => p.tag)
}
