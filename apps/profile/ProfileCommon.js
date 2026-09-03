/*
* 面板公共方法及处理
* */
import { Button, Character, MysApi, Player } from '#miao.models'
import { Common } from '#miao'

/*
* 获取面板查询的 目标uid
* */
const _getTargetUid = async function (e) {
  let uidReg = /(18|[1-9])[0-9]{8}/

  if (e.uid && uidReg.test(e.uid)) {
    return e.uid
  }

  let uidRet = uidReg.exec(e.msg)
  if (uidRet) {
    return uidRet[0]
  }
  let uid = false

  try {
    let user = await MysApi.initUser(e)

    if (!user || !user.uid) {
      return false
    }
    uid = user.uid
    if ((!uid || !uidReg.test(uid)) && !e._replyNeedUid) {
      e.reply(['请发送 #扫码登录', new Button(e).bindUid()])
      e._replyNeedUid = true
      return false
    }
  } catch (err) {
    console.log(err)
  }
  return uid || false
}

export async function getTargetUid (e) {
  let uid = await _getTargetUid(e)
  if (uid) {
    e.uid = uid
  }
  return uid
}

export async function getProfileRefresh (e, avatar) {
  let char = Character.get(avatar)
  if (!char) {
    return false
  }

  let player = Player.create(e)
  let profile = player.getProfile(char.id)
  if (!profile || !profile.hasData) {
    logger.mark(`本地无UID:${player.uid}的${char.name}面板数据，尝试自动请求...`)
    await player.refresh({ profile: true })
    profile = player.getProfile(char.id)
  }
  if (!profile || !profile.hasData) {
    if (!e._isReplyed) {
      e.reply([
        `⚠️ 暂无 ${char.name} 数据，请：\n` +
        `━━━━━━━━━━━━\n` +
        `📋 方式一：角色展柜更新（展柜需开启"显示角色详情）\n` +
        `#更新面板    (原神)\n` +
        `*更新面板    (星铁)\n\n` +
        `📋 方式二：全量更新\n` +
        `#扫码登录 (已登录可忽略)\n` +
        `#米游社更新面板   (原神)\n` +
        `*米游社更新面板   (星铁)`,
        new Button(e).profileList(player.uid),
        new Button(e).profile(char, player.uid)
      ]);
    }
    return false;
  }
  return profile
}

/*
* 面板帮助（Fork 增强：HTML 模板渲染，含面板变换说明）
* */
export async function profileHelp (e) {
  // Common.render 无 retType 时内部已通过 e.reply 发送图片并返回 true，直接 return 即可
  // （若再用 e.reply 包裹会重复回复，且 render 返回的 true 会作为消息参数导致发送失败）
  return await Common.render('character/profile-help', {}, { e })
}
