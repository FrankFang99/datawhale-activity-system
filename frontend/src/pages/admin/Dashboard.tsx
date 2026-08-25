/**
 * 数据看板（PRD §4.2.1 · v5）— ADMIN / OPERATOR 默认工作台
 * v1 简化：4 张卡片（总申请/待审批/总活动/总用户）+ 状态分布表
 */
import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Tag, Table, Empty, Typography, Space } from 'antd';
import { AuditOutlined, AppstoreOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { adminApi, DashboardKPI } from '../../services/api';

const { Title, Text } = Typography;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  SUBMITTED: { label: '已提交', color: 'blue' },
  SCREENING: { label: '待审批', color: 'gold' },
  CONFIRMED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已拒绝', color: 'red' },
  CANCELLED: { label: '已取消', color: 'default' },
  REVIEWING: { label: 'REVIEW 中', color: 'purple' },
  REVIEW_CONFIRMED: { label: 'REVIEW 已确认', color: 'purple' },
  COMPLETED: { label: '已结案', color: 'green' },
  PENDING: { label: '待确定', color: 'default' },
  PUBLISHED: { label: '已发布', color: 'green' },
  ONGOING: { label: '进行中', color: 'blue' },
  FINISHED: { label: '已结束', color: 'default' },
  CANCELLED_ACT: { label: '已取消', color: 'red' },
};

const ACT_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待确定', color: 'default' },
  PUBLISHED: { label: '已发布', color: 'green' },
  ONGOING: { label: '进行中', color: 'blue' },
  FINISHED: { label: '已结束', color: 'default' },
  CANCELLED: { label: '已取消', color: 'red' },
};

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  ADMIN: { label: '管理员', color: 'red' },
  OPERATOR: { label: '运营', color: 'orange' },
  VOLUNTEER: { label: '志愿者', color: 'blue' },
  ORGANIZER: { label: '组织者', color: 'green' },
  PARTICIPANT: { label: '参与者', color: 'cyan' },
  ASSISTANT: { label: '助教', color: 'purple' },
};

export default function AdminDashboard() {
  const [kpi, setKpi] = useState<DashboardKPI | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.kpi();
      setKpi(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !kpi) return <Spin style={{ display: 'block', margin: 64 }} />;
  if (!kpi) return <Empty description="暂无数据" />;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>数据看板</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总申请数"
              value={kpi.applications.total}
              prefix={<AuditOutlined />}
              valueStyle={{ color: '#3370FF' }}
            />
            <Space size="small" style={{ marginTop: 8 }}>
              <Tag color="gold">待审批 {kpi.applications.pending}</Tag>
              <Tag color="purple">REVIEW {kpi.applications.reviewing}</Tag>
            </Space>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="本月新增申请"
              value={kpi.applications.thisMonth}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#10B981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总活动数"
              value={kpi.activities.total}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#62D4C8' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              已发布 {kpi.activities.byStatus['PUBLISHED'] ?? 0} · 待确定 {kpi.activities.byStatus['PENDING'] ?? 0}
            </Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={kpi.users.total}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#F59E0B' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              组织者 {kpi.users.byRole['ORGANIZER'] ?? 0} · 参与者 {kpi.users.byRole['PARTICIPANT'] ?? 0}
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="申请状态分布" extra={<Link to="/admin/approvals">前往审批 →</Link>}>
            <Table
              size="small"
              pagination={false}
              dataSource={Object.entries(kpi.applications.byStatus).map(([k, v]) => ({ key: k, status: k, count: v }))}
              columns={[
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (s: string) => {
                    const c = STATUS_LABEL[s] ?? { label: s, color: 'default' };
                    return <Tag color={c.color}>{c.label}</Tag>;
                  },
                },
                { title: '数量', dataIndex: 'count', width: 80 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="用户角色分布">
            <Table
              size="small"
              pagination={false}
              dataSource={Object.entries(kpi.users.byRole).map(([k, v]) => ({ key: k, role: k, count: v }))}
              columns={[
                {
                  title: '角色',
                  dataIndex: 'role',
                  render: (r: string) => {
                    const c = ROLE_LABEL[r] ?? { label: r, color: 'default' };
                    return <Tag color={c.color}>{c.label}</Tag>;
                  },
                },
                { title: '数量', dataIndex: 'count', width: 80 },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="活动状态分布">
            <Table
              size="small"
              pagination={false}
              dataSource={Object.entries(kpi.activities.byStatus).map(([k, v]) => ({ key: k, status: k, count: v }))}
              columns={[
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (s: string) => {
                    const c = ACT_STATUS_LABEL[s] ?? { label: s, color: 'default' };
                    return <Tag color={c.color}>{c.label}</Tag>;
                  },
                },
                { title: '数量', dataIndex: 'count', width: 80 },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
