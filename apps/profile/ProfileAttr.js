/*
* 圣遗物/遗器初始值查询
* */
import lodash from 'lodash'
import { Meta, Format } from '#miao'
import { Character } from '#miao.models'
import { getTargetUid, getProfileRefresh } from './ProfileCommon.js'

export async function profileAttr (e) {
  let msg = e.msg
  let game = /遗器/.test(msg) ? 'sr' : 'gs'
  e.isSr = game === 'sr'

  let match = /^#(.+?)(圣遗物|遗器)(初始值|成长值)/.exec(msg)
  if (!match) return false

  let charInput = match[1].trim()
  let isGrowth = match[3] === '成长值'
  let char = Character.get(charInput, game)
  if (!char) {
    e.reply(`未找到角色「${charInput}」`)
    return true
  }

  let uid = await getTargetUid(e)
  if (!uid) return true

  let profile = await getProfileRefresh(e, char.name)
  if (!profile) return true
  if (!profile.hasArtis || !profile.hasArtis()) {
    e.reply('未获取到圣遗物数据，请先更新面板')
    return true
  }

  if (game === 'gs') {
    return isGrowth ? showGsGrowth(e, profile, char) : showGsAttr(e, profile, char)
  } else {
    return showSrAttr(e, profile, char)
  }
}

function showGsAttr (e, profile, char) {
  let artis = profile.artis || profile._artis || []
  let { mainIdMap, attrMap, attrIdMap } = Meta.getMeta('gs', 'arti')
  let star = 5
  let lines = [`—— ${char.name} 圣遗物初始值 ——`]

  let maxIdx = artis.length || Object.keys(artis).length || 5
  for (let idx = 1; idx <= maxIdx; idx++) {
    let arti = artis[idx]
    if (!arti || !arti.attrIds) continue

    star = arti.star || star

    // 主词条
    let mainKey = mainIdMap[arti.mainId]
    if (!mainKey) continue
    if (Format.isElem(mainKey, 'gs')) mainKey = 'dmg'
    let mainTitle = attrMap[mainKey]?.title || mainKey
    let mainVal = fmtMainGs(arti.mainId, arti.level || 0, star)
    let posLine = `${idx} | ${mainTitle} ${mainVal}`

    // 非 Enka 数据源 attrIds 可能乱序，跳过
    if (/^(mys|mysPanel)$/.test(profile._source)) {
      lines.push(`${posLine} | (米游社数据不支持，请用 #更新面板 刷新)`)
      continue
    }

    // 初始副词条：判断3词条/4词条初始，取真正的0级初始值
    let initialIds = []
    let seen = new Set()
    let level = arti.level || 0
    let totalRolls = (arti.attrIds || []).length
    let is4Start = totalRolls === 4 + level / 4  // 4词条初始: 4 + level/4 条记录
    let initialCount = is4Start ? 4 : 3
    ;(arti.attrIds || []).forEach(id => {
      let cfg = attrIdMap[id]
      if (!cfg) return
      if (seen.has(cfg.key)) return  // 重复 key = 强化追加
      if (seen.size >= initialCount) return false  // 已取够初始词条数，停止
      seen.add(cfg.key)
      initialIds.push(id)
    })

    if (initialIds.length === 0) {
      lines.push(`${posLine} | (无)`)
      continue
    }

    let subs = []
    initialIds.forEach(id => {
      let cfg = attrIdMap[id]
      if (!cfg) return
      let key = cfg.key
      let val = cfg.value * (attrMap[key]?.format === 'pct' ? 100 : 1)
      subs.push({ key: attrMap[key]?.title || key, val: Format.comma(val, 1) })
    })

    lines.push(`${posLine}`)
    subs.forEach(s => {
      lines.push(`  ${s.key} ${s.val}`)
    })
  }

  e.reply(lines.join('\n'))
  return true
}

