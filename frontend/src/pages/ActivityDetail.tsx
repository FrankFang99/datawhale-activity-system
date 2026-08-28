import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Button, Tag, Spin, Descriptions, Typography, Segmented, Empty, message, Alert, Space, Modal, Form, Input,
  DatePicker, TimePicker, InputNumber, Upload,
} from 'antd';
import {
  CalendarOutlined, EnvironmentOutlined, TeamOutlined, ArrowLeftOutlined,
  UserAddOutlined, CheckCircleOutlined, FileTextOutlined, ClockCircleOutlined,
  CloudUploadOutlined, CloseCircleOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { activityApi, participantApi, interestApi, materialApi, applicationApi, stageApi, uploadApi, Material, Activity, StageTask } from '../services/api';
import { authStore } from '../store/auth';
import { STAGE_TEMPLATES_FRANK, canViewSubTasks, Stage, SubTask } from '../data/stageSubtasks';
import { findCredentialSpec, getButtonType } from '../data/stageCredentialSpec';

// v1.5 Frank 28 09:31 反馈：把 proofHint 文字里的 markdown 超链接 [文字](URL) 解析为可点击 <a>
// 也支持纯 URL（没 markdown 包装的）自动转链接
// 用于 stageSubtasks.ts proofHint（v1.3 恢复）和 stageCredentialSpec.ts whatToDo
function renderTextWithLinks(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  // 匹配 [文字](URL) 或纯 URL（http/https）
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // markdown 格式 [文字](URL)
      parts.push(
        <a key={`link-${key++}`} href={match[2]} target="_blank" rel="noreferrer" style={{ color: '#1677ff' }}>
          {match[1]}
        </a>
      );
    } else {
      // 纯 URL
      const url = match[3];
      parts.push(
        <a key={`link-${key++}`} href={url} target="_blank" rel="noreferrer" style={{ color: '#1677ff' }}>
          {url}
        </a>
      );
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : text;
}

const { Title, Paragraph, Text } = Typography;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: '待确定',   color: 'default' },
  PUBLISHED: { label: '准备举办', color: 'green' },
  ONGOING:   { label: '举办中',   color: 'blue' },
  FINISHED:  { label: '已结束',   color: 'default' },
  CANCELLED: { label: '已取消',   color: 'red' },
};

const STAGES = [
  { stage: 'INTENT' as const,  title: '确认意向', desc: 'T-10' },
  { stage: 'RECRUIT' as const, title: '对外招募', desc: 'T-7' },
  { stage: 'PREPARE' as const, title: '现场筹备', desc: 'T-3' },
  { stage: 'EXECUTE' as const, title: '活动执行', desc: 'T' },
  { stage: 'REVIEW' as const,  title: '活动复盘', desc: 'T+3' },
];

/**
 * Frank 27 20:03 反馈 Comment 2/3：v1 流程"志愿者先 → 组织者 confirm"在前端没体现
 *
 * v16.7 Frank 16:44 引入 volunteer-first 流程（3 个 ownerType=VOLUNTEER 子任务）：
 *   - INT-1 志愿者和组织者互加飞书好友
 *   - INT-4 飞书日历登记活动
 *   - REVIEW-3 志愿者审核作品+反馈+可推荐优秀
 *
 * v16.7 当时用 `credSpec?.proofType === 'volunteer-first'` 判断
 * v1.2 Frank 27 删了 stageCredentialSpec.proofType 字段（"按原来设置"简化）→ credSpec.proofType 永远 undefined
 * → 整条 volunteer-first 流程在 v1.2 之后被禁用了，所有子任务走默认"组织者上传 → 志愿者审 → 运营复核"3 步
 * → SubTaskCard 永远不会显示"志愿者先 → 组织者 confirm"流程
 *
 * 修复：用 task.ownerType === 'VOLUNTEER' 判断（v1 后端 SUBTASK_TEMPLATES 写死的 ownerType 是真实数据源）
 */
