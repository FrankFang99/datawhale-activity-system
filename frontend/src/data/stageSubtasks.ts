/**
 * 5 阶段子任务描述（v9 · Frank 2026-08-21 23:35 #2 → 2026-08-25 调整：PREPARE 5 个 + EXECUTE 3 个）
 *
 * 数据源：Frank 2026-08-25 交付的 v1-delivery 包
 *  - frontend/src/data/stageSubtasks.ts（与后端 stages/controller.ts 的 SUBTASK_TEMPLATES 对齐）
 *  - frontend/src/data/stageCredentialSpec.ts（v16.6 8-24 改写，凭证规范：whatToDo / passCriteria / proofType / proofCategories）
 *
 * 用途：活动详情页 5 阶段子任务区域（按角色权限显示）
 *  - ORGANIZER / ASSISTANT / VOLUNTEER / OPERATOR / ADMIN：完整子任务
 *  - PARTICIPANT / USER：5 阶段时间轴 + 子任务模板（只读）
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
      { order: 2, name: '阅读并确认行动指南', ownerType: 'ORGANIZER', proofHint: '飞书文档（已读 + 确认）' },
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
    desc: '建群、定制视觉物料、发布报名表单、启动本地招募宣传。',
    subTasks: [
      { order: 1, name: '建活动群聊', ownerType: 'ORGANIZER', proofHint: '群二维码（必填）+ 飞书群/QQ 群 URL（可选）' },
      { order: 2, name: '定制视觉物料（海报/横幅/手举牌）', ownerType: 'ORGANIZER', proofHint: '旗帜/海报/横幅/手举牌 PNG（多张）' },
      { order: 3, name: '复制专题并发布报名表单', ownerType: 'ORGANIZER', proofHint: '报名链接可访问 + 群二维码自动弹出' },
      { order: 4, name: '启动本地招募宣传（公众号/朋友圈/群转发）', ownerType: 'ORGANIZER', proofHint: '【截图类】朋友圈/微信群/高校社团群（≥1 张）+【链接类】公众号/视频号/小红书（≥1 个）' },
    ],
  },
  {
    // 8-25 调整：PREPARE 从 3 个扩到 5 个（推文 + 作品上墙从 EXECUTE 移过来）
    stage: 'PREPARE',
    title: '现场筹备',
    hint: 'T-3',
    desc: '确认场地、完成实操教程培训、准备现场物料（接收/打印/任务卡/PPT）、提交宣传推文、推动作品上墙。',
    subTasks: [
      { order: 1, name: '确认场地并上传场地信息', ownerType: 'ORGANIZER', proofHint: '精确地址 + 使用时段 + 现场图片≥3 张' },
      { order: 2, name: '组织者+助教完成实操教程培训', ownerType: 'ORGANIZER', proofHint: '教程完整跑通截图 + 培训截图≥2 张' },
      { order: 3, name: '准备现场物料（接收/打印/任务卡PPT）', ownerType: 'ORGANIZER', proofHint: '接收/打印/任务卡/PPT 4 类图片' },
      // 8-25 移过来的 2 个子任务（原 v9 在 EXECUTE）
      { order: 4, name: '提交宣传推文', ownerType: 'ORGANIZER', proofHint: '【截图类】微信群/朋友圈/高校社团群 +【链接类】公众号/视频号/小红书' },
      { order: 5, name: '参与者上传作品/申请的认证', ownerType: 'ORGANIZER', proofHint: '作品墙截图 + 徽章认证截图' },
    ],
  },
  {
    // 8-25 调整：EXECUTE 从 4 个减到 3 个（推文/作品墙上墙移到 PREPARE）
    stage: 'EXECUTE',
    title: '活动执行',
    hint: 'T',
    desc: '现场签到、主题分享+带教+实操+闪电分享、采集现场素材。',
    subTasks: [
      { order: 1, name: '现场签到与引导', ownerType: 'ORGANIZER', proofHint: '签到截图 + 入群率≥80%' },
      { order: 2, name: '主题分享+带教实操+闪电分享', ownerType: 'ORGANIZER', proofHint: '现场照片≥3 张（每环节至少 1 张）' },
      { order: 3, name: '采集现场素材（横版高清）', ownerType: 'ORGANIZER', proofHint: '横版高清照片≥5 张（≥1920×1080）+ 视频可选' },
    ],
  },
  {
    stage: 'REVIEW',
    title: '活动复盘',
    hint: 'T+3',
    desc: '提交活动复盘（含现场素材到飞书文档）、推动作品上墙（参与 OPC 能力认证）、志愿者审核作品+可推荐优秀。',
    subTasks: [
      { order: 1, name: '提交活动复盘（含现场素材到飞书文档）', ownerType: 'ORGANIZER', proofHint: '3 天内提交 + 含现场素材 + 不人机' },
      { order: 2, name: '推动作品上墙（参与 OPC 能力认证）', ownerType: 'ORGANIZER', proofHint: '作品链接≥1 + OPC 认证截图≥1' },
      { order: 3, name: '志愿者审核作品+反馈+可推荐优秀', ownerType: 'VOLUNTEER', proofHint: '志愿者先完成 + 组织者确认 + 至少 1 个作品标记"优秀"' },
    ],
  },
];

/** 角色权限：能看完整子任务细节 */
export function canViewSubTasks(role?: string): boolean {
  if (!role) return false;
  return ['ORGANIZER', 'ASSISTANT', 'VOLUNTEER', 'OPERATOR', 'ADMIN'].includes(role);
}
