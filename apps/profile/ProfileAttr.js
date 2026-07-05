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

  let match = /^#(.+?)(圣遗物|遗器)初始值/.exec(msg)
  if (!match) return false

  let charInput = match[1].trim()
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
    return showGsAttr(e, profile, char)
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

    // 初始副词条：前 (总条数 - 强化次数) 项
    let enhanceCount = Math.floor((arti.level || 0) / 4)
    let initialCount = Math.min((arti.attrIds || []).length - enhanceCount, 4)
    let initialIds = (arti.attrIds || []).slice(0, initialCount)

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
