/**
 * 5 阶段子任务凭证规范（v1.2 Frank 27 #6 + v1.3 Frank 27 23:50 TDD 迭代）
 *
 * v1.2 Frank 27 #6 反馈：「标签可不可以也按原来设置，也不用写分类凭证」
 * - 删 proofType 字段（volunteer-first / confirm / mixed / form 等）
 * - 保留 proofCategories 字段（凭证分类）— 19 个子任务按 v1 8-25 数据补全
 * - 只保留 whatToDo（操作步骤）+ passCriteria（通过标准）
 * - 标签只显示 ownerType（志愿者/组织者/运营）——按 8-25 之前版本（v9 Frank 23:35）
 *
 * v1.3 Frank 27 23:50 TDD 迭代：
 * - 恢复 v1 8-25 的 proofCategories 数组（"上传的内容的区隔"）
 * - 恢复关键超链接（Canva 模板/任务卡 wiki/ailc-admin/ailc）
 * - proofType 字段保持删除（Frank 27 "按原来设置"）
 *
 * 数据源：8-25 backend SUBTASK_TEMPLATES（v1-delivery/backend/src/modules/stages/controller.ts）
 * 关键约束：matchName 必须字符级跟 8-25 后端 SUBTASK_TEMPLATES 一致
 */

export interface CredentialSpec {
  /** 8-25 后端 subTaskName（完全一致） */
  matchName: string;
  /** 该子任务需要做什么（步骤） */
  whatToDo: string[];
  /** 通过标准（怎么算这步完成） */
  passCriteria: string[];
  /**
   * v16.8 Frank 22:16 反馈 Comment 1：凭证分类
   *  - 未设：Form 用 1 个 textarea（每行 1 个 URL）
   *  - 设了：Form 按类别渲染 N 个 Form.Item，每类独立 textarea
   *    · 提交时合并成 JSON：{ "类别1": "url1\nurl2", "类别2": "url3" } 存 proofFile
   *    · 显示时按类别展开（避免 Frank 提到"不知道哪个链接对应哪个"）
   *  - 例：'建活动群聊' → ['微信群二维码（必填）', '飞书群 URL（可选）', 'QQ 群 URL（可选）']
   */
  proofCategories?: string[];
  /**
   * v1.9.19 Frank 28 21:27 反馈：proofCategories 字段类型多态
   *  - 未设：按 proofCategoryType 默认 'url'（TextArea + URL 验证）
   *  - 设了：按 category 名字查 PROOF_CATEGORY_TYPE_MAP 决定 Form 控件
   *    · 'text'：填空题（Input）
   *    · 'timeRange'：时间区间下拉（TimePicker.RangePicker）
   *    · 'multiImage'：多图上传（Upload + ≥N 张验证）
   *  - 例：'确认场地并上传场地信息' → 精确地址(text) + 使用时段(timeRange) + 现场图片(multiImage)
   */
  proofCategoryTypes?: Record<string, 'text' | 'timeRange' | 'multiImage' | 'url'>;
  /**
   * v1.2 Frank 27 #6：proofType 字段在数据中不填
   * - 留 type 是为了 TS 兼容（SubTaskCard 还能引用 credSpec?.proofType）
   * - 数据不填 → spec.proofType === 'image' 全是 false → 全走默认「上传凭证 + 自核」路径
   * - 跟 v9 Frank 23:35 之前行为一致（"按原来设置"）
   * - 按钮按 ownerType + subTaskName 字符串匹配（v1.3 新增，见 ActivityDetail.tsx）
   */
  proofType?: 'image' | 'volunteer-first' | 'confirm' | 'mixed' | 'form';
}

