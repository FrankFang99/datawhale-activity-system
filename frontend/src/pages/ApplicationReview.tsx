/**
 * 申请详情页（v15 · Frank 2026-08-27 15:58 反馈）
 *
 * 用途：所有角色可查看任意申请详情
 * - 申请者：看自己提交的申请（含 AI 评分 / 审核日志）
 * - 志愿者：看他所对接的申请（审批前/审核后都能看）
 * - 运营/管理员：所有申请
 *
 * v15 修订（Frank 27 15:58 反馈 Comment 1-3）：
 * - Comment 1：删申请原文 tab 里的「合作资源」栏（申请问卷无此字段，Descriptions 上方已有「招募渠道」Tags）
 * - Comment 2：删顶部「该申请存在风险项」Alert 整块（不显示风险）
 * - Comment 3：基础信息 Card 加 title="基本信息"
 *
 * v14 修订（Frank 19:46 反馈 Comment 1）：
 * - 后端 GET /api/applications/:id 已扩展返回飞书 base 全部 14+ 字段
 * - 删 v13 顶部"在飞书中查看完整记录"跳转按钮（Frank 否决跳转方案）
 * - 删顶部"本页面展示申请摘要"Alert（因为现在就是完整数据）
 * - 志愿者/运营完整可见联系信息（志愿者需要联系申请者）
 *
 * 路由：/applications/:id
 * 接口：GET /api/applications/:id
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Spin, Tag, Descriptions, Tabs, Button, Space, Typography, Result, Empty, message, Tooltip,
} from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { applicationApi } from '../services/api';

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

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="申请编号">{data.applicationNo}</Descriptions.Item>
          <Descriptions.Item label="申请人">{data.organizerName}</Descriptions.Item>
          <Descriptions.Item label="联系手机">{data.organizerPhone || '—'}</Descriptions.Item>
          <Descriptions.Item label="联系邮箱">{data.organizerEmail || '—'}</Descriptions.Item>
          <Descriptions.Item label="活动 ID"><Text code>{data.activityId}</Text></Descriptions.Item>
          <Descriptions.Item label="角色">
            {data.applicantRole === 'PRIMARY' ? '主组织者' : data.applicantRole === 'ASSISTANT' ? '助教' : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="预期日期">
            {data.expectedDate ? new Date(data.expectedDate).toLocaleDateString('zh-CN') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="活动地点">{data.location || '—'}</Descriptions.Item>
          <Descriptions.Item label="场地状态" span={2}>
            {data.venueStatus && (
              <Tag color={data.venueStatus === '已确定' ? 'green' : 'gold'}>{data.venueStatus}</Tag>
            )}
            {!data.venueStatus && '—'}
          </Descriptions.Item>
          <Descriptions.Item label="招募渠道" span={2}>
            {(data.recruitChannel ?? []).map((ch) => (
              <Tag key={ch} color="blue">{ch}</Tag>
            ))}
            {(!data.recruitChannel || data.recruitChannel.length === 0) && '—'}
          </Descriptions.Item>
          {data.score != null && (
            <Descriptions.Item label="AI 评分" span={2}>
              <Space>
                <Text strong style={{ color: '#3370FF', fontSize: 18 }}>{data.score}</Text>
                {gradeInfo && <Tag color={gradeInfo.color}>{gradeInfo.label}</Tag>}
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card>
        <Tabs
          defaultActiveKey="original"
          items={[
            {
              key: 'original',
              label: '申请原文',
              children: (
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="申请动机">
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                      {data.motivation || '（未填写）'}
                    </Paragraph>
                  </Descriptions.Item>
                  <Descriptions.Item label="组织经验">
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                      {data.experience || '（未填写）'}
                    </Paragraph>
                  </Descriptions.Item>
                  {/* Frank 27 15:58 Comment 1：删「合作资源」栏（申请问卷里没这个字段；上面 Descriptions 已有「招募渠道」） */}
                  <Descriptions.Item label="参与者价值">
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                      {data.participantValue || '（未填写）'}
                    </Paragraph>
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'ai',
              label: 'AI 评分',
              children: data.scoreBreakdown ? (
                <Tabs
                  items={[
                    { key: 'RC001', label: '场地 (RC001)', children: <DimensionPanel data={data.scoreBreakdown.RC001} max={20} /> },
                    { key: 'RC002', label: '招募 (RC002)', children: <DimensionPanel data={data.scoreBreakdown.RC002} max={20} /> },
                    { key: 'RC003', label: '经验 (RC003)', children: <DimensionPanel data={data.scoreBreakdown.RC003} max={25} /> },
                    { key: 'RC004', label: '时间 (RC004)', children: <DimensionPanel data={data.scoreBreakdown.RC004} max={15} /> },
                    { key: 'RC005', label: '价值 (RC005)', children: <DimensionPanel data={data.scoreBreakdown.RC005} max={20} /> },
                  ]}
                />
              ) : (
                <Empty description="暂无 AI 评分（申请尚未通过初筛或分数未生成）" />
              ),
            },
            {
              key: 'audit',
              label: '审核日志',
              children: data.auditLog && data.auditLog.length > 0 ? (
                <div>
                  {data.auditLog.map((log: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        borderLeft: '3px solid #3370FF',
                        background: '#F5F7FA',
                        marginBottom: 8,
                        borderRadius: 4,
                      }}
                    >
                      <Text strong>{log.action}</Text>
                      {log.fromStatus && (
                        <div style={{ marginTop: 4, fontSize: 12 }}>
                          <Tag>{log.fromStatus}</Tag> → <Tag color="blue">{log.toStatus}</Tag>
                        </div>
                      )}
                      {log.comment && <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>备注：{log.comment}</div>}
                      <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                        {log.at ? new Date(log.at).toLocaleString('zh-CN') : ''}
                        {log.operatorId && ` · ${log.operatorId}`}
                        {log.volunteerName && ` · ${log.volunteerName}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="暂无审核日志" />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

function DimensionPanel({ data, max }: { data: any; max: number }) {
  if (!data) return <Empty description="该维度无评分数据" />;
  const score = data.score ?? 0;
  const reason = data.reason ?? '—';
  const percent = (score / max) * 100;
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 18, color: '#3370FF' }}>{score}</Text>
        <Text type="secondary"> / {max}</Text>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            height: 8,
            background: '#F0F0F0',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: '100%',
              background: percent >= 75 ? '#52c41a' : percent >= 50 ? '#3370FF' : '#faad14',
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 13 }}>{reason}</Text>
      </div>
    </div>
  );
}
