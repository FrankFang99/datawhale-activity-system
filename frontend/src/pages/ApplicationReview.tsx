/**
 * 申请详情页（v18 · Frank 2026-08-27 16:42 反馈）
 *
 * 用途：所有角色可查看任意申请详情
 * - 申请者：看自己提交的申请（含 AI 评分 / 审核日志）
 * - 志愿者：看他所对接的申请（审批前/审核后都能看）
 * - 运营/管理员：所有申请
 *
 * v18 修订（Frank 27 16:42 反馈 Comment 1）：
 * - 抽 ApplicationDetailBody 共享组件（基本信息 Card + 申请原文/AI 评分/审核日志 Tabs）
 * - 审批工作台 Drawer 复用同一组件，跟本详情页对齐
 * - 保留本页面顶部 Tags（状态/AI 评分/角色/志愿者） + 返回按钮 + 标题（与 Drawer 不同）
 *
 * v17 修订（Frank 27 16:22 反馈 Comment 1-3）：
 * - Comment 1：基础信息 Card「活动 ID」改成「活动名」
 * - Comment 2：申请原文 tab 加「预期日期」行
 * - Comment 3：「预期日期/场地状态/招募渠道」从基础信息 Card 挪到申请原文 tab
 * - AI 评分 tab v2 7 维 → v3 6 维
 *
 * v16 修订（Frank 27 15:58 反馈 Comment 4）：
 * - AI 评分 tab 从 v1 5 个 sub-tab 改成 v2 7 维 Card 网格
 *
 * v15 修订（Frank 27 15:58 反馈 Comment 1-3）：
 * - Comment 1：删申请原文 tab 里的「合作资源」栏
 * - Comment 2：删顶部「该申请存在风险项」Alert 整块
 * - Comment 3：基础信息 Card 加 title="基本信息"
 *
 * v14 修订（Frank 19:46 反馈 Comment 1）：
 * - 后端 GET /api/applications/:id 已扩展返回飞书 base 全部 14+ 字段
 *
 * 路由：/applications/:id
 * 接口：GET /api/applications/:id
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Spin, Tag, Button, Space, Typography, Result, Empty, message, Tooltip,
} from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { applicationApi } from '../services/api';
import ApplicationDetailBody from '../components/ApplicationDetailBody';

const { Title, Text, Paragraph } = Typography;

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  DRAFT:              { label: '草稿',     color: 'default' },
  SUBMITTED:          { label: '已提交',   color: 'default' },
  SCREENING:          { label: '待审核',   color: 'gold' },
  CONFIRMED:          { label: '已通过',   color: 'green' },
  PREPARING:          { label: '准备中',   color: 'blue' },
  READY:              { label: '准备就绪', color: 'cyan' },
  RUNNING:            { label: '进行中',   color: 'blue' },
  REVIEWING:          { label: '复盘中',   color: 'purple' },
  REVIEW_CONFIRMED:   { label: '已结案',   color: 'green' },
  COMPLETED:          { label: '已完成',   color: 'green' },
  REJECTED:           { label: '已拒绝',   color: 'red' },
  CANCELLED:          { label: '已取消',   color: 'red' },
  WITHDRAWN:          { label: '已撤回',   color: 'default' },
  WITHDRAWN_AS_ASSISTANT: { label: '转助教', color: 'orange' },
};

const GRADE_DISPLAY: Record<string, { label: string; color: string }> = {
  S: { label: 'S · 优秀', color: 'orange' },
  A: { label: 'A · 良好', color: 'green' },
  B: { label: 'B · 中等', color: 'blue' },
  C: { label: 'C · 待提高', color: 'gold' },
  D: { label: 'D · 不足', color: 'red' },
};

interface ApplicationDetail {
  applicationId: string;
  applicationNo: string;
  activityId: string;
  // Frank 27 16:22 反馈：详情页给用户看活动名而不是 activityId
  activityTitle?: string | null;
  organizerName: string;
  organizerPhone: string;
  organizerEmail: string;
  status: string;
  applicantRole: string;
  score?: number;
  grade?: string;
  scoreBreakdown?: any;
  scoreDetails?: any;
  auditLog?: any[];
  riskFlags?: { motivationShort: boolean; experienceShort: boolean };
  expectedDate?: number;
  // Frank 27 12:50：宽泛时间（多日期用「,」分隔）
  expectedTimeRange?: string;
  location?: string;
  motivation?: string;
  experience?: string;
  resources?: string;
  participantValue?: string;
  venueStatus?: string;
  recruitChannel?: string[];
  volunteerId?: string;
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));
const normField = (v: any): string | undefined => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? undefined : String(v));

export default function ApplicationReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    // v12 Frank 09:17 反馈：所有角色可看（包括 ORGANIZER 自己提交的）
    // applications 路由 /api/applications/:id 已含权限：自己/ADMIN/OPERATOR/VOLUNTEER
    applicationApi.get(id)
      .then((d) => setData(d as ApplicationDetail))
      .catch((e) => {
        const msg = e?.response?.data?.message || e?.message || '加载失败';
        setError(msg);
        message.error(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin style={{ display: 'block', margin: 64 }} />;
  if (error) {
    return (
      <Result
        status="warning"
        title="加载失败"
        subTitle={error}
        extra={
          <Button type="primary" onClick={() => navigate(-1)}>返回</Button>
        }
      />
    );
  }
  if (!data) return <Empty description="未找到该申请" />;

  const statusInfo = STATUS_DISPLAY[normStatus(data.status)] ?? { label: data.status, color: 'default' };
  const gradeInfo = data.grade ? GRADE_DISPLAY[data.grade] : undefined;

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, padding: 0 }}
      >
        返回
      </Button>

      <Title level={3} style={{ marginBottom: 8 }}>申请详情 · {data.applicationNo}</Title>
      <Space wrap style={{ marginBottom: 12 }}>
        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
        {gradeInfo && <Tag color={gradeInfo.color}>{gradeInfo.label}</Tag>}
        {data.applicantRole && (
          <Tag color={data.applicantRole === 'PRIMARY' ? 'green' : 'orange'}>
            {data.applicantRole === 'PRIMARY' ? '主组织者' : '助教'}
          </Tag>
        )}
        {data.volunteerId && (
          <Tooltip title="对接这个申请的志愿者 ID（来自 dw_applications.volunteerId 字段）— 注意：和 5 阶段子任务的 ownerType（打勾权限）是不同概念">
            <Tag color="blue" icon={<InfoCircleOutlined />}>志愿者 {data.volunteerId}</Tag>
          </Tooltip>
        )}
      </Space>
      {/* v14 Frank 19:46 反馈 Comment 1：删 v13 跳转飞书按钮，详情页直接展示完整数据 */}
      {/* Frank 27 15:58 Comment 2：删风险项 Alert（不显示风险） */}
      {/* Frank 27 16:42 Comment 1：抽 ApplicationDetailBody 共享组件，跟审批工作台 Drawer 对齐 */}

      <ApplicationDetailBody data={data} />
    </div>
  );
}
