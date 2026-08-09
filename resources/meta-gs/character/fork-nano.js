/*
* Fork 补缺：从 Atlas-Plugin nanoka 数据源自动注册上游未更新的角色
*
* 场景：上游 miao-plugin 尚未更新角色数据（如 7.0 奥黛塔/阿罗夏），
* 而 nanoka 图鉴数据已收录。启动时扫描 nanoka 角色目录，对 miao 缺失的
* 角色注册基础信息（id/星级/元素/武器），使其可通过 面板变换 查询。
*
* 过渡性：上游更新后（data.json 已存在该角色）自动跳过，不覆盖上游数据。
* 独立性：Atlas-Plugin 数据目录缺失/读取失败时静默跳过，不影响其他功能。
* */
import fs from 'node:fs'
import { Data } from '#miao'

// nanoka 角色数据根目录（相对 app 根）
const NANO_BASE = `${Data.getRoot()}/plugins/Atlas-Plugin/tool/nanoka-atlas-backend/nanoka-atlas-backend/data/items/简体中文/原神/角色`

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
      meta.addDataItem(id, {
        id: id * 1,
        name,
        abbr: name,
        star: STAR_MAP[ds.meta.rarity] || 5,
        elem: (detail.element || '').toLowerCase(),
        weapon: WEAPON_MAP[detail.weapon] || ''
      })
      logger?.info(`[miao] nanoka 补缺注册角色: ${name} (${id})`)
    }
  }
}
