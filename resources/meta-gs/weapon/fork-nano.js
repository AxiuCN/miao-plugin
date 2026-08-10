/*
* Fork 补缺：从 Atlas-Plugin nanoka 数据源注册上游未实装的武器
*
* 场景：上游 miao-plugin 尚未收录的武器（如白湖冬羽等 12 把），
* 而 nanoka 图鉴已收录。启动时从 nanoka 武器数据读取属性/素材/特效，
* 注册武器并注入运行时详情（_detail），图片路径直接指向 nanoka gallery，
* 不产生任何静态资源文件。
*
* 过渡性：上游更新后（meta.getId 命中）自动跳过，不覆盖上游数据。
* 独立性：Atlas-Plugin 数据目录缺失/读取失败时静默跳过，不影响其他功能。
* */
import fs from 'node:fs'
import { Data } from '#miao'

// nanoka 武器数据根目录（相对 app 根）
const NANO_BASE = `${Data.getRoot()}/plugins/Atlas-Plugin/tool/nanoka-atlas-backend/nanoka-atlas-backend/data/items/简体中文/原神/武器`
// gallery 图片相对 resources 根路径（渲染时 _res_path 前缀 + 此相对路径可访问到 gallery）
const GALLERY_REL = '../../Atlas-Plugin/tool/nanoka-atlas-backend/nanoka-atlas-backend/gallery/gi'

// 补缺武器清单：仅注册 nanoka 属性数据完整的武器（缺副属性武器 calcAttr 会崩溃，不注册）
const NANO_WEAPONS = [
  { id: 11520, name: '白湖冬羽', star: 5, type: 'sword' },
  { id: 11521, name: '星锋剑', star: 5, type: 'sword' },
  { id: 11435, name: '熔猎异端之刃', star: 4, type: 'sword' },
  { id: 11436, name: '引火之源', star: 4, type: 'sword' },
  { id: 13435, name: '寒息', star: 4, type: 'polearm' },
  { id: 13436, name: '戍望谣歌', star: 4, type: 'polearm' },
  { id: 14435, name: '群王局戏', star: 4, type: 'catalyst' },
  { id: 14436, name: '寸心余响', star: 4, type: 'catalyst' },
  { id: 12435, name: '金律铸影', star: 4, type: 'claymore' },
  { id: 12436, name: '救赎之斩', star: 4, type: 'claymore' },
  { id: 15435, name: '悬黎千钧', star: 4, type: 'bow' },
  { id: 15436, name: '霜雪誓约', star: 4, type: 'bow' }
]

// nanoka 武器类型 → miao 武器目录
const TYPE_MAP = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_POLE: 'polearm',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst'
}

// 副属性 prop_type → miao key + 倍数（百分比型 ×100，精通数值型 ×1）
const BONUS_MAP = {
  FIGHT_PROP_CRITICAL: { key: 'cpct', mul: 100 },
  FIGHT_PROP_CRITICAL_HURT: { key: 'cdmg', mul: 100 },
  FIGHT_PROP_CHARGE_EFFICIENCY: { key: 'recharge', mul: 100 },
  FIGHT_PROP_ATTACK_PERCENT: { key: 'atkPct', mul: 100 },
  FIGHT_PROP_HP_PERCENT: { key: 'hpPct', mul: 100 },
  FIGHT_PROP_DEFENSE_PERCENT: { key: 'defPct', mul: 100 },
  FIGHT_PROP_PHYSICAL_ADD_HURT: { key: 'phy', mul: 100 },
  FIGHT_PROP_ELEMENT_MASTERY: { key: 'mastery', mul: 1 }
}

// miao 武器 14 档 → 突破次数/等级
const KEY_ASC = { '1': 0, '20': 0, '20+': 1, '40': 1, '40+': 2, '50': 2, '50+': 3, '60': 3, '60+': 4, '70': 4, '70+': 5, '80': 5, '80+': 6, '90': 6 }
const KEY_LV = { '1': 1, '20': 20, '20+': 20, '40': 40, '40+': 40, '50': 50, '50+': 50, '60': 60, '60+': 60, '70': 70, '70+': 70, '80': 80, '80+': 80, '90': 90 }

