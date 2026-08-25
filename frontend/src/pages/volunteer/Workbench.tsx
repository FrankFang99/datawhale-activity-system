/**
 * 志愿者工作台（PRD §3.2 US-V2 / §4.1.5 v2）— VOLUNTEER 默认工作台
 * 展示"我管理的组织者"申请列表（按当前 volunteerId 过滤）
 */
import { useEffect, useState } from 'react';
import { Card, Table, Tag, Empty, Spin, Typography, Space, Statistic, Row, Col, Button } from 'antd';
import { TeamOutlined, ClockCircleOutlined, CheckCircleOutlined, FireOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { volunteerApi, WorkbenchItem } from '../../services/api';

const { Title, Text } = Typography;

export default function VolunteerWorkbench() {
  const navigate = useNavigate();
  const [list, setList] = useState<WorkbenchItem[]>([]);
  const [summary, setSummary] = useState<{ total: number; pending: number; reviewing: number; completed: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [wb, sm] = await Promise.all([volunteerApi.workbench(), volunteerApi.summary()]);
      setList(wb.list);
      setSummary({
        total: sm.total,
        pending: sm.pending,
        reviewing: sm.reviewing,
        completed: sm.completed,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !summary) return <Spin style={{ display: 'block', margin: 64 }} />;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>我对接的申请</Title>
      <Text type="secondary">这里展示分配给你的组织者申请，按"待办优先 + 提交时间倒序"排序</Text>

      <Row gutter={16} style={{ marginTop: 16, marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="对接总数" value={summary?.total ?? 0} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="待办（SCREENING）"
              value={summary?.pending ?? 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#F59E0B' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="REVIEW 中"
              value={summary?.reviewing ?? 0}
              prefix={<FireOutlined />}
              valueStyle={{ color: '#8B5CF6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已结案"
              value={summary?.completed ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#10B981' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="申请列表" extra={<Button onClick={load} loading={loading}>刷新</Button>}>
        {list.length === 0 ? (
          <Empty description="暂未对接任何申请" />
        ) : (
          <Table
            size="small"
            rowKey="applicationId"
            pagination={{ pageSize: 20 }}
            dataSource={list}
            columns={[
              { title: '申请单号', dataIndex: 'applicationNo', width: 140 },
              { title: '活动', dataIndex: 'activityId', width: 100 },
              { title: '组织者', dataIndex: 'organizerName', width: 100 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 110,
                render: (s: string, r: WorkbenchItem) => <Tag color={r.statusColor}>{r.statusLabel}</Tag>,
              },
              {
                title: 'AI 评分',
                width: 100,
                render: (_: any, r: WorkbenchItem) =>
                  r.score ? (
                    <Space size={4}>
                      <Text strong>{r.score}</Text>
                      <Tag color={r.grade === 'S' ? 'orange' : r.grade === 'A' ? 'green' : 'blue'}>{r.grade}</Tag>
                    </Space>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
              {
                title: '提交时间',
                dataIndex: 'submittedAt',
                width: 160,
                render: (t?: number) => (t ? new Date(t).toLocaleString('zh-CN') : '—'),
              },
              {
                title: '操作',
                width: 80,
                render: (_: any, r: WorkbenchItem) => {
                  // Frank 09:17：跳新建的通用申请详情页 /applications/:id（不再走 admin/approvals 避免 403）
                  const targetPath = '/applications/' + (r.applicationId ?? '');
                  return (
                    <Button type="link" size="small" onClick={() => navigate(targetPath)}>
                      详情
                    </Button>
                  );
                },
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
