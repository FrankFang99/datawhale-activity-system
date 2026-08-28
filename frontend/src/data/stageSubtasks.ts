/**
 * 5 阶段子任务模板（v1.2 Frank 27 完全对齐 8-25 后端 SUBTASK_TEMPLATES）
 *
 * 数据源：v1-delivery/backend/src/modules/stages/controller.ts SUBTASK_TEMPLATES
 *   （v13 Frank 14:12 改 INT 4 / RECRUIT 4 / PREPARE 5 / EXECUTE 3 / REVIEW 3 = 19 个）
 *
 * 用途：ActivityDetail 5 阶段子任务模板预览
 *  - ORGANIZER / ASSISTANT / VOLUNTEER / OPERATOR / ADMIN：完整子任务 + 凭证规范
 *  - PARTICIPANT / USER：5 阶段时间轴即可（保持 v9 Frank 23:35 行为）
 *
 * 关键约束：subTaskName 必须字符级跟 8-25 后端 SUBTASK_TEMPLATES 完全一致
 *   （前端 findCredentialSpec 用 substring 匹配，名字不一致就找不到凭证规范）
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
  hint: string;       // T-N 时间标记（8-25 STAGE_TEMPLATES daysBeforeStart）
  desc: string;       // 阶段说明
  subTasks: SubTask[];
}

export const STAGE_TEMPLATES_FRANK: Stage[] = [
  {
    // 8-25 STAGE_TEMPLATES：INTENT daysBeforeStart=10（T-10）
    stage: 'INTENT',
    title: '确认意向',
    hint: 'T-10',
    desc: '志愿者加组织者飞书 IM 好友；双方最终确认活动方案/时间/地点/规模；飞书日历登记。',
    subTasks: [
      // v13 Frank 14:12 反馈：Comment 3/4/5 改
      { order: 1, name: '志愿者和组织者互加飞书好友', ownerType: 'VOLUNTEER', proofHint: '好友关系建立截图' },
      // Comment 3：加"阅读并确认行动指南"（带飞书文档链接，组织者打勾）
      { order: 2, name: '阅读并确认行动指南', ownerType: 'ORGANIZER', proofHint: '飞书文档 https://datawhaler.feishu.cn/docx/K5G8dnWOEoxTC8xgxHHcSUMbni1（已读 + 确认）' },
      // Comment 4：改"双方最终确认活动方案"为组织者填空（时间+地点+规模 → 同步飞书 base）
      { order: 3, name: '双方最终确认活动方案/时间/地点/规模', ownerType: 'ORGANIZER', proofHint: '组织者填写具体时间（必填到日，几点到几点可选）、具体地点、预计规模 → 同步飞书 base' },
      // Comment 5：v16.7 Frank 16:44 volunteer-first 流程：志愿者在飞书日历创建事件（step1），组织者后确认（step2）
      // v1.5 Frank 28 09:25 修正：之前错写为 ORGANIZER（"志愿者在飞书操作"必是 VOLUNTEER，不是 ORGANIZER）
      { order: 4, name: '飞书日历登记活动', ownerType: 'VOLUNTEER', proofHint: '志愿者在飞书日历创建事件（标题/时间/地点/共同参与者），组织者后确认' },
    ],
  },
  {
    // 8-25 STAGE_TEMPLATES：RECRUIT daysBeforeStart=7（T-7）
    stage: 'RECRUIT',
    title: '对外招募',
    hint: 'T-7',
    desc: '建活动群聊；定制视觉物料（海报/横幅）；发布报名表单；启动本地招募宣传。',
    subTasks: [
      // 跟 8-25 后端 SUBTASK_TEMPLATES 字符级一致
      { order: 1, name: '建活动群聊', ownerType: 'ORGANIZER', proofHint: '群二维码' },
      { order: 2, name: '定制视觉物料（海报/横幅/手举牌）', ownerType: 'ORGANIZER', proofHint: '海报链接' },
      { order: 3, name: '复制专题并发布报名表单', ownerType: 'ORGANIZER', proofHint: '报名链接' },
      { order: 4, name: '启动本地招募宣传（公众号/朋友圈/群转发）', ownerType: 'ORGANIZER', proofHint: '推文截图' },
    ],
  },
  {
    // 8-25 STAGE_TEMPLATES：PREPARE daysBeforeStart=5（T-5，wiki 文档写 T-5）
    // 8-25 后端调整：PREPARE 从 3 个扩到 5 个（推文 + 作品上墙从 EXECUTE 移过来）
    stage: 'PREPARE',
    title: '现场筹备',
    hint: 'T-5',
    desc: '确认场地；组织者+助教完成培训；准备现场物料；提交宣传推文；参与者上传作品。',
    subTasks: [
      // 跟 8-25 后端 SUBTASK_TEMPLATES 字符级一致
      { order: 1, name: '确认场地并上传场地信息', ownerType: 'ORGANIZER', proofHint: '场地照片' },
      { order: 2, name: '组织者+助教完成实操教程培训', ownerType: 'ORGANIZER', proofHint: '培训完成截图' },
      { order: 3, name: '准备现场物料（接收/打印/任务卡PPT）', ownerType: 'ORGANIZER', proofHint: '物料清单' },
      { order: 4, name: '提交宣传推文', ownerType: 'ORGANIZER', proofHint: '推文截图' },
      { order: 5, name: '参与者上传作品/申请的认证', ownerType: 'ORGANIZER', proofHint: '作品链接 + 认证截图' },
    ],
  },
  {
    // 8-25 STAGE_TEMPLATES：EXECUTE daysBeforeStart=0（T）
    // 8-25 后端调整：EXECUTE 从 4 个减到 3 个（推文/作品墙上墙移到 PREPARE）
    stage: 'EXECUTE',
    title: '活动执行',
    hint: 'T',
    desc: '现场签到；主题分享 20min + 带教演示 30min + 实操 40+min + 闪电分享 20-30min；采集素材。',
    subTasks: [
      // 跟 8-25 后端 SUBTASK_TEMPLATES 字符级一致
      { order: 1, name: '现场签到与引导', ownerType: 'ORGANIZER', proofHint: '签到截图' },
      { order: 2, name: '主题分享+带教演示+实操+闪电分享', ownerType: 'ORGANIZER', proofHint: '现场照片' },
      { order: 3, name: '采集现场素材（横版高清）', ownerType: 'ORGANIZER', proofHint: '现场照片≥3 张' },
    ],
  },
  {
    // 8-25 STAGE_TEMPLATES：REVIEW daysBeforeStart=-3（T+3）
    stage: 'REVIEW',
    title: '活动复盘',
    hint: 'T+3',
    desc: '提交复盘文档（含现场素材）；推动作品上墙；志愿者审核+可推荐优秀（v4 运营默认不介入）。',
    subTasks: [
      // 跟 8-25 后端 SUBTASK_TEMPLATES 字符级一致
      { order: 1, name: '提交活动复盘（含现场素材到飞书文档）', ownerType: 'ORGANIZER', proofHint: '复盘文档' },
      { order: 2, name: '推动作品上墙（参与 OPC 能力认证）', ownerType: 'ORGANIZER', proofHint: '作品链接' },
      { order: 3, name: '志愿者审核作品+反馈+可推荐优秀', ownerType: 'VOLUNTEER', proofHint: 'reviewStatus + excellentOrganizer' },
    ],
  },
];

/** 角色权限：能看完整子任务细节 */
export function canViewSubTasks(role?: string): boolean {
  if (!role) return false;
  return ['ORGANIZER', 'ASSISTANT', 'VOLUNTEER', 'OPERATOR', 'ADMIN'].includes(role);
}