export const CREDENTIAL_SPECS: CredentialSpec[] = [
  // ========== 阶段 1 · INTENT（T-10）· 4 子任务（v13） ==========
  {
    matchName: '志愿者和组织者互加飞书好友',
    whatToDo: [
      '志愿者在飞书 IM 搜索组织者账号并发送好友申请',
      '组织者接受好友申请',
      '双方在飞书 IM 互相打招呼 + 备注活动名称',
    ],
    passCriteria: [
      '飞书好友关系已建立（双向）',
      '志愿者先确认（提交 step1）',
      '组织者后确认（提交 step2）',
    ],
  },
  {
    matchName: '阅读并确认行动指南',
    whatToDo: [
      // Frank 27 20:18 反馈：补超链接（飞书 docx 实际 URL 来自 v16.7 SUBTASK_TEMPLATES proofHint）
      '打开[飞书 docx《Datawhale 生态伙伴 社区行动指南》](https://datawhaler.feishu.cn/docx/K5G8dnWOEoxTC8xgxHHcSUMbni1)',
      '完整阅读组织者 Do / Don\'t 规范和权益部分',
    ],
    passCriteria: [
      '组织者与志愿者双方均"我已确认"',
    ],
  },
  {
    matchName: '双方最终确认活动方案/时间/地点/规模',
    whatToDo: [
      '与志愿者在飞书 IM 沟通活动方案',
      '【必填】日期（精确到日）',
      '【选填】时间区间（几点到几点）',
      '【必填】地点（精确到商圈/学校/场地）',
      '【必填】预计规模（不超过 80 人）',
      // Frank 27 20:57 反馈：补活动策划书模板 URL（提供撰写参考）
      '【必填】活动方案（参考[活动策划书模板](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-Q4qTdGqyoo2ZxMx37ITcKlRin7d)，上传飞书 docx 链接）',
    ],
    passCriteria: [
      '日期已确定（精确到日）',
      '地点已确定（精确到商圈/学校/场地）',
      '规模已确定（不超过 80 人）',
      '活动方案飞书链接已上传',
      '组织者与志愿者双方均"我已确认"',
    ],
  },
  {
    matchName: '飞书日历登记活动',
    whatToDo: [
      '在飞书日历创建事件（标题：AI+X 创造节 · XX 大学站）',
      '填入准确活动开始/结束时间',
      '填入活动地点 + 站点名称',
      '邀请志愿者 + 对接运营为共同参与者',
    ],
    passCriteria: [
      '日历事件已创建（含准确时间+站点）',
      '志愿者先确认（提交 step1）',
      '组织者后确认（提交 step2）',
    ],
  },

  // ========== 阶段 2 · RECRUIT（T-7）· 4 子任务（v13） ==========
  {
    matchName: '建活动群聊',
    proofCategories: [
      '微信群二维码（必填）',
      '飞书群 URL（可选）',
      'QQ 群 URL（可选）',
    ],
    whatToDo: [
      '组织者自己建群，担任群主',
      '群名格式：【活动日期-AI+X创造节@XX大学站/XX城市站】',
      '发群公告（时间/地点/入场时间/活动流程/温馨提示）',
      '保存群二维码',
    ],
    passCriteria: [
      '群主已建立（活动结束后转交给思语）',
      '群公告已发布（含完整时间地点）',
      '微信群二维码已上传（必填图片）',
      '飞书群/QQ 群 URL（可选）',
      'Datawhale 工作人员 + 志愿者已入群',
    ],
  },
  {
    matchName: '定制视觉物料（海报/横幅/手举牌）',
    proofCategories: [
      '旗帜 PNG（多张图片）',
      '海报 PNG（多张图片）',
      '横幅 PNG（5m × 0.7m）',
      '手举牌 PNG（Datawhale + 小浣熊）',
    ],
    whatToDo: [
      // v1.3 恢复 v1 8-25 Canva 模板超链接
      '在 [Canva 旗帜模板](https://www.canva.cn/design/DAHK2gF5sm0/ylFWiumDKJsLf_l4jsSeig/edit)（144cm × 96cm），替换城市/学校/日期',
      '在 [Canva 海报模板](https://khsj.cn/kldl7no55sa79g0)（少文字、引导报名）',
      '替换 Datawhale Logo + 商汤小浣熊 Logo',
      '导出 PNG 格式',
      '与志愿者确认视觉统一',
    ],
    passCriteria: [
      '旗帜 PNG 已导出（各站点统一，需回收复用）',
      '海报 PNG 已导出（引导报名）',
      '横幅 PNG 已导出（5m × 0.7m）',
      '手举牌 PNG 已导出（Datawhale + 小浣熊）',
      '视觉规范：Datawhale + 商汤小浣熊 Logo 正确',
      '已与志愿者确认（避免出街后返工）',
    ],
  },
  {
    matchName: '复制专题并发布报名表单',
    whatToDo: [
      '【TODO · Frank 把参与者问卷放到官网即可】',
      // Frank 27 20:18 反馈：补超链接
      '当前 v1 暂用 [ailc-admin.datawhale.cn](https://ailc-admin.datawhale.cn) 平台 + 飞书日历',
    ],
    passCriteria: [
      '报名链接可访问（用户扫码后能进表单）',
      '群二维码在报名后自动弹出',
      '人数限制 30-50 人（不超过 80）',
      '组织者与志愿者双方均"我已确认"',
    ],
  },
  {
    matchName: '启动本地招募宣传（公众号/朋友圈/群转发）',
    proofCategories: [
      '【截图类】朋友圈 / 微信群 / 高校社团群 / 企业园区群（上传截图 ≥1 张）',
      '【链接类】公众号 / 视频号 / 小红书 / 高校社团自媒体号 / 企业园区自媒体号（上传文章链接 ≥1 个）',
    ],
    whatToDo: [
      '将定制好的海报通过本地渠道发布',
      '带话题 [#DatawhaleAI+X创造节](https://www.datawhale.cn/)',
      '鼓励扫码报名 + 进群',
    ],
    passCriteria: [
      '【截图类渠道】朋友圈 / 微信群 / 高校社团群 / 企业园区群：上传推文/朋友圈截图（≥1 张）',
      '【链接类渠道】公众号 / 视频号 / 小红书 / 高校社团自媒体号 / 企业园区自媒体号：上传文章链接（≥1 个）',
      '话题 [#DatawhaleAI+X创造节](https://www.datawhale.cn/) 已使用',
      '[@Datawhale](https://www.datawhale.cn/) 官方账号',
    ],
  },

  // ========== 阶段 3 · PREPARE（T-5）· 5 子任务 ==========
  {
    matchName: '确认场地并上传场地信息',
    proofCategories: [
      '精确地址（必填，填空 · 精确到门牌号）',
      '使用时段（必填 · 几点到几点的下拉选择）',
      '现场图片（必上传 · 至少 3 张，含设备/桌椅/网络/入口）',
    ],
    whatToDo: [
      '确认场地有：投影设备 + 稳定网络 + 话筒 + 电源 + 桌椅',
      '与学校/场地方沟通借用时段',
      '拍场地照片（≥3 张，含设备/桌椅/网络/入口）',
      '把精确地址同步给对接人 + 群公告',
    ],
    passCriteria: [
      '5 项设备齐全（投影 + 网络 + 话筒 + 电源 + 桌椅）',
      '场地照片 ≥3 张',
      '精确地址（到门牌号）已同步',
    ],
  },
  {
    matchName: '组织者+助教完成实操教程培训',
    whatToDo: [
      // Frank 27 20:18 反馈：补 ailc.datawhale.cn 超链接
      '登录学习平台 [ailc.datawhale.cn](https://ailc.datawhale.cn)',
      '完整跑通本期教程（商汤办公小浣熊 OPC 能力实操）',
      '确保能带教其他参与者',
      '截图保存培训记录',
    ],
    passCriteria: [
      '教程完整跑通（无错误）',
      '培训截图 ≥2 张',
      '能演示至少 1 个 OPC 能力（带教证据）',
    ],
  },
  {
    matchName: '准备现场物料（接收/打印/任务卡PPT）',
    proofCategories: [
      '接收物料（≥1 张照片，联系钱皓亮寄送）',
      '打印物料（≥1 张照片，含横幅/手卡/手举牌/旗帜）',
      '任务卡（≥1 张照片，6 种：简历优化/活动策划/学习计划/公众号推文/社团招新方案/数据分析）',
      'PPT（飞书文档链接 · 更新本站点内容）',
    ],
    whatToDo: [
      // v1.3 恢复 v1 8-25 关键超链接（任务卡 wiki + Canva 模板）
      '接收物料：联系钱皓亮提供寄送信息（商汤会员卡传单 + 周边 + Datawhale 周边）',
      '打印物料：横幅（[5m × 0.7m 模板](https://khsj.cn/iate3d70g7apoa2)）+ Datawhale 手卡（[手卡素材 1](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-TEvndHk65oHDSDxEj7tcOXGXn3b) / [手卡素材 2](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-XVyxdoP2Yod4Xpx5fzcc15AKn1g)）+ 小浣熊手举牌（[素材](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc)）+ 旗帜（[Canva 模板](https://www.canva.cn/design/DAHK2gF5sm0/ylFWiumDKJsLf_l4jsSeig/edit)）',
      '任务卡/PPT：下载本站点任务卡（[简历优化](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-GwaxdnTkMokkYRxaw2DcVvNTndW) / [活动策划案](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-H2dDdwEMmoK7K1xucqVcIGJdnZf) / [学习计划](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-NEpadJ5XloaruQxQqVRcNthRnOf) / [公众号推文](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-KtRJdL6N8omF38xtSpCcrs25njb) / [社团招新方案](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-CP12dFLXYoKumtxp0vcc6Ternre) / [数据分析](https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc#share-IlY0dqC1uouo6wxXda2copLHnhh)）',
      '更新 PPT（[模板](https://khsj.cn/8jvibqsu36lmspf)，加入本站点内容；PPT 上传飞书文档链接）',
      '准备摄影设备（手机即可，确保横版高清）',
    ],
    passCriteria: [
      '物料清单完整（接收 + 打印 + 任务卡 + PPT）',
      '接收 ≥1 张照片',
      '打印 ≥1 张照片',
      '任务卡 ≥1 张照片',
      'PPT 飞书链接 ≥1 个',
    ],
  },
  {
    matchName: '提交宣传推文',
    proofCategories: [
      '【截图类】微信群 / 朋友圈 / 高校社团群（上传截图 ≥1 张）',
      '【链接类】公众号 / 视频号 / 小红书 / 高校社团自媒体账号（上传文章链接 ≥1 个）',
    ],
    whatToDo: [
      '在微信群 / 公众号 / 朋友圈 / 视频号 / 小红书 / 高校社团 发布活动推文',
      '带话题 [#DatawhaleAI+X创造节](https://www.datawhale.cn/)',
      '引导用户扫码报名 + 进群',
    ],
    passCriteria: [
      '推文已发布（≥1 个渠道）',
      '截图类 ≥1 张',
      '链接类 ≥1 个',
      '话题 [#DatawhaleAI+X创造节](https://www.datawhale.cn/) 已使用',
    ],
  },
  {
    matchName: '参与者上传作品/申请的认证',
    proofCategories: [
      '作品墙截图（≥1 张，可多张）',
      '徽章认证截图（≥1 张，可多张）',
    ],
    whatToDo: [
      '引导参与者在活动前/中提交作品（图片/文档/视频）',
      '确保作品展示在作品墙',
      '参与者获取 OPC 能力认证徽章',
    ],
    passCriteria: [
      '作品墙截图 ≥1 张',
      '徽章认证截图 ≥1 张（参与者）',
      '至少 1 个作品已上墙',
    ],
  },

  // ========== 阶段 4 · EXECUTE（T）· 3 子任务 ==========
  {
    matchName: '现场签到与引导',
    whatToDo: [
      // Frank 27 20:18 反馈：补 ailc-admin 超链接
      '引导参与者扫码签到（[ailc-admin](https://ailc-admin.datawhale.cn) 平台）',
      '引导参与者入活动群',
      '公告现场流程和动手实践链接',
      '解答参与者疑问',
      'Todo：实时记录待优化项（签到流程 / 入群引导）',
    ],
    passCriteria: [
      '签到截图 ≥1 张',
      '入群率 ≥80%（参与者/已报名）',
      '公告已置顶（群待办）',
    ],
  },
  {
    matchName: '主题分享+带教演示+实操+闪电分享',
    whatToDo: [
      '环节 0：主题分享（20min · AI 学习经验/成果/路线 · 可以不讲）',
      '环节 1：带教演示（30min）',
      '环节 2：参与者动手实操（40+ min）',
      '环节 3：引导提交作品 + 闪电分享（20~30 min）',
      '📸 Todo：每个环节至少拍 1 张照片（环节 0/1/2/3 都覆盖）',
    ],
    passCriteria: [
      '现场照片 ≥3 张（每环节至少 1 张）',
      '4 环节全部完成',
      '现场互动（提问/讨论）有记录',
      '志愿者先确认（提交 step1）',
      '组织者后确认（提交 step2）',
    ],
  },
  {
    matchName: '采集现场素材（横版高清）',
    proofCategories: [
      '横版高清照片（≥5 张，每环节至少 1 张）',
      '视频（可选 · 讲座/实操关键片段）',
      '社媒截图/链接（参与者发布作品 #DatawhaleAI+X创造节）',
    ],
    whatToDo: [
      '拍摄横版高清照片（每环节至少 1 张）',
      '视频可选（讲座/实操关键片段）',
      '引导参与者在社媒发布作品 + 带话题 [#DatawhaleAI+X创造节](https://www.datawhale.cn/)',
      '[@Datawhale](https://www.datawhale.cn/) 官方账号',
    ],
    passCriteria: [
      '素材链接 ≥5 个（照片 ≥5 + 视频可选）',
      '横版高清（≥1920×1080）',
      '话题 [#DatawhaleAI+X创造节](https://www.datawhale.cn/) + [@Datawhale](https://www.datawhale.cn/)',
    ],
  },

  // ========== 阶段 5 · REVIEW（T+3）· 3 子任务 ==========
  {
    matchName: '提交活动复盘（含现场素材到飞书文档）',
    whatToDo: [
      '活动后 3 天内提交',
      '上传现场素材（照片 + 视频）',
      '填写复盘文档（参与者反馈/活动效果/改进建议）',
      '组织评选优秀组织者（含发起者 + 助教）',
    ],
    passCriteria: [
      '3 天内提交（不超过 T+3）',
      '复盘文档含现场素材 + 心得',
      '不人机（真实反馈）',
    ],
  },
  {
    matchName: '推动作品上墙（参与 OPC 能力认证）',
    whatToDo: [
      '引导参与者继续提交作品',
      '确保作品展示在作品墙',
      '参与 OPC 能力认证',
    ],
    passCriteria: [
      '作品上墙（≥1 个作品）',
      'OPC 认证截图 ≥1 张（参与者）',
    ],
  },
  {
    matchName: '志愿者审核作品+反馈+可推荐优秀',
    whatToDo: [
      '志愿者逐个查看作品并打勾通过/不通过',
      '在作品下方写反馈（≥1 条）',
      '标记 ≥1 个作品为"优秀"',
    ],
    passCriteria: [
      '志愿者先确认（提交 step1）',
      '组织者后确认（提交 step2）',
      '至少 1 个作品标记"优秀"',
    ],
  },
];

