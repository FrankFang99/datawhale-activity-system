/**
 * 申请详情共享 Body 组件（Frank 27 16:42 反馈 Comment 1）
 *
 * 用途：
 * - /applications/:id（ApplicationReview 详情页）
 * - /admin/approvals Drawer（审批工作台）
 *
 * 内容：
 * - 基本信息 Card（活动名/角色/活动地点/AI 评分）
 * - 申请原文 tab（预期日期多日期 Tags / 场地状态 / 招募渠道 / 申请动机 / 组织经验 / 参与者价值）
 * - AI 评分 tab（v3.1 6 维 Card 网格）
 * - 审核日志 tab
 *
 * 不包含（各页面独有）：
 * - 返回按钮
 * - 顶部状态 Tags
 * - 审批工作台 AI 草拟 / 分配志愿者
 */
import { useState } from 'react';
import { Card, Tag, Descriptions, Tabs, Empty, Typography, Space, Row, Col, Button, Modal, Input, message } from 'antd';
import { InfoCircleOutlined, DislikeOutlined, LikeOutlined } from '@ant-design/icons';
import { adminApi } from '../services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

export interface ApplicationDetailBodyProps {
  data: {
    applicationNo?: string;
    organizerName?: string;
    organizerPhone?: string;
    organizerEmail?: string;
    activityId: string;
    activityTitle?: string | null;
    location?: string;
    applicantRole?: string;
    score?: number | null;
    grade?: string;
    expectedTimeRange?: string | null;
    expectedDate?: number;
    venueStatus?: string;
    recruitChannel?: string[];
    motivation?: string;
    experience?: string;
    resources?: string;
    participantValue?: string;
    scoreBreakdown?: any;
    auditLog?: any[];
    volunteerId?: string;
  };
  // Frank 28 12:18 反馈 Comment 4：传 applicationId 给 AI 评分 👎 按钮用
  applicationId?: string;
}

const GRADE_DISPLAY: Record<string, { label: string; color: string }> = {
  S: { label: 'S · 优秀', color: 'orange' },
  A: { label: 'A · 良好', color: 'green' },
  B: { label: 'B · 中等', color: 'blue' },
  C: { label: 'C · 待提高', color: 'gold' },
  D: { label: 'D · 不足', color: 'red' },
};

// Frank 28 12:18 反馈 Comment 4：AI 评分 👎 按钮 → 写入 dw_chat_logs 作为 badcase，方便后续优化 score engine
function AiFeedbackButton({ applicationId, scoreBreakdown }: { applicationId: string; scoreBreakdown: any }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<'UP' | 'DOWN'>('DOWN');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!comment.trim()) {
      message.warning('请说明理由');
      return;
    }
    setLoading(true);
    try {
      await adminApi.aiFeedback(applicationId, {
        action,
        comment: comment.trim(),
        scoreBreakdown,
      });
      message.success(action === 'DOWN' ? '已记录为 badcase，谢谢反馈' : '已记录点赞');
      setOpen(false);
      setComment('');
    } catch {
      /* 拦截器已处理 */
    } finally {
      setLoading(false);
    }
  };
  return (
    <span>
      <Button
        size="small"
        icon={<DislikeOutlined />}
        onClick={() => { setAction('DOWN'); setOpen(true); }}
        style={{ marginRight: 8 }}
      >
        AI 评分不准
      </Button>
      <Button
        size="small"
        type="text"
        icon={<LikeOutlined />}
        onClick={() => { setAction('UP'); setOpen(true); }}
      >
        准确
      </Button>
      <Modal
        title={action === 'DOWN' ? 'AI 评分 badcase 反馈' : 'AI 评分点赞反馈'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        confirmLoading={loading}
        okText="提交"
        cancelText="取消"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {action === 'DOWN'
            ? '请说明哪里评分不准（如 RC003 经验分太高、RC005 动机没命中关键词等）'
            : '说说哪里评得对，方便记录优秀样例'}
        </Text>
        <TextArea
          rows={4}
          maxLength={500}
          showCount
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="例如：组织经验里写了 3 场但 RC003 才给 8 分，应该更高"
        />
      </Modal>
    </span>
  );
}

export default function ApplicationDetailBody({ data, applicationId }: ApplicationDetailBodyProps) {
  const gradeInfo = data.grade ? GRADE_DISPLAY[data.grade] : undefined;

  return (
    <>
      {/* Frank 27 16:22 反馈 Comment 3：基础信息 Card（活动名 + 角色 + 活动地点 + AI 评分） */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="申请编号">{data.applicationNo || '—'}</Descriptions.Item>
          <Descriptions.Item label="申请人">{data.organizerName || '—'}</Descriptions.Item>
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
                          {channels.map((ch: string) => (
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
                  {/* Frank 27 15:58 Comment 1：删「合作资源」栏（申请问卷里没这个字段） */}
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
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      引擎版本：{data.scoreBreakdown.engineVersion ?? 'v1'}（v3 6 维：场地/招募/经验/时间/动机/价值）
                    </Text>
                    {applicationId && <AiFeedbackButton applicationId={applicationId} scoreBreakdown={data.scoreBreakdown} />}
                  </div>
                  <Row gutter={[12, 12]}>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="场地"   code="RC001" data={data.scoreBreakdown.RC001} max={20} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="招募"   code="RC002" data={data.scoreBreakdown.RC002} max={10} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="经验"   code="RC003" data={data.scoreBreakdown.RC003} max={25} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="时间"   code="RC004" data={data.scoreBreakdown.RC004} max={15} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="申请动机" code="RC005" data={data.scoreBreakdown.RC005} max={15} /></Col>
                    <Col xs={12} sm={8} md={8}><ScoreCard label="参与者价值" code="RC006" data={data.scoreBreakdown.RC006} max={15} /></Col>
                  </Row>
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
    </>
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
      {/* Frank 28 12:18：把命中的关键词列出来（hitKeywords 是 score engine 输出的真实命中词数组） */}
      {Array.isArray(data.hitKeywords) && data.hitKeywords.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #E5E7EB' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>命中关键词：</Text>
          <div style={{ marginTop: 4 }}>
            {data.hitKeywords.map((kw: string, i: number) => (
              <Tag key={i} color="blue" style={{ marginBottom: 2, fontSize: 11 }}>{kw}</Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