function showGsGrowth (e, profile, char) {
  let artis = profile.artis || profile._artis || []
  let { mainIdMap, attrMap, attrIdMap } = Meta.getMeta('gs', 'arti')
  let star = 5
  let lines = [`—— ${char.name} 圣遗物成长值 ——`]

  let maxIdx = artis.length || Object.keys(artis).length || 5
  for (let idx = 1; idx <= maxIdx; idx++) {
    let arti = artis[idx]
    if (!arti || !arti.attrIds) continue

    star = arti.star || star

    // 主词条
    let mainKey = mainIdMap[arti.mainId]
    if (!mainKey) continue
    if (Format.isElem(mainKey, 'gs')) mainKey = 'dmg'
    let mainTitle = attrMap[mainKey]?.title || mainKey
    let mainVal = fmtMainGs(arti.mainId, arti.level || 0, star)
    let posLine = `${idx} | ${mainTitle} ${mainVal}`

    // 非 Enka 数据源 attrIds 可能乱序，跳过
    if (/^(mys|mysPanel)$/.test(profile._source)) {
      lines.push(`${posLine} | (米游社数据不支持，请用 #更新面板 刷新)`)
      continue
    }

    // 按 key 收集该位置的强化链
    let rollsByKey = new Map()
    ;(arti.attrIds || []).forEach(id => {
      let cfg = attrIdMap[id]
      if (!cfg) return
      let key = cfg.key
      let val = cfg.value * (attrMap[key]?.format === 'pct' ? 100 : 1)
      if (!rollsByKey.has(key)) rollsByKey.set(key, [])
      rollsByKey.get(key).push(Format.comma(val, 1))
    })

    if (rollsByKey.size === 0) {
      lines.push(`${posLine} | (无)`)
      continue
    }

    lines.push(`${posLine}`)
    for (let [key, vals] of rollsByKey) {
      let title = attrMap[key]?.title || key
      lines.push(`  ${title} ${vals.join(' -> ')}`)
    }
  }

  e.reply(lines.join('\n'))
  return true
}

function showSrAttr (e, profile, char) {
  let artis = profile.artis || profile._artis || []
  let { metaData } = Meta.getMeta('sr', 'arti')
  let star = 5
  let lines = [`—— ${char.name} 遗器初始值 ——`]

  let maxIdx = artis.length || Object.keys(artis).length || 6
  for (let idx = 1; idx <= maxIdx; idx++) {
    let arti = artis[idx]
    if (!arti || !arti.attrIds) continue

    star = arti.star || star
    let starCfg = metaData.starData[star]

    // 主词条
    let mainIdx = metaData.mainIdx[idx]
    let mainKey = mainIdx?.[arti.mainId]
    if (!mainKey) continue
    let mainCfg = starCfg?.main?.[mainKey]
    let mainVal = mainCfg ? Format.comma(mainCfg.base + mainCfg.step * (arti.level || 0), 1) : '?'
    let mainTitle = starCfg?.sub?.[mainKey]?.title || metaData.attrMap?.[mainKey]?.title || mainKey
    let posLine = `${idx} | ${mainTitle} ${mainVal}`

    // 初始副词条：取 ds.count（初始次数）× base 值
    let attrs = arti.attrIds
    if (!attrs || attrs.length === 0) {
      lines.push(`${posLine} | (无)`)
      continue
    }

    let subs = []
    attrs.forEach(ds => {
      let id = lodash.isString(ds) ? ds.split(',')[0] : ds.id
      let count = lodash.isString(ds) ? parseInt(ds.split(',')[1]) || 1 : (ds.count || 0)
      if (count <= 0) return
      let cfg = starCfg?.sub?.[id]
      if (!cfg) return
      let val = cfg.base * count
      subs.push({ key: cfg.title || cfg.key, val: Format.comma(val, 1) })
    })

    lines.push(`${posLine}`)
    subs.forEach(s => {
      lines.push(`  ${s.key} ${s.val}`)
    })
  }

  e.reply(lines.join('\n'))
  return true
}

function fmtMainGs (mainId, level, star) {
  let { mainIdMap, attrMap } = Meta.getMeta('gs', 'arti')
  let key = mainIdMap[mainId]
  if (!key) return '?'
  let attrCfg = attrMap[Format.isElem(key) ? 'dmg' : key]
  if (!attrCfg) return '?'
  let posEff = ['hpPlus', 'atkPlus', 'defPlus'].includes(key) ? 2 : 1
  let starEff = { 1: 0.21, 2: 0.36, 3: 0.6, 4: 0.9, 5: 1 }
  let val = attrCfg.value * (1.2 + 0.34 * level) * posEff * (starEff[star || 5])
  return Format.comma(val, 1)
}
