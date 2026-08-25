/**
 * 5 阶段子任务凭证规范（v16.6 改写 · Frank 2026-08-24 16:04 反馈）
 *
 * 数据源：飞书 wiki 文档 https://datawhaler.feishu.cn/wiki/LuBKwQdrQiBLYokvTUzccKVunDc
 *
 * 设计原则（v16.6 Frank 16:04 反馈）：
 *  - 子任务数据（stageSubtasks.ts）保持 v13 19 子任务不变（v13 已经 ship）
 *  - 凭证规范作为 UI 渲染层（不动后端、不动飞书 base）
 *  - 每子任务 = "📋 需要做什么" + "✅ 通过标准" 两个块
 *  - 大部分子任务改为"双方确认"（无需凭证上传 Modal）
 *  - 少数子任务（建群/视觉物料/启动招募/双方最终确认）保留凭证或填空表单
 *  - 飞书文档集成（每个活动 1 个飞书文档）v2 实施，v1 仅双方确认
 */

export type ProofType = 'confirm' | 'image' | 'mixed' | 'form' | 'volunteer-first';

export interface CredentialSpec {
  /** 子任务名称匹配 key（与 SUBTASK_TEMPLATES / dw_stage_tasks.subTaskName 对齐） */
  matchName: string;
  /**
   * 凭证类型（v16.7）：
   *  - confirm：双方确认（按钮 = 「我已确认」，无 Modal）
   *  - image：凭证图片（按钮 = 「上传凭证 + 自核」，单 Modal）
   *  - mixed：凭证图片 + 链接（按钮 = 「上传凭证 + 自核」，单 Modal）
   *  - form：填空表单（按钮 = 「填写活动方案」，单独 Modal）
   *  - volunteer-first：志愿者先完成 + 组织者确认（Frank 16:44 反馈）
   *    · 志愿者按钮 = 「我已确认（志愿者）」→ 调 submit
   *    · 组织者按钮 = 「我已确认（组织者）」→ 调 organizer-confirm
   *  - undefined / 'image'（默认）：保留 v16.5 行为（向后兼容 PREPARE/EXECUTE 11 个子任务）
   *
   * v16.7 Frank 16:44 反馈：
   *  - INT-1 互加飞书好友、INT-4 飞书日历、REVIEW 志愿者审核 改 volunteer-first
   *  - 16 子任务保持 v16.6 行为
   */
  proofType?: ProofType;
  /**
   * v16.8 Frank 22:16 反馈 Comment 1：凭证分类
   *  - 未设：Form 用 1 个 textarea（每行 1 个 URL）
   *  - 设了：Form 按类别渲染 N 个 Form.Item，每类独立 textarea
   *    · 提交时合并成 JSON：{ "类别1": "url1\nurl2", "类别2": "url3" } 存 proofFile
   *    · 显示时按类别展开（避免 Frank 提到"不知道哪个链接对应哪个"）
   *  - 例：'建活动群聊' → ['微信群二维码（必填）', '飞书群 URL（可选）', 'QQ 群 URL（可选）']
   */
  proofCategories?: string[];
  /** 该子任务需要做什么（步骤） */
  whatToDo: string[];
  /** 通过标准（怎么算这步完成）*/
  passCriteria: string[];
}

