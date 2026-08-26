import { useEffect, useState } from 'react';
import { Card, Table, Tag, Empty, Spin, Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { applicationApi } from '../services/api';
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

// v9 续 B.1 完整版：申请者角色
const ROLE_MAP: Record<string, { label: string; color: string }> = {
  PRIMARY: { label: '🎯 主组织者', color: 'gold' },
  ASSISTANT: { label: '🤝 助教', color: 'orange' },
};

export default function MyApplications() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    applicationApi
      .mine()
      .then((d) => setList(d.list))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="我的申请"
        subtitle="查看您提交过的所有活动申请"
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
                  // v9 续 B.1 完整版：显示申请者角色（PRIMARY 主组织者 / ASSISTANT 助教）
                  title: '角色',
                  dataIndex: 'applicantRole',
                  key: 'applicantRole',
                  render: (r) => {
                    const m = ROLE_MAP[r] ?? ROLE_MAP.PRIMARY;
                    return <Tag color={m.color}>{m.label}</Tag>;
                  },
                },
                {
                  title: '评分',
                  key: 'score',
                  render: (_, row) => {
                    // v4 修订：SCREENING 状态不展示 AI 评分，待运营/志愿者审核后才显示
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
                    // CONFIRMED / PREPARING / REVIEW_CONFIRMED 状态可查看 5 阶段任务
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
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}