export function findCredentialSpec(subTaskName: string | undefined): CredentialSpec | undefined {
  if (!subTaskName) return undefined;
  // v16.6 Frank 16:04：先精确匹配，再双向 substring 匹配
  const exact = CREDENTIAL_SPECS.find((s) => s.matchName === subTaskName);
  if (exact) return exact;
  return CREDENTIAL_SPECS.find((s) => subTaskName.includes(s.matchName) || s.matchName.includes(subTaskName));
}

/**
 * v1.3 Frank 27 23:50 TDD 迭代：按钮按 ownerType + subTaskName 双重判断（不引 proofType 字段）
 *
 * 4 种 buttonType → 4 种按钮：
 *  - confirm: "我已确认"（无 Modal，直接调 submit）
 *  - form: "填写活动方案"（弹 form Modal）
 *  - image | mixed: "上传凭证 + 自核"（弹分类 Modal，mixed 按 proofCategories 分块）
 *  - volunteer-first: 2 步（志愿者"我已确认" + 组织者"我已确认"）
 *
 * 4 个 volunteer-first 子任务（v1 后端 SUBTASK_TEMPLATES 确认）：
 *  - INT-1 互加飞书好友 (ownerType=VOLUNTEER)
 *  - INT-4 飞书日历登记活动 (ownerType=VOLUNTEER)
 *  - REVIEW-3 志愿者审核作品 (ownerType=VOLUNTEER)
 *  - 注意：EXECUTE-2 主题分享虽然 v1.6 stageCredentialSpec 写过 volunteer-first，但后端 ownerType=ORGANIZER
 *    → 不应走 volunteer-first（按 v13/v1.6 Frank 改的 19 个子任务，EXECUTE 2 是 ORGANIZER）
 */
