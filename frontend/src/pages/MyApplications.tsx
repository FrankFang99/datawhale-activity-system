import { useEffect, useState } from 'react';
import { Card, Table, Tag, Empty, Spin, Typography, Button, Steps, Timeline, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { applicationApi, stageApi, StageTask } from '../services/api';
import PageHeader from '../components/PageHeader';

const { Text } = Typography;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  SUBMITTED: { label: '已提交', color: 'blue' },
  SCREENING: { label: '审核中', color: 'gold' },
  CONFIRMED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已拒绝', color: 'red' },
  CANCELLED: { label: '已取消', color: 'default' },
};

const GRADE_MAP: Record<string, { label: string; color: string }> = {
  S: { label: 'S · 优质', color: 'gold' },
  A: { label: 'A · 良好', color: 'green' },
  B: { label: 'B · 中等', color: 'blue' },
  C: { label: 'C · 较弱', color: 'orange' },
  D: { label: 'D · 不达标', color: 'red' },
};

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  PRIMARY: { label: '🎯 主组织者', color: 'gold' },
  ASSISTANT: { label: '🤝 助教', color: 'orange' },
};

// Frank 27 14:12 Comment 2：申请进度（5 步可视化）
const PROGRESS_STEPS = [
  { title: '已提交', key: 'SUBMITTED' },
  { title: '审核中', key: 'SCREENING' },
  { title: '已通过', key: 'CONFIRMED' },
  { title: '5 阶段任务', key: 'STAGES' },
  { title: '活动结束', key: 'FINISHED' },
];

function getProgressCurrent(status: string, hasStages: boolean): number {
  if (status === 'DRAFT' || status === 'SUBMITTED' || status === 'REJECTED' || status === 'CANCELLED') {
    return 0;
  }
  if (status === 'SCREENING') return 1;
  if (status === 'CONFIRMED' || status === 'PREPARING' || status === 'REVIEW_CONFIRMED') {
    return hasStages ? 3 : 2;
  }
  if (status === 'FINISHED') return 4;
  return 0;
}

