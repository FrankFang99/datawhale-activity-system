/**
 * 5 阶段子任务描述（v9 · Frank 2026-08-21 23:35 #2）
 *
 * 数据来源：Frank 在浏览器评论中给出的 5 阶段子任务内容（comment 2-6）
 * 与后端 stages/controller.ts 的 SUBTASK_TEMPLATES 对齐
 *
 * 用途：ActivityDetail 5 阶段子任务区域（按角色权限显示）
 *  - ORGANIZER / ASSISTANT / VOLUNTEER / OPERATOR / ADMIN：完整子任务
 *  - PARTICIPANT / USER：只看到 5 阶段时间轴（Frank 23:35 #2）
 */

export interface SubTask {
  order: number;
  name: string;
  ownerType: 'ORGANIZER' | 'VOLUNTEER' | 'OPERATOR';
  proofHint: string;
}

export interface Stage {
  stage: 'INTENT' | 'RECRUIT' | 'PREPARE' | 'EXECUTE' | 'REVIEW';
  title: string;
  hint: string;       // T-N 时间标记
  desc: string;       // 阶段说明
  subTasks: SubTask[];
}

export const STAGE_TEMPLATES_FRANK: Stage[] = [
  {
    stage: 'INTENT',
    title: '确认意向',
    hint: 'T-10',
    desc: '志愿者与组织者飞书 IM 沟通，最终确定活动方案；组织者阅读并确认行动指南后开始填空表单。',
    subTasks: [
      // v13 Frank 14:12 反馈：Comment 3/4/5 改
      { order: 1, name: '志愿者和组织者互加飞书好友', ownerType: 'VOLUNTEER', proofHint: '好友关系建立截图' },
      // Comment 3：加"阅读并确认行动指南"（带飞书文档链接，组织者打勾）
      { order: 2, name: '阅读并确认行动指南', ownerType: 'ORGANIZER', proofHint: '飞书文档 https://datawhaler.feishu.cn/docx/K5G8dnWOEoxTC8xgxHHcSUMbni1（已读 + 确认）' },
      // Comment 4：改"双方最终确认活动方案"为组织者填空（时间+地点+规模 → 同步飞书 base）
      { order: 3, name: '双方最终确认活动方案/时间/地点/规模', ownerType: 'ORGANIZER', proofHint: '组织者填写具体时间（必填到日，几点到几点可选）、具体地点、预计规模 → 同步飞书 base' },
      // Comment 5：志愿者添加日历后组织者确认打勾（ownerType 改 ORGANIZER）
      { order: 4, name: '飞书日历登记活动', ownerType: 'ORGANIZER', proofHint: '志愿者添加日历后，组织者确认打勾' },
    ],
  },
  {
    stage: 'RECRUIT',
    title: '对外招募',
    hint: 'T-7',
    desc: '建群、定制视觉物料、发布报名表单、联系助教/嘉宾、启动本地招募宣传。',
    subTasks: [
      { order: 1, name: '建立活动群聊（现场微信群、飞书 QQ 兴趣群等）', ownerType: 'ORGANIZER', proofHint: '群二维码或链接' },
      { order: 2, name: '定制视觉物料（海报、横幅、手举牌、旗帜、推文等）', ownerType: 'ORGANIZER', proofHint: '海报图' },
      { order: 3, name: '启动招募宣传（公众号、朋友圈、微信群、小红书等）', ownerType: 'ORGANIZER', proofHint: '推文截图' },
      { order: 4, name: '联系助教 / 主讲嘉宾', ownerType: 'ORGANIZER', proofHint: '沟通记录' },
    ],
  },
  {
    stage: 'PREPARE',
    title: '现场筹备',
    hint: 'T-3',
    desc: '确认场地、运营/组织者/助教完成实操教程培训、准备现场物料（邮寄/打印/PPT/相机）。',
    subTasks: [
      { order: 1, name: '确认场地并上传信息', ownerType: 'ORGANIZER', proofHint: '场地照片 + 精确地址' },
      { order: 2, name: '和助教一起完成实操教程', ownerType: 'ORGANIZER', proofHint: '培训截图' },
      { order: 3, name: '准备现场物料（邮寄、打印、PPT、相机等）', ownerType: 'ORGANIZER', proofHint: '物料清单' },
    ],
  },
  {
    stage: 'EXECUTE',
    title: '活动执行',
    hint: 'T',
    desc: '现场签到、嘉宾分享 + 动手实操、采集现场素材、引导参与者上传作品墙获取徽章认证。',
    subTasks: [
      { order: 1, name: '现场签到与引导', ownerType: 'ORGANIZER', proofHint: '签到截图' },
      { order: 2, name: '嘉宾分享 + 动手实操', ownerType: 'ORGANIZER', proofHint: '现场照片≥3 张' },
      { order: 3, name: '采集现场素材（横版高清照片，视频可选）', ownerType: 'ORGANIZER', proofHint: '素材链接' },
      { order: 4, name: '引导参与者上传到作品墙获取徽章认证', ownerType: 'ORGANIZER', proofHint: '作品墙截图' },
    ],
  },
  {
    stage: 'REVIEW',
    title: '活动复盘',
    hint: 'T+3',
    desc: '提交复盘文档（含现场素材）、整理活动素材、志愿者审核。',
    subTasks: [
      { order: 1, name: '提交活动复盘', ownerType: 'ORGANIZER', proofHint: '复盘文档' },
      { order: 2, name: '整理活动素材', ownerType: 'ORGANIZER', proofHint: '素材汇总' },
      { order: 3, name: '志愿者审核 + 可推荐优秀', ownerType: 'VOLUNTEER', proofHint: 'reviewStatus=APPROVED' },
    ],
  },
];

/** 角色权限：能看完整子任务细节 */
export function canViewSubTasks(role?: string): boolean {
  if (!role) return false;
  return ['ORGANIZER', 'ASSISTANT', 'VOLUNTEER', 'OPERATOR', 'ADMIN'].includes(role);
}