function isVolunteerFirstSubTask(ownerTypeStr: string | undefined): boolean {
  return ownerTypeStr === 'VOLUNTEER';
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);
  const [interestForm] = Form.useForm();
  const [interestSubmitting, setInterestSubmitting] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [materials, setMaterials] = useState<Material[]>([]);
  // v10 5 阶段可点击 tab + 3 步进度
  const [selectedStage, setSelectedStage] = useState<'INTENT' | 'RECRUIT' | 'PREPARE' | 'EXECUTE' | 'REVIEW'>('INTENT');
  const [appId, setAppId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<StageTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  // v1.2 Frank 27 21:40 反馈：存 application 的 userId/volunteerId，给 SubTaskCard 过滤按钮用
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [appVolunteerId, setAppVolunteerId] = useState<string | null>(null);
  // v13 Frank 14:12 Comment 6：组织者解锁下一阶段 loading（已删，v16.9 Frank 13:10 反馈"不需要志愿者审核，去掉此按钮"）
  // v16.7 Frank 20:35 反馈：unlock 后按钮变"已解锁下一阶段"（已删）
  const user = authStore((s) => s.user);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const a: any = await activityApi.get(id);
      setActivity(a);
      try {
        const cnt = await participantApi.count(id);
        setParticipantCount(cnt.count);
      } catch { /* 容错 */ }
      if (user) {
        try {
          const mine = await participantApi.mine();
          setRegistered(mine.list.some((p) => p.activityId === id && p.status === 'REGISTERED'));
        } catch { /* 容错 */ }
      }
      // v9 物料下载（公开接口）
      try {
        const m = await materialApi.byActivity(id);
        setMaterials(m.list);
      } catch { /* 容错 */ }
      // v10 找该活动当前 CONFIRMED 申请 → 加载 5 阶段任务（所有可看角色通用）
      try {
        const byAct = await applicationApi.byActivity(id);
        const confirmed = byAct.list[0];
        if (confirmed) {
          setAppId(confirmed.applicationId);
          setAppUserId(confirmed.userId ?? null);  // v1.2：组织者 userId
          setAppVolunteerId(confirmed.volunteerId ?? null);  // v1.2：对接志愿者 userId
          const t = await stageApi.list(confirmed.applicationId);
          setTasks(t.list);
        } else {
          setAppId(null);
          setAppUserId(null);
          setAppVolunteerId(null);
          setTasks([]);
        }
      } catch { /* 容错 */ }
    } catch {
      message.error('活动加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 阶段 tab 切换后，3 步进度从已加载的 tasks 里过滤（无需重新拉）
  const loadTasksForStage = async (_stage: string) => {
    if (!appId) return;
    setTasksLoading(true);
    try {
      const t = await stageApi.list(appId);
      setTasks(t.list);
    } catch { /* 容错 */ }
    finally {
      setTasksLoading(false);
    }
  };

  // v16.8 Frank 23:03 反馈：URL query 参数自动定位 stage + 子任务（来自站内信跳转）
  // 例：/activities/NO.001?stage=INTENT&order=2 → 自动选 INTENT tab + 滚到 order=2 子任务
  const targetStage = searchParams.get('stage') as 'INTENT' | 'RECRUIT' | 'PREPARE' | 'EXECUTE' | 'REVIEW' | null;
  const targetOrder = searchParams.get('order');
  const subTaskRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.userId]);

  // v16.8 Frank 23:03 反馈：query 参数 → setSelectedStage + 滚到子任务
  useEffect(() => {
    if (targetStage && ['INTENT', 'RECRUIT', 'PREPARE', 'EXECUTE', 'REVIEW'].includes(targetStage)) {
      setSelectedStage(targetStage);
      loadTasksForStage(targetStage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStage]);

  useEffect(() => {
    if (targetOrder && tasks.length > 0) {
      // 找到 order 匹配的任务，scroll 到那里（用 data-task-id 属性 + 重试 3 次防止数据未就绪）
      const target = tasks.find((t) => String(t.order) === String(targetOrder));
      if (target) {
        let attempts = 0;
        const tryScroll = () => {
          const el = document.querySelector(`[data-task-id="${target.taskId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 高亮一下该卡片
            (el as HTMLElement).style.transition = 'box-shadow 0.6s';
            (el as HTMLElement).style.boxShadow = '0 0 0 4px #3370FF';
            setTimeout(() => {
              (el as HTMLElement).style.boxShadow = 'none';
            }, 2500);
          } else if (attempts < 3) {
            attempts++;
            setTimeout(tryScroll, 400);
          }
        };
        setTimeout(tryScroll, 600);
      }
    }
  }, [targetOrder, tasks]);

  const handleJoin = async () => {
    if (!user) {
      message.warning('请先登录');
      navigate('/login');
      return;
    }
    if (!activity) return;
    setRegistering(true);
    try {
      await participantApi.register({ activityId: activity.activityId, remark: '' });
      message.success('已成功加入活动参与者名单');
      setRegistered(true);
      setParticipantCount((c) => c + 1);
    } catch {
      /* 拦截器已处理 */
    } finally {
      setRegistering(false);
    }
  };

  const handleApplyAsOrganizer = () => {
    if (!user) {
      message.warning('请先登录');
      navigate('/login');
      return;
    }
    navigate(`/apply/${id}`);
  };

  const handleInterest = async () => {
    const v = await interestForm.validateFields();
    setInterestSubmitting(true);
    try {
      await interestApi.create({
        schoolName: activity?.location || v.schoolName,
        userName: v.userName,
        email: v.email,
        phone: v.phone,
        remark: v.remark,
      });
      message.success('已登记对该站点的兴趣，运营会尽快联系你');
      setInterestOpen(false);
      interestForm.resetFields();
    } catch {
      /* 拦截器已处理 */
    } finally {
      setInterestSubmitting(false);
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: 64 }} />;
  if (!activity) return <Empty description="活动不存在或已下架" />;

  // v1.2 Frank 27 09:41 反馈：活动没组织者时显示 Alert + 双按钮
  // 之前的 isPending = activity.status === 'PENDING' 不准确（活动可能是 PUBLISHED 但实际没组织者）
  // 改用后端返回的 needOrganizer 字段（活动详情接口已返回）
  const isPending = activity.needOrganizer ?? (activity.status === 'PENDING');
  const isFinished = activity.status === 'FINISHED' || activity.status === 'CANCELLED';
  const statusInfo = STATUS_MAP[activity.status] ?? { label: activity.status, color: 'default' };
  // Frank 27 11:20 Comment 3：移除 isReadOnlyRole 限制——参与者或普通用户都应该能申请
  // 后端已有重复申请检查（findDuplicateApplication）防止同一用户重复申请
  const isReadOnlyRole = false;

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 16, padding: 0 }}>
        返回活动大厅
      </Button>

      <Card style={{ borderRadius: 16, marginBottom: 24, overflow: 'hidden' }}>
        <div
          style={{
            height: 200,
            background: 'linear-gradient(135deg, #3370FF 0%, #62D4C8 100%)',
            borderRadius: 12,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 40,
            fontWeight: 700,
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {activity.title}
        </div>

        <Title level={2}>{activity.title}</Title>
        <Space wrap style={{ marginBottom: 16 }}>
          <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
          {activity.series && <Tag color="purple">📚 {activity.series}</Tag>}
          {!isPending && activity.daysToStart != null && activity.daysToStart > 0 && (
            <Tag color="orange">距开始 {activity.daysToStart} 天</Tag>
          )}
        </Space>

        {isPending && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="该站点暂未确定组织者"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>
                  我们正在为该学校寻找合适的组织者。你可以先报名成为参与者，运营确认组织者后会通知你；
                  也可以点击"申请成为组织者"直接申请该站点。
                </p>
              </div>
            }
          />
        )}

        {isFinished && (
          <Alert type="info" showIcon style={{ marginBottom: 16 }} message="该活动已结束或取消，暂不可报名" />
        )}

        {!isPending && !isFinished && (
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 24 }}>
            <Descriptions.Item label={<><CalendarOutlined /> 时间</>}>
              {activity.startDate} ~ {activity.endDate}
            </Descriptions.Item>
            <Descriptions.Item label={<><EnvironmentOutlined /> 地点</>}>
              {activity.location}
            </Descriptions.Item>
            <Descriptions.Item label={<><TeamOutlined /> 规模</>}>
              最多 {activity.maxParticipants} 人 · 已报名 <Text strong style={{ color: '#3370FF' }}>{participantCount}</Text> 人
            </Descriptions.Item>
          </Descriptions>
        )}

        <Title level={4}>活动介绍</Title>
        <Paragraph>
          {activity.description || (isPending
            ? '该站点的具体时间地点待组织者确定，欢迎报名参与者或申请成为组织者。'
            : '暂无详细介绍')}
        </Paragraph>

        {activity.requirements && !isPending && (
          <>
            <Title level={4} style={{ marginTop: 24 }}>申请要求</Title>
            <Paragraph>{activity.requirements}</Paragraph>
          </>
        )}

        {/* v9 物料下载 (PRD §4.1.6 US-V5) */}
        {materials.length > 0 && (
          <Card
            size="small"
            style={{ marginBottom: 16, background: '#FAFCFF' }}
            title="📄 活动物料下载"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {materials.map((m) => (
                <a
                  key={m.materialId}
                  href={m.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Card hoverable size="small" bodyStyle={{ padding: 12 }} style={{ borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 22 }}>📄</span>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {m.category} · {m.scope === 'GLOBAL' ? '全局' : '该活动'}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* v1.2 Frank 2026-08-27 反馈：5 阶段时间轴 always-on 展示（之前 !isPending 限制，Frank 8-21 反馈要没组织者也展示）*/}
        <Title level={4} style={{ marginTop: 24 }}>5 阶段时间轴</Title>
        <Segmented
          block
          value={selectedStage}
          onChange={(v) => {
            const s = v as 'INTENT' | 'RECRUIT' | 'PREPARE' | 'EXECUTE' | 'REVIEW';
            setSelectedStage(s);
            if (!isPending) loadTasksForStage(s);
          }}
          options={STAGES.map((s) => ({ label: `${s.title} ${s.desc}`, value: s.stage }))}
          style={{ marginBottom: 16 }}
        />

        {/* Frank 28 13:13 反馈 Comment 1：删除整个"阶段概览" Card
            - Frank 觉得冗余：和下面"阶段任务" Card 内容重复
            - 子任务预览 + 描述由下面 !isPending && canViewSubTasks(...) 条件块渲染（来自后端 stage_tasks 数据）
        */}

        {/* Frank 27 20:18 反馈 Comment 1/2：删"阶段子任务模板预览" Card（重复，跟下面"阶段任务" Card 内容一样）
            子任务凭证规范 whatToDo/passCriteria 已在每个 SubTaskCard 内显示（line 1172-1194）*/}

        {/* Frank 2026-08-22 14:35 重新排版：
            - 5 阶段可点击 tab 切换（不再只显示当前阶段）
            - 每个子任务卡片按角色展示 3 步进度：组织者自核 → 志愿者审核 → 运营复核
            - 操作按钮按角色显示
            - ORGANIZER/ASSISTANT/VOLUNTEER/OPERATOR/ADMIN：可看子任务
            - PARTICIPANT：Frank 28 14:13 反馈也能看（决定是否要成为组织者）
            - USER：保持现有 5 阶段时间轴，不展开子任务 */}
        {canViewSubTasks(user?.role) && (
          // Frank 28 14:13 反馈：去掉 !isPending + appId 限制
          // - 即使活动没组织者（isPending=true），参与者也要能看完整 5 阶段 + 19 子任务
          // - 决定是否要申请成为组织者
          // - Frank 28 14:39 反馈：NO.042 等没申请的活动也要看 19 子任务模板
          //   - appId 有：用真实 stage_tasks（后端）渲染 SubTaskCard，按 stakeholder 决定按钮
          //   - appId 没：用 STAGE_TEMPLATES_FRANK 模板渲染，无操作按钮（纯预览）
          <Card
            size="small"
            style={{ marginBottom: 16, background: '#FAFCFF' }}
            title={
              <Space>
                <FileTextOutlined />
                <span>阶段任务 · {STAGE_TEMPLATES_FRANK.find((s) => s.stage === selectedStage)?.title ?? ''}</span>
                <Tag color="blue">{STAGE_TEMPLATES_FRANK.find((s) => s.stage === selectedStage)?.hint ?? ''}</Tag>
                {getCurrentStage(activity) === STAGE_TEMPLATES_FRANK.findIndex((s) => s.stage === selectedStage) && (
                  <Tag color="green">当前阶段</Tag>
                )}
                {!appId && <Tag color="orange">模板预览（活动未申请）</Tag>}
              </Space>
            }
          >
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
              <ClockCircleOutlined /> {STAGE_TEMPLATES_FRANK.find((s) => s.stage === selectedStage)?.desc}
            </Paragraph>
            {appId ? (
              <>
                {tasksLoading && <Spin />}
                {!tasksLoading && tasks.filter((t) => t.stage === selectedStage).length === 0 && (
                  <Empty description="该阶段暂无子任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {tasks
                    .filter((t) => t.stage === selectedStage)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((t) => (
                      <SubTaskCard
                        key={t.taskId}
                        task={t}
                        user={user}
                        // v1.2 Frank 27 21:40：传 application 的 userId/volunteerId 给按钮过滤
                        appUserId={appUserId}
                        appVolunteerId={appVolunteerId}
                        onRefresh={load}
                      />
                    ))}
                </Space>
              </>
            ) : (
              // Frank 28 14:39 反馈：没申请的活动用 STAGE_TEMPLATES_FRANK 模板渲染
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {(STAGE_TEMPLATES_FRANK.find((s) => s.stage === selectedStage)?.subTasks ?? []).map((t) => (
                  <TemplateSubTaskCard key={`${selectedStage}-${t.order}`} template={t} />
                ))}
              </Space>
            )}
            {/* v16.2 Frank 10:30 Comment 3：不显示提示块 */}

            {/* Frank 2026-08-23 09:17 反馈 Comment 5：每阶段底部"进入下一阶段"按钮
                - 阶段所有子任务 COMPLETED → 激活
                - 未完成 → 灰色锁定 + 提示"完成本阶段 N 项后激活"
                - 点击 → 切换到下一阶段
                - 最后阶段 REVIEW → 显示"活动已完结"
                - v13 Frank 14:12 反馈 Comment 6：组织者完成所有子任务 → 解锁此按钮 → 消息通知志愿者审核
                - v16.2 Frank 10:30 反馈 Comment 4：按 ownerType 区分
                  · ownerType=ORGANIZER 子任务：需 3 步都完成（自核 + 志愿者审核通过 + 运营复核通过）
                  · ownerType=VOLUNTEER 子任务：需自己打勾（自核完成）
                  · ownerType=OPERATOR 子任务：不计入解锁条件
                - v16.4 Frank 13:26 反馈：运营复核只在 UNCERTAIN 时介入
                  · ORGANIZER 子任务：自核 + 志愿者审核通过 = 完成（**不依赖运营复核**）
                  · 运营复核只在志愿者 UNCERTAIN（无法判断）时介入 */}
            {(() => {
              const stageTasks = tasks.filter((t) => t.stage === selectedStage);
              const stageOrder = STAGES.findIndex((s) => s.stage === selectedStage);
              const nextStage = STAGES[stageOrder + 1];
              // v16.8 Frank 11:35 反馈：unlock 条件简化 —— 只看子任务 status==='COMPLETED' 即可
              // 不再依赖 step1Done + reviewStatus 组合判断（志愿者/运营审核都旁路后，COMPLETED 由 submit 端点决定）
              const completed = stageTasks.length > 0 && stageTasks.every((t) => t.status === 'COMPLETED');
              const isLast = !nextStage;
              // v16.9 Frank 13:10 反馈："已说过不需要志愿者审核。直接去掉此按钮"
              // 删 unlockNextStage 按钮 + notifyVolunteerReview API 调用
              // 阶段切换靠用户点 5 阶段 tab 完成（line 343 setSelectedStage(s)）
              const stageCompletedCount = stageTasks.filter((t) => t.status === 'COMPLETED').length;

              return (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  {isLast ? (
                    completed ? (
                      <Button size="large" type="primary" icon={<CheckCircleOutlined />} disabled>
                        活动已完结
                      </Button>
                    ) : (
                      <Button size="large" disabled>
                        🔒 完成本阶段 {stageCompletedCount}/{stageTasks.length} 项后解锁
                      </Button>
                    )
                  ) : completed ? (
                    // v16.9 Frank 13:10：完成且非最后阶段 → 提示用户点 tab 切换下一阶段（不再通知志愿者）
                    <Button size="large" disabled icon={<CheckCircleOutlined />} style={{ background: '#D1FAE5', color: '#10B981', borderColor: '#10B981' }}>
                      ✓ 本阶段已完成（点击上方 tab 进入「{nextStage.title}」）
                    </Button>
                  ) : (
                    <Button size="large" disabled icon={<CheckCircleOutlined />}>
                      🔒 完成本阶段 {stageCompletedCount}/{stageTasks.length} 项后解锁「{nextStage.title}」
                    </Button>
                  )}
                </div>
              );
            })()}
          </Card>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {isReadOnlyRole ? (
            <></>
          ) : isPending ? (
            // 活动未确定组织者：显示"申请成为组织者" + "对该站点感兴趣"
            <Space size="middle" wrap>
              <Button
                type="primary"
                size="large"
                icon={<UserAddOutlined />}
                onClick={() => setInterestOpen(true)}
                className="dw-gradient-btn"
                style={{ minWidth: 200, height: 48, fontSize: 16 }}
              >
                对该站点感兴趣
              </Button>
              <Button
                size="large"
                onClick={handleApplyAsOrganizer}
                style={{ minWidth: 200, height: 48, fontSize: 16 }}
              >
                申请成为组织者
              </Button>
            </Space>
          ) : isFinished ? (
            <Button size="large" disabled style={{ minWidth: 200, height: 48, fontSize: 16 }}>
              活动已结束
            </Button>
          ) : user?.role === 'ORGANIZER' || user?.role === 'ASSISTANT' ? (
            // v16.5 Frank 14:04 Comment 4：删"查看 5 阶段任务"按钮（5 阶段任务在当前页面内已展开）
            <Text type="secondary" style={{ fontSize: 13 }}>5 阶段任务见上方</Text>
          ) : registered ? (
            // Frank #7: 已报名参与者 + 引导入群
            <Space size="middle" wrap>
              <Button
                size="large"
                icon={<CheckCircleOutlined />}
                disabled
                style={{ minWidth: 200, height: 48, fontSize: 16, background: '#10B981', borderColor: '#10B981', color: '#fff' }}
              >
                已报名参与者
              </Button>
              {activity.groupQrCode && (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => {
                    if (activity.groupQrCode) {
                      window.open(activity.groupQrCode, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="dw-gradient-btn"
                  style={{ minWidth: 200, height: 48, fontSize: 16 }}
                >
                  🎯 加入活动飞书群
                </Button>
              )}
            </Space>
          ) : (
            // Frank #7: 已确定组织者 → 普通用户只能"参与活动" + 引导入群，不显示"申请成为组织者"
            <Space size="middle" wrap>
              <Button
                type="primary"
                size="large"
                icon={<UserAddOutlined />}
                loading={registering}
                onClick={handleJoin}
                className="dw-gradient-btn"
                style={{ minWidth: 200, height: 48, fontSize: 16 }}
              >
                参与活动 · 加入参与者名单
              </Button>
              {activity.groupQrCode && (
                <Button
                  size="large"
                  onClick={() => {
                    if (activity.groupQrCode) {
                      window.open(activity.groupQrCode, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  style={{ minWidth: 200, height: 48, fontSize: 16 }}
                >
                  💬 查看活动群
                </Button>
              )}
            </Space>
          )}
        </div>
      </Card>

      <Modal
        title={`登记兴趣 · ${activity.title}`}
        open={interestOpen}
        onCancel={() => setInterestOpen(false)}
        onOk={handleInterest}
        confirmLoading={interestSubmitting}
        okText="提交"
        cancelText="取消"
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="运营会在该站点确认组织者后，通过邮箱联系你"
        />
        <Form form={interestForm} layout="vertical">
          <Form.Item name="schoolName" hidden initialValue={activity.title}><Input /></Form.Item>
          <Form.Item name="userName" label="你的姓名" rules={[{ required: true, max: 50 }]}>
            <Input placeholder="请填写你的姓名" />
          </Form.Item>
          <Form.Item name="email" label="联系邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="your@email.com" />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ pattern: /^1\d{10}$/, message: '请填写 11 位手机号' }]}>
            <Input placeholder="11 位手机号（选填）" />
          </Form.Item>
          <Form.Item name="remark" label="想参加的原因" rules={[{ max: 500 }]}>
            <Input.TextArea rows={3} maxLength={500} showCount placeholder="说说你为什么想参加这个活动" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function getCurrentStage(a: Activity): number {
  if (!a.startDate || !a.endDate) return 0;
  const now = Date.now();
  const start = new Date(a.startDate).getTime();
  const end = new Date(a.endDate).getTime();
  const T_MINUS_10 = start - 10 * 24 * 3600 * 1000;
  const T_PLUS_3 = end + 3 * 24 * 3600 * 1000;
  if (now < T_MINUS_10) return 0;
  if (now < start - 7 * 24 * 3600 * 1000) return 0;
  if (now < start - 3 * 24 * 3600 * 1000) return 1;
  if (now < start) return 2;
  if (now < end) return 3;
  if (now < T_PLUS_3) return 4;
  return 4;
}

// Frank 28 14:39 反馈：没申请的活动也显示 19 子任务模板（用 STAGE_TEMPLATES_FRANK 模板数据）
// 纯预览：title + ownerType 标签 + proofHint + 凭证规范，不显示任何操作按钮
function TemplateSubTaskCard({ template }: { template: SubTask }) {
  const credSpec = findCredentialSpec(template.name);
  const ownerLabel = template.ownerType === 'VOLUNTEER' ? '志愿者' : template.ownerType === 'ORGANIZER' ? '组织者' : '运营';
  const ownerColor = template.ownerType === 'VOLUNTEER' ? 'green' : template.ownerType === 'ORGANIZER' ? 'blue' : 'purple';
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#3370FF' }}>{template.order}.</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', flex: 1 }}>{template.name}</span>
        <Tag color={ownerColor} style={{ marginRight: 0 }}>👤 {ownerLabel}</Tag>
      </div>
      {template.proofHint && (
        <div style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>
          📎 凭证：{template.proofHint}
        </div>
      )}
      {credSpec && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>
          <div style={{ marginBottom: 4 }}>
            <Text strong style={{ color: '#3370FF' }}>📋 需要做什么：</Text>
          </div>
          <ol style={{ margin: '0 0 6px 0', paddingLeft: 20 }}>
            {credSpec.whatToDo.map((step, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{step}</li>
            ))}
          </ol>
          <div style={{ marginBottom: 4 }}>
            <Text strong style={{ color: '#10B981' }}>✅ 通过标准：</Text>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {credSpec.passCriteria.map((c, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{c}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// v15 SubTaskCard（Frank 2026-08-23 20:49 反馈：换 UI 设计）
// 改版要点：
//  1. ownerType tag 同行 + 字号大（14px）+ 圆角胶囊
//  2. 3 步进度横向布局（3 列：① ② ③），圆圈 + check/x 大图标
//  3. 上传凭证显式 Input + 拖拽区（不是 Modal 才看到）
//  4. 打勾确认/审核按钮加大（size="default"） + 大图标
//  5. 当前激活步骤高亮
// v1.2 Frank 27 21:40 反馈：加 appUserId/appVolunteerId 过滤按钮显示（org-thu 改 NO.018 bug 前端防御）
function SubTaskCard({
  task,
  user,
  appUserId,
  appVolunteerId,
  onRefresh,
}: {
  task: StageTask;
  user: any;
  appUserId: string | null;       // 活动组织者 userId（application.userId）
  appVolunteerId: string | null;  // 对接志愿者 userId（application.volunteerId）
  onRefresh: () => Promise<void>;
}) {
  // v16.8 Frank 10:53 反馈 Comment 2：把 [文字](URL) markdown 链接解析为可点击 link
  // 不显示完整 URL（避免 whatToDo/passCriteria 列表里堆一长串网址）
  const renderTextWithLinks = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      // 匹配前的纯文本
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
      }
      // markdown 链接
      parts.push(
        <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer" style={{ color: '#3370FF' }}>
          {match[1]}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
    }
    return parts.length > 0 ? parts : text;
  };

  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [opReviewOpen, setOpReviewOpen] = useState(false);
  // v16.6 双方确认（无 Modal）+ 填空表单（Comment 4）
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formForm] = Form.useForm();
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [submitForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [opReviewForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [opReviewing, setOpReviewing] = useState(false);

  const role = user?.role;
  // 飞书 select 字段是 array；归一为字符串
  const ownerTypeStr = Array.isArray(task.ownerType) ? task.ownerType[0] : task.ownerType;
  // 是否显示该子任务的 3 步进度：仅 ORGANIZER 类型的子任务
  const show3Step = ownerTypeStr === 'ORGANIZER';

  // 3 步状态
  const step1Done = !!task.organizerSubmittedAt;
  const step2Done = task.reviewStatus === 'APPROVED';
  const step2Rejected = task.reviewStatus === 'REJECTED';
  const step3Done = task.operatorReviewStatus === 'APPROVED';
  const step3Rejected = task.operatorReviewStatus === 'REJECTED';

  // 当前激活步骤：1=step1 待办；2=step2 待办（已自核）；3=step3 待办（已审核）；0=全部完成
  const activeStep = step3Done ? 0 : step2Done ? 3 : step1Done ? 2 : 1;

  // 角色权限
  // v16.8 Frank 22:16 反馈：UNCERTAIN 后志愿者不能再审（等运营介入）；REJECTED 后志愿者不能再审（等组织者重传）
  // v1.2 Frank 27 21:40 反馈：加 application userId/volunteerId 比对（org-thu 改 NO.018 bug 前端防御）
  //   - canOrganizerSubmit：ADMIN/OPERATOR 全管；ORGANIZER/ASSISTANT 必须是 appUserId
  //   - canVolunteerReview：仅 VOLUNTEER（后端 requireRole 挡 ADMIN/OPERATOR/USER/PARTICIPANT/ORGANIZER）+ 必须是 appVolunteerId
  //   - canOperatorReview：ADMIN/OPERATOR 全管（运营不需要 application 匹配）
  const isAppOrganizer = !!appUserId && appUserId === user?.userId;
  const isAppVolunteer = !!appVolunteerId && appVolunteerId === user?.userId;
  const isAdminOp = role === 'ADMIN' || role === 'OPERATOR';
  const canOrganizerSubmit = isAdminOp
    ? show3Step
    : (role === 'ORGANIZER' || role === 'ASSISTANT') && isAppOrganizer && show3Step;
  const canVolunteerReview =
    role === 'VOLUNTEER' && isAppVolunteer && show3Step && step1Done
    && task.reviewStatus !== 'APPROVED'
    && task.reviewStatus !== 'UNCERTAIN'
    && task.reviewStatus !== 'REJECTED';
  // v1.5 Frank 28 反馈：仅 UNCERTAIN 旁路才显示运营复核按钮
  //  - 正常 2 步：志愿 APPROVE 任务已完成，运营无需复核
  //  - 正常 2 步：志愿 REJECT 任务回退到 step1，运营无需复核
  //  - UNCERTAIN 旁路：等运营介入，可以 APPROVE/REJECT
  const canOperatorReview =
    isAdminOp && show3Step && step1Done
    && task.reviewStatus === 'UNCERTAIN'
    && task.operatorReviewStatus !== 'APPROVED'
    && task.operatorReviewStatus !== 'REJECTED';

  // v16.8 Frank 9:04 反馈：图片上传（v1 简化版：上传后把 URL 追加到对应 Form 字段）
  const handleUploadImage = async (file: File, fieldName: string): Promise<boolean> => {
    try {
      const result = await uploadApi.image(file);
      const current = submitForm.getFieldValue(fieldName) || '';
      const newValue = current ? `${current}\n${result.url}` : result.url;
      submitForm.setFieldsValue({ [fieldName]: newValue });
      message.success('图片已上传');
      return true;
    } catch (e: any) {
      message.error(e?.response?.data?.message || '上传失败');
      return false;
    }
  };

  // v16.6 Frank 16:04 文字反馈：双方确认（无 Modal，直接调 submit）
  // proofType=confirm 走这条路径
  const handleConfirm = async () => {
    setConfirmSubmitting(true);
    try {
      await stageApi.submit(task.taskId, { remark: '双方确认' });
      message.success('已确认');
      await onRefresh();
    } catch { /* 拦截器已处理 */ }
    finally { setConfirmSubmitting(false); }
  };

  // v16.7 Frank 16:44 反馈：volunteer-first 流程 → 志愿者 step1
  // 志愿者先完成（写 organizerSubmittedAt + 标记 step1Done）
  const handleVolunteerSubmit = async () => {
    setConfirmSubmitting(true);
    try {
      await stageApi.submit(task.taskId, { remark: '志愿者完成' });
      message.success('已提交，等待组织者确认');
      await onRefresh();
    } catch { /* 拦截器已处理 */ }
    finally { setConfirmSubmitting(false); }
  };

  // v16.7 Frank 16:44 反馈：volunteer-first 流程 → 组织者 step2
  // 组织者确认结果（写 reviewStatus=APPROVED + organizerConfirmedAt）
  const handleOrganizerConfirm = async () => {
    setConfirmSubmitting(true);
    try {
      await stageApi.organizerConfirm(task.taskId, { action: 'APPROVE' });
      message.success('组织者已确认通过');
      await onRefresh();
    } catch { /* 拦截器已处理 */ }
    finally { setConfirmSubmitting(false); }
  };

  // v16.6 Frank 16:04 Comment 4：双方最终确认 = 填空表单（日期/时间/地点/规模/活动方案）
  // proofType=form 走这条路径
  const handleFormSubmit = async () => {
    const v = await formForm.validateFields();
    setFormSubmitting(true);
    try {
      // 5 字段序列化到 remark（JSON 字符串）+ planUrl 单独存 proofFile
      const formJson = JSON.stringify({
        date: v.date ? (v.date as any).format('YYYY-MM-DD') : '',
        timeRange: v.timeRange && v.timeRange.length === 2
          ? `${(v.timeRange[0] as any).format('HH:mm')}-${(v.timeRange[1] as any).format('HH:mm')}`
          : '',
        location: v.location || '',
        scale: v.scale || 0,
        planUrl: v.planUrl || '',
      });
      await stageApi.submit(task.taskId, { remark: formJson, proofFile: v.planUrl });
      message.success('活动方案已填写，等待志愿者审核');
      setFormOpen(false);
      formForm.resetFields();
      await onRefresh();
    } catch { /* 拦截器已处理 */ }
    finally { setFormSubmitting(false); }
  };

  const handleSubmit = async () => {
    const v = await submitForm.validateFields();
    setSubmitting(true);
    try {
      // v16.8 Frank 22:16 反馈 Comment 1：按 credSpec.proofCategories 合并分类
      let proofFileValue = v.proofFile;
      if (credSpec?.proofCategories && credSpec.proofCategories.length > 0) {
        const categorized: Record<string, string> = {};
        for (const cat of credSpec.proofCategories) {
          const val = v[`proofFile_${cat}`];
          if (val && String(val).trim()) categorized[cat] = String(val).trim();
        }
        proofFileValue = JSON.stringify(categorized);
      }
      await stageApi.submit(task.taskId, { proofFile: proofFileValue, remark: v.remark });
      message.success('已自核提交');
      setSubmitOpen(false);
      submitForm.resetFields();
      await onRefresh();
    } catch { /* 拦截器已处理 */ }
    finally { setSubmitting(false); }
  };

  // Frank 2026-08-23 09:17 反馈：加 UNCERTAIN（无法判断）action
  const handleReview = async (action: 'APPROVE' | 'REJECT' | 'UNCERTAIN') => {
    const v = await reviewForm.validateFields();
    if ((action === 'REJECT' || action === 'UNCERTAIN') && !v.reviewRemark) {
      message.error('打回/无法判断需填写原因');
      return;
    }
    setReviewing(true);
    try {
      await stageApi.review(task.taskId, { action, reviewRemark: v.reviewRemark });
      message.success(
        action === 'APPROVE' ? '审核通过' :
        action === 'REJECT' ? '已打回' :
        '已请求运营介入'
      );
      setReviewOpen(false);
      reviewForm.resetFields();
      await onRefresh();
    } catch { /* 拦截器已处理 */ }
    finally { setReviewing(false); }
  };

  const handleOpReview = async (action: 'APPROVE' | 'REJECT') => {
    const v = await opReviewForm.validateFields();
    if (action === 'REJECT' && !v.operatorReviewRemark) {
      message.error('打回需填写原因');
      return;
    }
    setOpReviewing(true);
    try {
      await stageApi.operatorReview(task.taskId, { action, operatorReviewRemark: v.operatorReviewRemark });
      message.success(action === 'APPROVE' ? '运营复核通过' : '运营已打回');
      setOpReviewOpen(false);
      opReviewForm.resetFields();
      await onRefresh();
    } catch { /* 拦截器已处理 */ }
    finally { setOpReviewing(false); }
  };

  // v15 ownerType 配置（同行 + 字号大 + 圆角胶囊）
  const ownerTypeConfig = {
    ORGANIZER: { color: '#10B981', bg: '#ECFDF5', label: '组织者', icon: '🟢' },
    VOLUNTEER: { color: '#3B82F6', bg: '#EFF6FF', label: '志愿者', icon: '🔵' },
    OPERATOR:   { color: '#F59E0B', bg: '#FFFBEB', label: '运营',   icon: '🟠' },
  };
  const ownerConf = ownerTypeConfig[ownerTypeStr as keyof typeof ownerTypeConfig] ?? ownerTypeConfig.ORGANIZER;

  // v15.1 Comment 2：3 步进度圆圈（精简版，按角色高亮自己）
  const stepCircle = (idx: number, label: string, done: boolean, rejected: boolean, ready: boolean) => {
    let bg = '#E5E7EB', color = '#9CA3AF', icon = String(idx);
    if (done) { bg = '#10B981'; color = '#fff'; icon = '✓'; }
    else if (rejected) { bg = '#EF4444'; color = '#fff'; icon = '✗'; }
    else if (ready) { bg = '#3370FF'; color = '#fff'; icon = String(idx); }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 14, background: bg, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
          boxShadow: ready ? '0 0 0 3px rgba(51,112,255,0.15)' : 'none',
        }}>{icon}</div>
        <div style={{ fontSize: 12, color: done ? '#10B981' : rejected ? '#EF4444' : ready ? '#3370FF' : '#9CA3AF', fontWeight: 600 }}>
          {label}
        </div>
      </div>
    );
  };

  // v16.5 Frank 14:04 反馈：状态机太乱 → 简化为 3 种统一状态文案
  // 16.5 凭证规范引用（v16.7 Frank 16:44：先声明 credSpec，simpleStatus 依赖它）
  const credSpec = findCredentialSpec(task.subTaskName ?? task.title);
  // v1.3 Frank 27 23:50 TDD 迭代：按钮按 ownerType + subTaskName 双重判断（不引 proofType 字段）
  const buttonType = getButtonType(task.subTaskName ?? task.title, ownerTypeStr);

  // v16.7 Frank 16:44 反馈：volunteer-first 流程 → 状态文案分两套
  //   · 默认（confirm/image/mixed/form/未设）：待组织者上传 → 待志愿者审核 → 已完成
  //   · volunteer-first：待志愿者完成 → 待组织者确认 → 已完成
  // v16.7 Frank 21:19 反馈：REJECT/UNCERTAIN 持久化（不丢失）
  //   · REJECTED：后端已重置 organizerSubmittedAt → step1Done=false → 按钮重新显示 "待组织者上传"
  //   · UNCERTAIN：保留 organizerSubmittedAt → step1Done=true → 显示"已请求运营介入"
  // v16.8 Frank 22:16 反馈：运营打回状态（operatorReviewStatus=REJECTED）
  const simpleStatus = (() => {
    const isVolunteerFirst = isVolunteerFirstSubTask(ownerTypeStr);
    if (!step1Done) {
      return isVolunteerFirst
        ? { color: '#6B7280', bg: '#F3F4F6', label: '待志愿者完成' }
        : { color: '#6B7280', bg: '#F3F4F6', label: '待组织者上传' };
    }
    // v16.8：运营打回优先级最高（即使是 volunteer-first 也显示这个）
    if (task.operatorReviewStatus === 'REJECTED') {
      return { color: '#EF4444', bg: '#FEE2E2', label: '运营已打回' };
    }
    if (step2Done) return { color: '#10B981', bg: '#D1FAE5', label: '已完成' };
    // v16.7 Frank 21:19 反馈：UNCERTAIN 持久化显示
    if (task.reviewStatus === 'UNCERTAIN') {
      return { color: '#F59E0B', bg: '#FEF3C7', label: '已请求运营介入' };
    }
    return isVolunteerFirst
      ? { color: '#F59E0B', bg: '#FEF3C7', label: '待组织者确认' }
      : { color: '#F59E0B', bg: '#FEF3C7', label: '待志愿者审核' };
  })();

  return (
    <Card
      bodyStyle={{ padding: 14 }}
      style={{ background: '#FFFFFF', borderRadius: 10 }}
      // v16.8 Frank 23:03 反馈：站内信跳转定位（用 data-task-id 做 scroll target）
      data-task-id={task.taskId}
    >
      {/* 标题行：圆形编号 + 子任务名 + 按钮（同行右侧）+ ownerType tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 16, background: '#3370FF', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, flexShrink: 0,
        }}>{task.order ?? '?'}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Text strong style={{ fontSize: 15, lineHeight: 1.4 }}>
            {task.subTaskName ?? task.title}
          </Text>
        </div>
        {/* 按钮（按角色 + v1.3 buttonType 字符串匹配） */}
        {/* v1.3 Frank 27 23:50 TDD 迭代：buttonType 不引 proofType 字段，按 subTaskName 匹配
            · confirm / form / mixed / image → 1 个按钮
            · volunteer-first → 2 个按钮（志愿者 step1 + 组织者 step2） */}
        {buttonType === 'volunteer-first' && !step1Done && (
          /* step1：志愿者自核（v1.2 Frank 27 21:40：VOLUNTEER 必须是 appVolunteerId；ADMIN 全管） */
          (role === 'ADMIN' || (role === 'VOLUNTEER' && isAppVolunteer)) && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined style={{ fontSize: 14 }} />}
              onClick={handleVolunteerSubmit}
              loading={confirmSubmitting}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              ✓ 我已确认（志愿者）
            </Button>
          )
        )}
        {buttonType === 'volunteer-first' && step1Done && !step2Done && (
          /* step2：组织者确认（v1.2 Frank 27 21:40：ADMIN 全管；ORGANIZER/ASSISTANT 必须是 appUserId） */
          (isAdminOp || ((role === 'ORGANIZER' || role === 'ASSISTANT') && isAppOrganizer)) && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined style={{ fontSize: 14 }} />}
              onClick={handleOrganizerConfirm}
              loading={confirmSubmitting}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              ✓ 我已确认（组织者）
            </Button>
          )
        )}
        {canOrganizerSubmit && !step1Done && buttonType !== 'volunteer-first' && (
          <>
            {/* v1.3 按钮按 buttonType 区分（不引 proofType 字段） */}
            {buttonType === 'confirm' && (
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined style={{ fontSize: 14 }} />}
                onClick={handleConfirm}
                loading={confirmSubmitting}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                ✓ 我已确认
              </Button>
            )}
            {buttonType === 'form' && (
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined style={{ fontSize: 14 }} />}
                onClick={() => setFormOpen(true)}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                📝 填写活动方案
              </Button>
            )}
            {(buttonType === 'image' || buttonType === 'mixed') && (
              <Button
                type="primary"
                size="small"
                icon={<CloudUploadOutlined style={{ fontSize: 14 }} />}
                onClick={() => setSubmitOpen(true)}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                📎 上传凭证 + 自核
              </Button>
            )}
          </>
        )}
        {canVolunteerReview && buttonType !== 'volunteer-first' && (
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined style={{ fontSize: 14 }} />}
            onClick={() => setReviewOpen(true)}
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            志愿者审核
          </Button>
        )}
        {canOperatorReview && !step3Done && buttonType !== 'volunteer-first' && (
          <Button
            type="primary"
            ghost
            size="small"
            icon={<CheckCircleOutlined style={{ fontSize: 14 }} />}
            onClick={() => setOpReviewOpen(true)}
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            运营复核
          </Button>
        )}
        {/* v16.5 Frank 14:04 反馈：简化为 3 种状态文案（去掉 ownerType 身份 + 删 v16.3 复杂状态徽章） */}
        <div style={{
          background: simpleStatus.bg, color: simpleStatus.color,
          padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {simpleStatus.label}
        </div>
      </div>

      {/* v16.7 Frank 21:19 反馈：REJECT 时显示打回原因（持久化，刷新不丢失）*/}
      {task.reviewStatus === 'REJECTED' && task.reviewRemark && (
        <div style={{ marginBottom: 8, fontSize: 12, background: '#FEE2E2', color: '#991B1B', padding: '6px 10px', borderRadius: 6, border: '1px solid #FCA5A5' }}>
          ✗ 志愿者打回原因：{task.reviewRemark}
        </div>
      )}
      {/* v16.8 Frank 22:16 反馈：运营打回原因（持久化，刷新不丢失）*/}
      {task.operatorReviewStatus === 'REJECTED' && task.operatorReviewRemark && (
        <div style={{ marginBottom: 8, fontSize: 12, background: '#FEE2E2', color: '#991B1B', padding: '6px 10px', borderRadius: 6, border: '1px solid #FCA5A5' }}>
          ✗ 运营打回原因：{task.operatorReviewRemark}
        </div>
      )}
      {/* v16.7 Frank 21:19 反馈：UNCERTAIN 时显示无法判断原因（持久化）*/}
      {task.reviewStatus === 'UNCERTAIN' && task.reviewRemark && (
        <div style={{ marginBottom: 8, fontSize: 12, background: '#FEF3C7', color: '#92400E', padding: '6px 10px', borderRadius: 6, border: '1px solid #FCD34D' }}>
          ? 志愿者无法判断原因：{task.reviewRemark}（已请求运营介入）
        </div>
      )}

      {/* 凭证链接（如果有）· v16.7 Frank 21:19 Comment 1：多文件 + v16.8 Frank 22:16 分类显示 */}
      {task.proofFile && (() => {
        // 尝试解析 JSON 分类格式
        let categorized: Record<string, string> | null = null;
        try {
          const parsed = JSON.parse(task.proofFile);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            categorized = parsed;
          }
        } catch { /* 不是 JSON，按行分隔处理 */ }

        if (categorized) {
          // 分类显示
          return (
            <div style={{ marginBottom: 8, fontSize: 12 }}>
              <div style={{ color: '#6B7280', marginBottom: 4 }}>📎 凭证（分类）：</div>
              {Object.entries(categorized).map(([cat, urls]) => {
                const lines = String(urls).split('\n').map((s) => s.trim()).filter(Boolean);
                if (lines.length === 0) return null;
                return (
                  <div key={cat} style={{ marginLeft: 12, marginBottom: 6 }}>
                    <div style={{ color: '#374151', fontWeight: 600, marginBottom: 2 }}>{cat}（{lines.length} 项）：</div>
                    {lines.map((url, i) => (
                      <div key={i} style={{ marginLeft: 16, marginBottom: 1 }}>
                        {i + 1}. <a href={url} target="_blank" rel="noopener noreferrer">{url.length > 60 ? url.slice(0, 60) + '...' : url}</a>
                      </div>
                    ))}
                  </div>
                );
              })}
              {task.organizerSubmittedAt && (
                <div style={{ color: '#999', marginTop: 4, fontSize: 11 }}>
                  上传时间：{new Date(task.organizerSubmittedAt).toLocaleString('zh-CN')}
                </div>
              )}
            </div>
          );
        }

        // 普通多行（每行 1 个 URL）
        const lines = task.proofFile.split('\n').map((s) => s.trim()).filter(Boolean);
        return (
          <div style={{ marginBottom: 8, fontSize: 12 }}>
            <div style={{ color: '#6B7280', marginBottom: 4 }}>
              📎 凭证（{lines.length} 项）：
            </div>
            {lines.map((url, i) => (
              <div key={i} style={{ marginLeft: 16, marginBottom: 2 }}>
                {i + 1}. <a href={url} target="_blank" rel="noopener noreferrer">{url.length > 60 ? url.slice(0, 60) + '...' : url}</a>
              </div>
            ))}
            {task.organizerSubmittedAt && (
              <div style={{ color: '#999', marginTop: 4, fontSize: 11 }}>
                上传时间：{new Date(task.organizerSubmittedAt).toLocaleString('zh-CN')}
              </div>
            )}
          </div>
        );
      })()}

      {/* v16.1 Frank 08:32 反馈：凭证规范块（"📋 需要做什么" + "✅ 通过标准"）— 核心信息 */}
      {credSpec && (
        <div style={{ marginTop: 8 }}>
          {/* 📋 需要做什么 */}
          <div style={{ marginBottom: 6, fontSize: 13, lineHeight: 1.7 }}>
            <Text strong style={{ color: '#3370FF' }}>📋 需要做什么：</Text>
            <ol style={{ margin: '4px 0 0 0', paddingLeft: 20, color: '#374151' }}>
              {credSpec.whatToDo.map((step, i) => (
                <li key={i}>{renderTextWithLinks(step)}</li>
              ))}
            </ol>
          </div>
          {/* ✅ 通过标准 */}
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <Text strong style={{ color: '#10B981' }}>✅ 通过标准：</Text>
            <ol style={{ margin: '4px 0 0 0', paddingLeft: 20, color: '#374151' }}>
              {credSpec.passCriteria.map((c, i) => (
                <li key={i}>{renderTextWithLinks(c)}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* v16.5 Frank 14:04 反馈：删 v16.3 状态行 + 操作历史（太多冗余元素） */}

      {/* v16.6 Frank 16:04 Comment 4：双方最终确认填表格单（日期/时间/地点/规模/活动方案） */}
      <Modal
        title={`填写活动方案 · ${task.subTaskName ?? task.title}`}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleFormSubmit}
        confirmLoading={formSubmitting}
        okText="✓ 提交方案"
        cancelText="取消"
        width={560}
      >
        <Form form={formForm} layout="vertical">
          <Form.Item
            name="date"
            label="活动日期（必填，精确到日）"
            rules={[{ required: true, message: '请选择活动日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="如：2026-10-16" />
          </Form.Item>
          <Form.Item
            name="timeRange"
            label="时间区间（选填，几点到几点）"
          >
            <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} placeholder={['开始', '结束']} />
          </Form.Item>
          <Form.Item
            name="location"
            label="活动地点（必填，精确到商圈/学校/场地）"
            rules={[{ required: true, message: '请填写活动地点' }, { max: 200, message: '不超过 200 字' }]}
          >
            <Input placeholder="如：上海交大闵行校区 学术活动中心 3F-301" />
          </Form.Item>
          <Form.Item
            name="scale"
            label="预计规模（必填，不超过 80 人）"
            rules={[
              { required: true, message: '请填写预计规模' },
              { type: 'number', min: 1, max: 80, message: '规模在 1-80 人之间' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} max={80} placeholder="建议 30-50 人" />
          </Form.Item>
          <Form.Item
            name="planUrl"
            label="活动方案飞书链接（必填）"
            rules={[{ required: true, type: 'url', message: '请填写合法飞书链接' }]}
          >
            <Input placeholder="https://datawhaler.feishu.cn/wiki/..." size="large" />
          </Form.Item>
          <div style={{ background: '#F0F7FF', padding: '8px 12px', borderRadius: 6, fontSize: 13, color: '#3370FF' }}>
            💡 提示：提交后会自动同步到飞书 base 活动表，等待志愿者审核。
          </div>
        </Form>
      </Modal>

      {/* 组织者自核 Modal */}
      <Modal
        title={`上传凭证 + 自核 · ${task.subTaskName ?? task.title}`}
        open={submitOpen}
        onCancel={() => setSubmitOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="✓ 确认提交（打勾）"
        cancelText="取消"
        width={520}
      >
        <Form form={submitForm} layout="vertical">
          {/* v16.8 Frank 22:16 反馈 Comment 1：按 credSpec.proofCategories 动态渲染分类 Form.Item */}
          {credSpec?.proofCategories && credSpec.proofCategories.length > 0 ? (
            credSpec.proofCategories.map((cat) => (
              <div key={cat}>
                <Form.Item
                  name={`proofFile_${cat}`}
                  label={cat}
                  tooltip="每行 1 个 URL（飞书文档/网盘/截图）。点击下方「上传图片」按钮可粘贴/拖拽图片"
                  rules={[
                    {
                      validator: async (_, v) => {
                        if (!v) return Promise.resolve();
                        const lines = String(v).split('\n').map((s: string) => s.trim()).filter(Boolean);
                        for (const line of lines) {
                          // v16.9 Frank 13:10：URL 验证接受完整 URL（http/https）或本地相对路径（/uploads/）
                          if (!/^(https?:\/\/|\/uploads\/)/.test(line)) {
                            return Promise.reject(new Error(`URL 格式错误：${line.slice(0, 50)}`));
                          }
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={3}
                    maxLength={2000}
                    showCount
                    placeholder="https://example.com/file1.png&#10;https://example.com/file2.png"
                  />
                </Form.Item>
                {/* v16.8 Frank 9:04 反馈：图片上传（customRequest 调后端，URL 追加到字段） */}
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    await handleUploadImage(file, `proofFile_${cat}`);
                    return false;  // 阻止 antd 默认上传
                  }}
                >
                  <Button size="small" icon={<CloudUploadOutlined />}>📎 上传图片（粘贴/拖拽）</Button>
                </Upload>
              </div>
            ))
          ) : (
            <div>
              <Form.Item
                name="proofFile"
                label="凭证 URL（支持多文件，每行一个 URL）"
                tooltip="支持多文件：每行一个 URL（飞书文档/网盘/截图）。点击下方「上传图片」按钮可粘贴/拖拽图片"
                rules={[
                  { required: true, message: '请至少填写 1 个 URL' },
                  {
                    validator: async (_, v) => {
                      if (!v) return Promise.resolve();
                      const lines = String(v).split('\n').map((s) => s.trim()).filter(Boolean);
                      for (const line of lines) {
                        // v16.9 Frank 13:10：URL 验证接受完整 URL（http/https）或本地相对路径（/uploads/）
                        if (!/^(https?:\/\/|\/uploads\/)/.test(line)) {
                          return Promise.reject(new Error(`URL 格式错误：${line.slice(0, 50)}`));
                        }
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input.TextArea
                  rows={5}
                  maxLength={5000}
                  showCount
                  placeholder="https://example.com/file1.png&#10;https://example.com/file2.png&#10;https://example.com/file3.png"
                />
              </Form.Item>
              {/* v16.8 Frank 9:04 反馈：图片上传（customRequest 调后端，URL 追加到字段） */}
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={async (file) => {
                  await handleUploadImage(file, 'proofFile');
                  return false;  // 阻止 antd 默认上传
                }}
              >
                <Button size="small" icon={<CloudUploadOutlined />}>📎 上传图片（粘贴/拖拽）</Button>
              </Upload>
            </div>
          )}
          <Form.Item name="remark" label="备注" rules={[{ max: 500 }]}>
            <Input.TextArea rows={3} maxLength={500} showCount placeholder="如：已读完行动指南，无异议" />
          </Form.Item>
          <div style={{ background: '#F0F7FF', padding: '8px 12px', borderRadius: 6, fontSize: 13, color: '#3370FF' }}>
            💡 提示：提交即完成"组织者自核"打勾，下一步自动通知志愿者审核。
          </div>
        </Form>
      </Modal>

      {/* 志愿者审核 Modal — Frank 09:17 反馈加 UNCERTAIN（无法判断）按钮 */}
      <Modal
        title={`志愿者审核 · ${task.subTaskName ?? task.title}`}
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        footer={[
          <Button key="reject" danger size="middle" onClick={() => handleReview('REJECT')} loading={reviewing}>
            ✗ 打回评论
          </Button>,
          <Button key="uncertain" size="middle" onClick={() => handleReview('UNCERTAIN')} loading={reviewing}>
            ? 无法判断（请求运营介入）
          </Button>,
          <Button key="approve" type="primary" size="middle" onClick={() => handleReview('APPROVE')} loading={reviewing}>
            ✓ 审核通过
          </Button>,
        ]}
        width={520}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="reviewRemark" label="审核意见（REJECT/UNCERTAIN 时必填）" rules={[{ max: 500 }]}>
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="如：证据充分/证据不足需补充..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 运营复核 Modal */}
      <Modal
        title={`运营复核 · ${task.subTaskName ?? task.title}`}
        open={opReviewOpen}
        onCancel={() => setOpReviewOpen(false)}
        footer={[
          <Button key="reject" danger size="middle" onClick={() => handleOpReview('REJECT')} loading={opReviewing}>
            ✗ 打回评论
          </Button>,
          <Button key="approve" type="primary" size="middle" onClick={() => handleOpReview('APPROVE')} loading={opReviewing}>
            ✓ 复核通过
          </Button>,
        ]}
        width={520}
      >
        <Form form={opReviewForm} layout="vertical">
          <Form.Item name="operatorReviewRemark" label="复核意见（REJECT 时必填）" rules={[{ max: 500 }]}>
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="如：合规通过/不合规需重新提交..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
