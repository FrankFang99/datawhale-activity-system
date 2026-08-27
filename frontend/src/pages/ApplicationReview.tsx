/**
 * 申请详情页（v17 · Frank 2026-08-27 16:22 反馈）
 *
 * 用途：所有角色可查看任意申请详情
 * - 申请者：看自己提交的申请（含 AI 评分 / 审核日志）
 * - 志愿者：看他所对接的申请（审批前/审核后都能看）
 * - 运营/管理员：所有申请
 *
 * v17 修订（Frank 27 16:22 反馈 Comment 1-3）：
 * - Comment 1：基础信息 Card「活动 ID」改成「活动名」（后端从 dw_activities 取 title）
 * - Comment 2：申请原文 tab 加「预期日期」行（expectedTimeRange 字符串按「,」拆 Tag 展示，多日期占多行）
 * - Comment 3：「预期日期/场地状态/招募渠道」从基础信息 Card 挪到申请原文 tab
 * - AI 评分 tab v2 7 维 → v3 6 维（删 RC001 基础信息）
 * - 6 维：场地 RC001(20) / 招募 RC002(10) / 经验 RC003(25) / 时间 RC004(15) / 动机 RC005(15) / 价值 RC006(15)
 *
 * v16 修订（Frank 27 15:58 反馈 Comment 4）：
 * - AI 评分 tab 从 v1 5 个 sub-tab 改成 v2 7 维 Card 网格
 * - 引擎版本：v2
 *
 * v15 修订（Frank 27 15:58 反馈 Comment 1-3）：
 * - Comment 1：删申请原文 tab 里的「合作资源」栏
 * - Comment 2：删顶部「该申请存在风险项」Alert 整块
 * - Comment 3：基础信息 Card 加 title="基本信息"
 *
 * v14 修订（Frank 19:46 反馈 Comment 1）：
 * - 后端 GET /api/applications/:id 已扩展返回飞书 base 全部 14+ 字段
 * - 删 v13 顶部"在飞书中查看完整记录"跳转按钮
 * - 删顶部"本页面展示申请摘要"Alert
 * - 志愿者/运营完整可见联系信息
 *
 * 路由：/applications/:id
 * 接口：GET /api/applications/:id
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Spin, Tag, Descriptions, Tabs, Button, Space, Typography, Result, Empty, message, Tooltip, Row, Col,
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

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="申请编号">{data.applicationNo}</Descriptions.Item>
          <Descriptions.Item label="申请人">{data.organizerName}</Descriptions.Item>
          <Descriptions.Item label="联系手机">{data.organizerPhone || '—'}</Descriptions.Item>
          <Descriptions.Item label="联系邮箱">{data.organizerEmail || '—'}</Descriptions.Item>
          {/* Frank 27 16:22 反馈 Comment 1：给用户看的别显示 ID，直接显示活动名 */}
          <Descriptions.Item label="活动名" span={2}>
            {data.activityTitle || <Text type="secondary">{data.activityId}（活动名加载中）</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="角色">
            {data.applicantRole === 'PRIMARY' ? '主组织者' : data.applicantRole === 'ASSISTANT' ? '助教' : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="活动地点">{data.location || '—'}</Descriptions.Item>
          {/* Frank 27 16:22 反馈 Comment 3：预期日期/场地状态/招募渠道 挪到申请原文 tab */}
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
                  {/* Frank 27 16:22 反馈 Comment 3：预期日期挪到这里（多日期可能很多，给够空间） */}
                  <Descriptions.Item label="预期日期">
                    {data.expectedTimeRange ? (
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        {data.expectedTimeRange.split(',').map((d) => d.trim()).filter(Boolean).map((d) => (
                          <Tag key={d} color="blue">{d}</Tag>
                        ))}
                      </Space>
                    ) : data.expectedDate ? (
                      new Date(data.expectedDate).toLocaleDateString('zh-CN')
                    ) : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="场地状态">
                    {data.venueStatus ? (
                      <Tag color={data.venueStatus === '已确定' ? 'green' : 'gold'}>{data.venueStatus}</Tag>
                    ) : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="招募渠道">
                    {(() => {
                      const channels = data.recruitChannel ?? [];
                      if (channels.length === 0) return '—';
                      return (
                        <Space wrap size={4}>
                          {channels.map((ch) => (
                            <Tag key={ch} color="blue">{ch}</Tag>
                          ))}
                        </Space>
                      );
                    })()}
                  </Descriptions.Item>
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
                <div>
                  <Row gutter={[12, 12]}>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="场地"   code="RC001" data={data.scoreBreakdown.RC001} max={20} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="招募"   code="RC002" data={data.scoreBreakdown.RC002} max={10} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="经验"   code="RC003" data={data.scoreBreakdown.RC003} max={25} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="时间"   code="RC004" data={data.scoreBreakdown.RC004} max={15} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="申请动机" code="RC005" data={data.scoreBreakdown.RC005} max={15} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="参与者价值" code="RC006" data={data.scoreBreakdown.RC006} max={15} /></Col>
                  </Row>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
                    引擎版本：{data.scoreBreakdown.engineVersion ?? 'v1'}
                    （v3 6 维：场地/招募/经验/时间/动机/价值）
                  </div>
                </div>
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

// Frank 27 15:58 Comment 4：v2 7 维评分用 ScoreCard（label/code/score/max/reason），
// 在 AI 评分 tab 里以 7 个 Card 网格展示，比 7 个 sub-tab 更易读
function ScoreCard({ label, code, data, max }: { label: string; code: string; data: any; max: number }) {
  if (!data) return <Card size="small" title={`${label} (${code})`}><Text type="secondary">无数据</Text></Card>;
  const score = data.score ?? 0;
  const reason = data.reason ?? '—';
  const percent = max > 0 ? (score / max) * 100 : 0;
  return (
    <Card size="small" title={`${label} (${code})`} bodyStyle={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 20, color: '#3370FF' }}>{score}</Text>
        <Text type="secondary"> / {max}</Text>
      </div>
      <div
        style={{
          height: 6,
          background: '#F0F0F0',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 8,
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
      <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>{reason}</Text>
    </Card>
  );
}
