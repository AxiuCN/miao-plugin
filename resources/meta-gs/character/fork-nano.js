/*
* Fork 补缺：从 Atlas-Plugin nanoka 数据源自动注册上游未更新的角色
*
* 场景：上游 miao-plugin 尚未更新角色数据（如 7.0 奥黛塔/阿罗夏），
* 而 nanoka 图鉴数据已收录。启动时扫描 nanoka 角色目录，对 miao 缺失的
* 角色注册基础信息（id/星级/元素/武器）及完整等级属性表，使其可通过
* 面板变换 查询。
*
* 过渡性：上游更新后（data.json 已存在该角色）自动跳过，不覆盖上游数据。
* 独立性：Atlas-Plugin 数据目录缺失/读取失败时静默跳过，不影响其他功能。
* */
import fs from 'node:fs'
import { Data } from '#miao'

// nanoka 角色数据根目录（相对 app 根）
const NANO_BASE = `${Data.getRoot()}/plugins/Atlas-Plugin/tool/nanoka-atlas-backend/nanoka-atlas-backend/data/items/简体中文/原神/角色`
// gallery 图片相对 resources 根路径（渲染时 _res_path 前缀 + 此相对路径可访问到 gallery）
const GALLERY_REL = '../../Atlas-Plugin/tool/nanoka-atlas-backend/nanoka-atlas-backend/gallery/gi'

// 原神武器类型枚举 → miao 武器类型
const WEAPON_MAP = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_POLE: 'polearm',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst'
}

// nanoka 稀有度 → 星级
const STAR_MAP = { 五星: 5, 四星: 4, 三星: 3 }

// nanoka 突破成长属性字段 → miao 属性 key（mul：百分比型 ×100，数值型 ×1）
const GROW_MAP = [
  { field: 'fight_prop_critical_hurt', key: 'cdmg', mul: 100 },
  { field: 'fight_prop_critical_chance', key: 'cpct', mul: 100 },
  { field: 'fight_prop_hp_percent', key: 'hpPct', mul: 100 },
  { field: 'fight_prop_attack_percent', key: 'atkPct', mul: 100 },
  { field: 'fight_prop_defense_percent', key: 'defPct', mul: 100 },
  { field: 'fight_prop_charge_efficiency', key: 'recharge', mul: 100 },
  { field: 'fight_prop_elemental_mastery', key: 'mastery', mul: 1 },
  { field: 'fight_prop_heal_add', key: 'heal', mul: 1 }
]

// nanoka ascension 基础属性键名（全称）
const ASC_KEY = { hp: 'fight_prop_base_hp', atk: 'fight_prop_base_attack', def: 'fight_prop_base_defense' }

// miao attr.details 档位 → 突破次数（0 = 未突破）
const KEY_ASC = {
  '1': 0, '20': 0, '20+': 1, '40': 1, '40+': 2, '50': 2, '50+': 3,
  '60': 3, '60+': 4, '70': 4, '70+': 5, '80': 5, '80+': 6, '90': 6, '90+': 6, '100': 6
}
// miao attr.details 档位 → 等级
const KEY_LV = {
  '1': 1, '20': 20, '20+': 20, '40': 40, '40+': 40, '50': 50, '50+': 50,
  '60': 60, '60+': 60, '70': 70, '70+': 70, '80': 80, '80+': 80, '90': 90, '90+': 90, '100': 100
}

// hp 取整（与 miao 数据一致），其他保留 2 位小数
const fmtHp = (v) => Math.round(v)
const fmt2 = (v) => Math.round(v * 100) / 100

/**
 * 从 nanoka 角色详情生成 miao 属性表
 * 公式：属性(lv, 突破次数) = base_1 × 曲线[lv] + ascension[突破次数-1]
 * @param {object} nanoDetail - nanoka 角色 content.detail
 * @returns {object|false} miao 属性结构（baseAttr/growAttr/attr），数据缺失时返回 false
 */