const fmt2 = (v) => Math.round(v * 100) / 100
// <color=#xxx> → <span style="color:#xxx">，</color> → </span>；清理 {LINK#...}
const fixDesc = (s) => String(s || '')
  .replace(/<color=([^>]+)>/g, '<span style="color:$1">')
  .replace(/<\/color>/g, '</span>')
  .replace(/\{LINK#\d+\}/g, '')

/**
 * 从 nanoka 武器详情生成 miao 武器详情
 * 属性公式：atk(lv, asc) = base_atk × 曲线[lv] + ascension[asc]；
 *           bonus(lv) = init × 曲线[lv] × mul
 * @param {object} det - nanoka 武器 content.detail
 * @returns {object|false} miao 详情结构（attr/materials/affixData），数据缺失时返回 false
 */
function buildDetail (det) {
  const prop = det.weapon_prop || []
  const baseProp = prop.find(p => p.prop_type === 'FIGHT_PROP_BASE_ATTACK')
  const bonusProp = prop.find(p => p.prop_type !== 'FIGHT_PROP_BASE_ATTACK')
  if (!baseProp) {
    return false
  }
  const sm = det.stats_modifier || {}
  const asc = det.ascension || {}
  const ascKeys = Object.keys(sm)
  const atkCurve = sm.atk?.levels || {}
  let bonusKey = null
  let bonusMul = 1
  let bonusCurve = null
  if (bonusProp) {
    const bm = BONUS_MAP[bonusProp.prop_type]
    if (!bm) {
      return false
    }
    bonusKey = bm.key
    bonusMul = bm.mul
    // stats_modifier 的 bonus 曲线 key：prop_type 小写
    const curveKey = ascKeys.find(k => k === bonusProp.prop_type.toLowerCase())
    bonusCurve = curveKey ? sm[curveKey].levels : null
    if (!bonusCurve) {
      return false
    }
  }
  const atk = {}
  const bonus = {}
  for (const k of Object.keys(KEY_ASC)) {
    const lv = KEY_LV[k]
    const ac = KEY_ASC[k]
    const c = atkCurve[String(lv)]
    if (c == null) {
      return false
    }
    const ascAdd = ac > 0 ? (asc[String(ac)] || {}).fight_prop_base_attack || 0 : 0
    atk[k] = fmt2(baseProp.init_value * c + ascAdd)
    if (bonusCurve) {
      bonus[k] = fmt2(bonusProp.init_value * bonusCurve[String(lv)] * bonusMul)
    }
  }
  // materials 取第 6 阶（最高突破）
  const mats6 = (det.materials || {})['6']?.mats || []
  const materials = { weapon: mats6[0]?.name, monster: mats6[1]?.name, normal: mats6[2]?.name }
  // affixData：精 1 描述（静态文本，参数已内嵌；<color> 转 <span>）
  const r1 = (det.refinement || {})['1'] || {}
  const affixText = fixDesc(r1.desc)
  const affixData = affixText ? { text: affixText, datas: {} } : null
  const desc = fixDesc(det.desc)
  return {
    attr: { atk, ...(bonusKey ? { bonusKey, bonusData: bonus } : {}) },
    materials,
    ...(affixData ? { affixData } : {}),
    ...(r1.name ? { affixTitle: r1.name } : {}),
    ...(desc ? { desc } : {})
  }
}

/**
 * 查找 nanoka 武器数据
 * @param {string} name 武器名
 * @returns {{detail: object, recordId: number}|null}
 */
function findNano (name) {
  for (const star of ['五星', '四星', '三星', '二星', '一星']) {
    const dir = `${NANO_BASE}/${star}`
    if (!fs.existsSync(dir)) {
      continue
    }
    let files
    try {
      files = fs.readdirSync(dir)
    } catch (e) {
      continue
    }
    for (const fn of files) {
      if (!fn.endsWith('.json')) {
        continue
      }
      let d
      try {
        d = JSON.parse(fs.readFileSync(`${dir}/${fn}`, 'utf8'))
      } catch (e) {
        continue
      }
      if (d.meta?.name === name) {
        return { detail: d.content?.detail || {}, recordId: d.meta?.recordId }
      }
    }
  }
  return null
}

/**
 * 注册补缺武器
 * @param {object} meta - 原神武器 Meta 实例（Meta.create('gs', 'weapon')）
 */
export function addNanoPending (meta) {
  for (const w of NANO_WEAPONS) {
    // 上游已注册该武器（id 或名字命中）则跳过，上游更新后自动让位
    if (meta.getId(String(w.id)) || meta.getId(w.name)) {
      continue
    }
    const nano = findNano(w.name)
    if (!nano) {
      continue
    }
    const detail = buildDetail(nano.detail)
    if (!detail) {
      continue
    }
    const img = nano.detail.icon ? `${GALLERY_REL}/${nano.detail.icon}.webp` : ''
    meta.addDataItem(String(w.id), {
      id: w.id,
      name: w.name,
      type: w.type,
      star: w.star,
      _detail: detail,
      ...(img ? { img } : {})
    })
    logger?.info(`[miao] nanoka 补缺注册武器: ${w.name} (${w.id})`)
  }
}