export const CREDENTIAL_SPECS: CredentialSpec[] = [
  // ========== 阶段 1 · INTENT（T-10）· 4 子任务（v13） ==========
  {
    matchName: '志愿者和组织者互加飞书好友',
    proofType: 'volunteer-first',  // v16.7 Frank 16:44：志愿者先加好友，组织者确认
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
    proofType: 'confirm',  // v16.6 Frank 16:04 Comment 3
    whatToDo: [
      '打开飞书 docx《Datawhale 生态伙伴 社区行动指南》',
      '完整阅读组织者 Do / Don\'t 规范和权益部分',
      '在指南末尾点击"已读 + 确认"按钮',
    ],
    passCriteria: [
      '已读 + 已确认（飞书 docx 嵌入打勾按钮）',
      '组织者与志愿者双方均"我已确认"',
    ],
  },
  {
    matchName: '双方最终确认活动方案/时间/地点/规模',
    proofType: 'form',  // v16.6 Frank 16:04 Comment 4：填空题目
    whatToDo: [
      '与志愿者在飞书 IM 沟通活动方案',
      '【必填】日期（精确到日）',
      '【选填】时间区间（几点到几点）',
      '【必填】地点（精确到商圈/学校/场地）',
      '【必填】预计规模（不超过 80 人）',
      '【必填】活动方案（上传飞书 docx 链接）',
    ],
    passCriteria: [
      '日期已确定（精确到日）',
      '地点已确定（精确到商圈/学校/场地）',
      '规模已确定（不超过 80 人）',
      '活动方案飞书链接已上传',
      '信息已同步到飞书 base 活动表',
      '组织者与志愿者双方均"我已确认"',
    ],
  },
  {
    matchName: '飞书日历登记活动',
    proofType: 'volunteer-first',  // v16.7 Frank 16:44：志愿者添加日历，组织者确认
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
    proofType: 'image',  // v16.6 Frank 16:04 Comment 7：建群上传凭证
    proofCategories: [  // v16.8 Frank 22:16 Comment 1：凭证分类
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
    proofType: 'image',  // v16.6 Frank 16:04 Comment 8：按类别多张图片
    proofCategories: [  // v16.8 Frank 22:16 Comment 1：凭证分类
      '旗帜 PNG（多张图片）',
      '海报 PNG（多张图片）',
      '横幅 PNG（5m × 0.7m）',
      '手举牌 PNG（Datawhale + 小浣熊）',
    ],
    whatToDo: [
      '在 [Canva 旗帜模板](https://www.canva.cn/design/DAHK2gF5sm0/ylFWiumDKJsLf_l4jsSeig/edit)（144cm × 96cm），替换城市/学校/日期',
      '在 [Canva 海报模板](https://khsj.cn/kldl7no55sa79g0)（少文字、引导报名）',
      '替换 Datawhale Logo + 商汤小浣熊 Logo',
      '导出 PNG 格式',
      '与志愿者确认视觉统一（思语/黄思语是运营，思语可沉淀规则给志愿者代为日常审核，必要时提级思雨）',
    ],
    passCriteria: [
      '旗帜 PNG 已导出（各站点统一，需回收复用）',
      '海报 PNG 已导出（引导报名）',
      '横幅 PNG 已导出（5m × 0.7m）',
      '手举牌 PNG 已导出（Datawhale + 小浣熊）',
      '视觉规范：Datawhale + 商汤小浣熊 Logo 正确',
      '已与志愿者/思雨确认（避免出街后返工）',
    ],
  },
  {
    matchName: '复制专题并发布报名表单',
    proofType: 'confirm',  // v16.6 Frank 16:04 Comment 9：可能被官方问卷取代
    whatToDo: [
      '【TODO · Frank 把参与者问卷放到官网即可】',
      '当前 v1 暂用 ailc-admin.datawhale.cn 平台 + 飞书日历',
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
    proofType: 'mixed',  // v16.6 Frank 16:04 Comment 10：分截图类 + 链接类
    proofCategories: [  // v16.8 Frank 22:16 Comment 1：凭证分类
      '【截图类】朋友圈 / 微信群 / 高校社团群 / 企业园区群（上传截图 ≥1 张）',
      '【链接类】公众号 / 视频号 / 小红书 / 高校社团自媒体号 / 企业园区自媒体号（上传文章链接 ≥1 个）',
    ],
    whatToDo: [
      '将定制好的海报通过本地渠道发布',
      '带话题 #DatawhaleAI+X创造节',
      '鼓励扫码报名 + 进群',
    ],
    passCriteria: [
      // v16.6 Frank 16:04 Comment 10：分两类凭证
      '【截图类渠道】朋友圈 / 微信群 / 高校社团群 / 企业园区群：上传推文/朋友圈截图（≥1 张）',
      '【链接类渠道】公众号 / 视频号 / 小红书 / 高校社团自媒体号 / 企业园区自媒体号：上传文章链接（≥1 个）',
      '话题 #DatawhaleAI+X创造节 已使用',
      '@Datawhale 官方账号',
    ],
  },

  // ========== 阶段 3 · PREPARE（T-3，wiki 文档写 T-5 · v1 沿用 PRD v3 T-3）· 3 子任务 ==========
  // v16.6 Frank 8-17 教训：严守范围。Frank 16:04 反馈只覆盖 INT 4 + RECRUIT 4 = 8 个子任务
  // PREPARE/EXECUTE/REVIEW 11 个子任务 Frank 16:04 未提及，暂不动 proofType
  {
    matchName: '确认场地并上传场地信息',
    proofType: 'image',
    proofCategories: [  // v16.8 Frank 10:53 Comment 1：精确地址 + 使用时段 + 现场图片分类
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
    matchName: '组织者+助教完成实操教程',
    whatToDo: [
      '登录学习平台 ailc.datawhale.cn',
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
    proofType: 'image',
    proofCategories: [  // v16.8 Frank 10:53 Comment 5：物料分类（接收/打印/任务卡/PPT）
      '接收物料（≥1 张照片，联系钱皓亮寄送）',
      '打印物料（≥1 张照片，含横幅/手卡/手举牌/旗帜）',
      '任务卡（≥1 张照片，6 种：简历优化/活动策划/学习计划/公众号推文/社团招新方案/数据分析）',
      'PPT（飞书文档链接 · 更新本站点内容）',
    ],
    whatToDo: [
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
    proofType: 'mixed',
    proofCategories: [  // v16.8 Frank 10:53 Comment 6：截图类 + 链接类
      '【截图类】微信群 / 朋友圈 / 高校社团群（上传截图 ≥1 张）',
      '【链接类】公众号 / 视频号 / 小红书 / 高校社团自媒体账号（上传文章链接 ≥1 个）',
    ],
    whatToDo: [
      '在微信群 / 公众号 / 朋友圈 / 视频号 / 小红书 / 高校社团 发布活动推文',
      '带话题 #DatawhaleAI+X创造节',
      '引导用户扫码报名 + 进群',
    ],
    passCriteria: [
      '推文已发布（≥1 个渠道）',
      '截图类 ≥1 张',
      '链接类 ≥1 个',
      '话题 #DatawhaleAI+X创造节 已使用',
    ],
  },
  {
    matchName: '参与者上传作品/申请的认证',
    proofType: 'image',
    proofCategories: [  // v16.8 Frank 10:53 Comment 7：作品墙 + 徽章认证分类
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

  // ========== 阶段 4 · EXECUTE（T）· 4 子任务（v13） ==========
  {
    matchName: '现场签到与引导',
    // v16.9 Frank 13:54 反馈：回归 3 步流程（组织者自核 → 志愿者审核 → 运营复核），不是 volunteer-first
    proofType: 'image',
    whatToDo: [
      '引导参与者扫码签到（ailc-admin 平台）',
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
    matchName: '主题分享+带教实操+闪电分享',
    proofType: 'volunteer-first',  // v16.8 Frank 10:53 Comment 9：提醒每阶段拍照 + 双方确认
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
    proofType: 'mixed',
    proofCategories: [  // v16.8 Frank 10:53 Comment 10：照片 / 视频 / 社媒分类
      '横版高清照片（≥5 张，每环节至少 1 张）',
      '视频（可选 · 讲座/实操关键片段）',
      '社媒截图/链接（参与者发布作品 #DatawhaleAI+X创造节）',
    ],
    whatToDo: [
      '拍摄横版高清照片（每环节至少 1 张）',
      '视频可选（讲座/实操关键片段）',
      '引导参与者在社媒发布作品 + 带话题 #DatawhaleAI+X创造节',
      '@Datawhale 官方账号',
    ],
    passCriteria: [
      '素材链接 ≥5 个（照片 ≥5 + 视频可选）',
      '横版高清（≥1920×1080）',
      '话题 #DatawhaleAI+X创造节 + @Datawhale',
    ],
  },
  {
    matchName: '引导参与者上传到作品墙获取徽章认证',
    whatToDo: [
      '引导参与者在活动现场提交作品（图片/文档/视频）',
      '确保作品展示在作品墙',
      '引导参与者获取 OPC 能力认证徽章',
      '截图保存作品墙',
    ],
    passCriteria: [
      '作品墙截图 ≥1 张',
      '徽章认证截图 ≥1 张（参与者）',
      '至少 1 个作品已上墙',
    ],
  },

  // ========== 阶段 5 · REVIEW（T+3）· 3 子任务（v13 删 1 运营兜底，剩 3 个）==========
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
      '参与商汤小浣熊 OPC 能力挑战赛',
      '邀请 datawhale 运营负责人水琼进群（如需要）',
    ],
    passCriteria: [
      '作品链接 ≥1 个',
      'OPC 认证截图 ≥1 张',
      '商汤小浣熊 OPC 能力挑战赛报名',
    ],
  },
  {
    matchName: '志愿者审核作品+反馈+可推荐优秀',
    proofType: 'volunteer-first',  // v16.7 Frank 16:44：志愿者先审核，组织者确认结果
    whatToDo: [
      '志愿者查看所有作品（图片/视频/文档）',
      '对每个作品给出反馈（点赞 + 评语）',
      '标记优秀作品（推荐到 Datawhale 官方）',
      '更新 reviewStatus = APPROVED',
    ],
    passCriteria: [
      '志愿者先完成审核（提交 step1）',
      '组织者确认结果（提交 step2）',
      '至少 1 个作品标记"优秀"',
      '反馈评语 ≥1 条',
    ],
  },
];

/** 根据子任务名查找凭证规范（模糊匹配） */
export function findCredentialSpec(subTaskName: string | undefined): CredentialSpec | undefined {
  if (!subTaskName) return undefined;
  // 精确匹配
  const exact = CREDENTIAL_SPECS.find((s) => s.matchName === subTaskName);
  if (exact) return exact;
  // 模糊匹配（包含）
  return CREDENTIAL_SPECS.find((s) => subTaskName.includes(s.matchName) || s.matchName.includes(subTaskName));
}