export default function MyApplications() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stageMap, setStageMap] = useState<Record<string, StageTask[]>>({});
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    applicationApi
      .mine()
      .then(async (d) => {
        setList(d.list);
        // 拉取已通过的 stage tasks（用于 5 阶段进度展示）
        const confirmed = d.list.filter((x: any) =>
          ['CONFIRMED', 'PREPARING', 'REVIEW_CONFIRMED'].includes(x.status)
        );
        const m: Record<string, StageTask[]> = {};
        await Promise.all(
          confirmed.map(async (x: any) => {
            try {
              const r = await stageApi.list(x.applicationId);
              m[x.applicationId] = r.list;
            } catch {
              m[x.applicationId] = [];
            }
          })
        );
        setStageMap(m);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="我的申请"
        subtitle="查看您提交过的所有活动申请与进度"
      />
      <Card style={{ marginTop: 16, borderRadius: 16 }}>
        <Spin spinning={loading}>
          {list.length === 0 ? (
            <Empty description="您还没有提交过申请">
              <Button type="primary" onClick={() => navigate('/')}>
                去活动大厅看看
              </Button>
            </Empty>
          ) : (
            <Table
              rowKey="applicationId"
              dataSource={list}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '申请编号', dataIndex: 'applicationNo', key: 'applicationNo' },
                {
                  title: '活动 ID',
                  dataIndex: 'activityId',
                  key: 'activityId',
                  render: (id) => <Text code>{id}</Text>,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s) => <Tag color={STATUS_MAP[s]?.color ?? 'default'}>{STATUS_MAP[s]?.label ?? s}</Tag>,
                },
                {
                  title: '角色',
                  dataIndex: 'applicantRole',
                  key: 'applicantRole',
                  render: (r) => {
                    const m = ROLE_MAP[r] ?? ROLE_MAP.PRIMARY;
                    return <Tag color={m.color}>{m.label}</Tag>;
                  },
                },
                {
                  // Frank 27 14:12 Comment 2：进度可视化
                  title: '申请进度',
                  key: 'progress',
                  width: 280,
                  render: (_, row) => {
                    const hasStages = (stageMap[row.applicationId]?.length ?? 0) > 0;
                    const current = getProgressCurrent(row.status, hasStages);
                    const isFinished = row.status === 'FINISHED';
                    const isRejected = ['REJECTED', 'CANCELLED'].includes(row.status);
                    return (
                      <Steps
                        size="small"
                        current={current}
                        status={isFinished ? 'finish' : isRejected ? 'error' : 'process'}
                        style={{ minWidth: 240 }}
                      >
                        {PROGRESS_STEPS.map((s) => (
                          <Steps.Step key={s.key} title={s.title} />
                        ))}
                      </Steps>
                    );
                  },
                },
                {
                  title: '评分',
                  key: 'score',
                  render: (_, row) => {
                    const isReviewing = ['SCREENING', 'DRAFT', 'SUBMITTED'].includes(row.status);
                    if (isReviewing) {
                      return <Text type="secondary" style={{ fontSize: 12 }}>⏳ 审核中</Text>;
                    }
                    if (row.score == null) {
                      return <Text type="secondary">-</Text>;
                    }
                    return (
                      <span>
                        <strong style={{ color: '#3370FF' }}>{row.score}</strong>
                        {row.grade && (
                          <Tag color={GRADE_MAP[row.grade]?.color} style={{ marginLeft: 8 }}>
                            {row.grade}
                          </Tag>
                        )}
                      </span>
                    );
                  },
                },
                {
                  title: '操作',
                  key: 'actions',
                  render: (_, row) => {
                    if (['CONFIRMED', 'PREPARING', 'REVIEW_CONFIRMED'].includes(row.status)) {
                      return (
                        <Button type="link" onClick={() => navigate(`/applications/${row.applicationId}/tasks`)}>
                          查看进度 →
                        </Button>
                      );
                    }
                    return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
                  },
                },
              ]}
              // Frank 27 14:12 Comment 2：可展开看时间线 + 5 阶段子任务进度
              expandable={{
                expandedRowRender: (row) => {
                  const tasks = stageMap[row.applicationId] ?? [];
                  return (
                    <div style={{ padding: '0 24px' }}>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message={`申请编号 ${row.applicationNo} · 状态 ${STATUS_MAP[row.status]?.label ?? row.status}`}
                        description={
                          row.status === 'SCREENING'
                            ? '⏳ 运营/志愿者正在审核您的申请，预计 1-3 个工作日'
                            : row.status === 'CONFIRMED'
                            ? '🎉 申请已通过！请到活动详情页完成「确认意向」阶段 4 个子任务'
                            : row.status === 'REJECTED'
                            ? '很抱歉，您的申请未通过。详情请查看审批备注。'
                            : ''
                        }
                      />
                      <Timeline
                        items={[
                          { children: <Text>📅 提交时间：{row.submittedAt ? new Date(row.submittedAt).toLocaleString('zh-CN') : '—'}</Text> },
                          ...(row.reviewedAt ? [{ children: <Text>👀 审核时间：{new Date(row.reviewedAt).toLocaleString('zh-CN')}</Text> }] : []),
                        ]}
                      />
                      {tasks.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Text strong>5 阶段子任务进度：</Text>
                          <div style={{ marginTop: 8 }}>
                            {(['INTENT', 'RECRUIT', 'PREPARE', 'EXECUTE', 'REVIEW'] as const).map((stage) => {
                              const stageTasks = tasks.filter((t) => t.stage === stage);
                              const completed = stageTasks.filter((t) => t.status === 'COMPLETED').length;
                              return (
                                <Tag
                                  key={stage}
                                  color={completed === stageTasks.length && stageTasks.length > 0 ? 'green' : completed > 0 ? 'blue' : 'default'}
                                  style={{ margin: 4 }}
                                >
                                  {stage} {completed}/{stageTasks.length}
                                </Tag>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                },
              }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}