export type ButtonType = 'confirm' | 'form' | 'image' | 'mixed' | 'volunteer-first';

export function getButtonType(
  subTaskName: string | undefined,
  ownerType?: string
): ButtonType {
  if (!subTaskName) return 'image';
  // volunteer-first: 3 个子任务（必须 ownerType=VOLUNTEER + 是特殊流程子任务）
  if (
    ownerType === 'VOLUNTEER' &&
    (subTaskName.includes('互加飞书好友') ||
      subTaskName.includes('飞书日历登记活动') ||
      subTaskName.includes('志愿者审核作品'))
  ) {
    return 'volunteer-first';
  }
  // form: 1 个子任务（INT-3 双方最终确认）
  if (subTaskName.includes('双方最终确认活动方案')) {
    return 'form';
  }
  // confirm: 2 个子任务（INT-2 行动指南 + RECRUIT 3 复制专题）
  if (
    subTaskName.includes('阅读并确认行动指南') ||
    subTaskName.includes('复制专题并发布报名表单')
  ) {
    return 'confirm';
  }
  // mixed: 2 个子任务（启动本地招募 + 提交宣传推文）
  if (
    subTaskName.includes('启动本地招募宣传') ||
    subTaskName.includes('提交宣传推文')
  ) {
    return 'mixed';
  }
  // image: 其余 11 个子任务（默认走"上传凭证 + 自核"）
  return 'image';
}