function buildDetail (nanoDetail) {
  let sm = nanoDetail.stats_modifier || {}
  let base = { hp: nanoDetail.base_hp, atk: nanoDetail.base_atk, def: nanoDetail.base_def }
  let curve = { hp: sm.hp, atk: sm.atk, def: sm.def }
  let asc = sm.ascension || []
  // 成长属性：asc[0] 除 base 三键外的字段
  let grow = GROW_MAP.find(g => g.field in (asc[0] || {})) || null
  if (!grow || !base.hp || !curve.hp || !curve.atk || !curve.def) {
    return false
  }
  let details = {}
  for (let key of Object.keys(KEY_ASC)) {
    let lv = KEY_LV[key]
    let add = KEY_ASC[key] > 0 ? (asc[KEY_ASC[key] - 1] || {}) : {}
    details[key] = [
      fmtHp(base.hp * curve.hp[String(lv)] + (add[ASC_KEY.hp] || 0)),
      fmt2(base.atk * curve.atk[String(lv)] + (add[ASC_KEY.atk] || 0)),
      fmt2(base.def * curve.def[String(lv)] + (add[ASC_KEY.def] || 0)),
      fmt2((add[grow.field] || 0) * grow.mul)
    ]
  }
  let d90 = details['90']
  let d100 = details['100']
  return {
    baseAttr: { hp: d100[0], atk: d100[1], def: d100[2] },
    growAttr: { key: grow.key, value: d90[3] },
    attr: {
      keys: ['hpBase', 'atkBase', 'defBase', grow.key],
      details
    }
  }
}

/**
 * 从 nanoka 角色详情生成技能/命座/被动图标路径（指向 gallery）
 * @param {object} nanoDetail - nanoka 角色 content.detail
 * @returns {object|null} { e, q, cons1~6, passive0~3 }，无图标时返回 null
 */
function buildImgs (nanoDetail) {
  const skills = nanoDetail.skills || []
  const passives = nanoDetail.passives || []
  const cons = nanoDetail.constellations || []
  const imgs = {}
  const add = (key, icon) => {
    if (icon) {
      imgs[key] = `${GALLERY_REL}/${icon}.webp`
    }
  }
  // 战技 Skill_S_*，爆发 Skill_E_*（key 对应 getImgs 的 imgs.e/imgs.q）
  const eIcon = skills.find(s => s.promote?.['0']?.icon?.startsWith('Skill_S_'))?.promote?.['0']?.icon
  const qIcon = skills.find(s => s.promote?.['0']?.icon?.startsWith('Skill_E_'))?.promote?.['0']?.icon
  add('e', eIcon)
  add('q', qIcon)
  for (let i = 0; i < 6; i++) {
    add(`cons${i + 1}`, cons[i]?.icon)
  }
  for (let i = 0; i < 4; i++) {
    add(`passive${i}`, passives[i]?.icon)
  }
  return Object.keys(imgs).length ? imgs : null
}

/**
 * 从 nanoka 补缺注册缺失角色
 * @param {object} meta - 原神角色 Meta 实例（Meta.create('gs', 'char')）
 */
export function addNanoPending (meta) {
  for (const sub of ['五星', '四星']) {
    let dir = `${NANO_BASE}/${sub}`
    if (!fs.existsSync(dir)) {
      continue
    }
    let files
    try {
      files = fs.readdirSync(dir)
    } catch (e) {
      logger?.warn(`[miao] nanoka 角色目录读取失败: ${dir}`)
      continue
    }
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue
      }
      let ds
      try {
        ds = JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8'))
      } catch (e) {
        continue
      }
      let id = ds.meta?.recordId
      let name = ds.meta?.name
      if (!id || !name) {
        continue
      }
      id = String(id)
      // 变体记录（多元素角色按元素拆分的 id 带 -N 后缀，如旅行者 10000005-2）→ 跳过
      if (!/^\d+$/.test(id)) {
        continue
      }
      // 已注册（含上游更新）→ 跳过，让位于上游数据
      if (meta.getId(id)) {
        continue
      }
      // 同名角色已注册（如旅行者/奇偶的元素变体）→ 跳过，不覆盖既有 alias
      if (meta.getId(name)) {
        continue
      }
      let detail = ds.content?.detail || {}
      // 从 nanoka 生成属性表，缺失时退回仅注册基础信息（面板属性显示 NaN）
      let attrDetail = buildDetail(detail)
      // 技能/命座/被动图标路径（指向 gallery），缺失时缺图不崩
      let imgs = buildImgs(detail)
      meta.addDataItem(id, {
        id: id * 1,
        name,
        abbr: name,
        star: STAR_MAP[ds.meta.rarity] || 5,
        elem: (detail.element || '').toLowerCase(),
        weapon: WEAPON_MAP[detail.weapon] || '',
        ...(attrDetail ? { _detail: attrDetail } : {}),
        ...(imgs ? { _imgs: imgs } : {})
      })
      logger?.info(`[miao] nanoka 补缺注册角色: ${name} (${id})`)
    }
  }
}