// ============== v1.9.19 Frank 28 21:27 反馈：proofCategories 字段类型多态 ==============

/**
 * 5 种字段类型：
 *  - 'text'：填空题（Input）— Frank 说"精确地址是填空题"
 *  - 'timeRange'：时间区间下拉（TimePicker.RangePicker）— Frank 说"几点到几点的下拉选择"
 *  - 'multiImage'：多图上传（Upload multiple + ≥N 张验证）
 *  - 'singleUrl'：单个 URL（Input + URL 格式验证）— Frank 28 21:41 说"PPT 应该是单个飞书文档链接"
 *  - 'url'：默认 URL TextArea（多行） + URL 格式验证
 */
export type ProofCategoryType = 'text' | 'timeRange' | 'multiImage' | 'singleUrl' | 'url';

/**
 * 按 proofCategories 字符串精确匹配 type。Frank 28 21:27/21:41 反馈：
 *  - '精确地址（必填，填空 · 精确到门牌号）' → text
 *  - '使用时段（必填 · 几点到几点的下拉选择）' → timeRange
 *  - '现场图片（必上传 · 至少 3 张，含设备/桌椅/网络/入口）' → multiImage
 *  - 'PPT（飞书文档链接 · 更新本站点内容）' → singleUrl（不是多行 TextArea）
 *  - 其他 → url（保持原 TextArea + URL 验证）
 */
const PROOF_CATEGORY_TYPE_MAP: Record<string, ProofCategoryType> = {
  '精确地址（必填，填空 · 精确到门牌号）': 'text',
  '使用时段（必填 · 几点到几点的下拉选择）': 'timeRange',
  '现场图片（必上传 · 至少 3 张，含设备/桌椅/网络/入口）': 'multiImage',
  'PPT（飞书文档链接 · 更新本站点内容）': 'singleUrl',
};

export function inferProofCategoryType(cat: string): ProofCategoryType {
  return PROOF_CATEGORY_TYPE_MAP[cat] ?? 'url';
}

/**
 * v1.9.19 Frank 28 21:27 反馈：现场图片 5 项设备 checklist
 *  - "需要保证有投影设备 + 稳定网络 + 话筒 + 电源 + 桌椅"
 *  - 这 5 项做成 Checkbox 必填（Frank "保证有"），提交时拼成 JSON 存 proofFile 同 key 下
 */
export const VENUE_EQUIPMENT_ITEMS = [
  { key: 'projector', label: '投影设备' },
  { key: 'network', label: '稳定网络' },
  { key: 'mic', label: '话筒' },
  { key: 'power', label: '电源' },
  { key: 'desk', label: '桌椅' },
] as const;
