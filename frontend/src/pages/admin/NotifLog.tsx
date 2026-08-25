/**
 * 通知日志（v8 · PRD §4.2.6 US-P9）— admin/operator 看消息发送记录 + 重发
 */
import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Select, Input, Typography, Spin, Tabs, message, Statistic, Row, Col, Popconfirm,
} from 'antd';
import { BellOutlined, ReloadOutlined, SendOutlined, BarChartOutlined } from '@ant-design/icons';
import { messageApi } from '../../services/api';

const { Title, Text } = Typography;

const TYPE_META: Record<string, { label: string; color: string }> = {
  APPLICATION_SUBMIT:   { label: '申请提交', color: 'blue' },
  APPLICATION_APPROVE:  { label: '申请通过', color: 'green' },
  APPLICATION_REJECT:   { label: '申请拒绝', color: 'red' },
  REIMBURSEMENT_PAID:   { label: '报销到账', color: 'orange' },
  STAGE_TASK:           { label: '任务通知', color: 'cyan' },
  SYSTEM:               { label: '系统通知', color: 'default' },
};

const ALL_TYPES = Object.keys(TYPE_META);

function formatTime(t?: number) {
  if (!t) return '-';
  const d = new Date(t);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function NotifLog() {
  const [list, setList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{ userId?: string; type?: string; read: 'all' | 'true' | 'false' }>({ read: 'all' });
  const [tab, setTab] = useState<'list' | 'stats'>('list');

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { read: filters.read, pageSize: 200 };
      if (filters.userId) params.userId = filters.userId;
      if (filters.type) params.type = filters.type;
      const [log, st] = await Promise.all([messageApi.adminLog(params), messageApi.adminStats()]);
      setList(log.list);
      setStats(st);
    } catch { /* 拦截器已处理 */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  const handleResend = async (m: any) => {
    try {
      const r = await messageApi.adminResend(m.messageId);
      message.success(`已重发：新消息 ${r.newMessageId}`);
      load();
    } catch { /* */ }
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>
        <BellOutlined /> 通知日志
      </Title>
      <Text type="secondary">运营/管理员查看所有消息发送记录 + 重发（PRD §4.2.6 US-P9）</Text>

      {stats && (
        <Row gutter={16} style={{ marginTop: 16, marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card><Statistic title="总消息" value={stats.total} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="未读" value={stats.unread} valueStyle={{ color: '#F59E0B' }} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="按类型数" value={Object.keys(stats.byType).length} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="触达用户" value={Object.keys(stats.byUser).length} /></Card></Col>
        </Row>
      )}

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Tabs
            size="small"
            activeKey={tab}
            onChange={(k) => setTab(k as 'list' | 'stats')}
            items={[
              { key: 'list', label: '消息列表' },
              { key: 'stats', label: '统计分析' },
            ]}
          />
          {tab === 'list' && (
            <>
              <Input
                placeholder="按 userId 过滤"
                value={filters.userId ?? ''}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value || undefined })}
                style={{ width: 200 }}
                allowClear
              />
              <Select
                placeholder="按类型过滤"
                value={filters.type}
                onChange={(v) => setFilters({ ...filters, type: v })}
                allowClear
                style={{ width: 160 }}
                options={ALL_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label }))}
              />
              <Select
                value={filters.read}
                onChange={(v) => setFilters({ ...filters, read: v })}
                style={{ width: 120 }}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'true', label: '已读' },
                  { value: 'false', label: '未读' },
                ]}
              />
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            </>
          )}
        </Space>

        {tab === 'list' ? (
          <Table
            size="small"
            rowKey="messageId"
            loading={loading}
            dataSource={list}
            pagination={{ pageSize: 20 }}
            columns={[
              { title: '时间', dataIndex: 'createdAt', width: 140, render: formatTime },
              { title: '收件人', dataIndex: 'userId', width: 100 },
              { title: '类型', dataIndex: 'type', width: 110, render: (t: string) => <Tag color={TYPE_META[t]?.color}>{TYPE_META[t]?.label ?? t}</Tag> },
              { title: '标题', dataIndex: 'title', width: 200 },
              { title: '内容', dataIndex: 'content', ellipsis: true },
              { title: '已读', dataIndex: 'read', width: 70, render: (r: boolean) => r ? <Tag color="default">已读</Tag> : <Tag color="orange">未读</Tag> },
              {
                title: '操作', width: 100,
                render: (_: any, m: any) => (
                  <Popconfirm title={`重发"${m.title}"给 ${m.userId}？`} onConfirm={() => handleResend(m)}>
                    <Button type="link" size="small" icon={<SendOutlined />}>重发</Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        ) : (
          <div>
            <Title level={5}><BarChartOutlined /> 按类型统计</Title>
            <Table
              size="small"
              pagination={false}
              dataSource={Object.entries(stats?.byType ?? {}).map(([k, v]) => ({ key: k, type: k, count: v }))}
              columns={[
                { title: '类型', dataIndex: 'type', render: (t: string) => <Tag color={TYPE_META[t]?.color}>{TYPE_META[t]?.label ?? t}</Tag> },
                { title: '数量', dataIndex: 'count', width: 100 },
              ]}
            />
            <Title level={5} style={{ marginTop: 24 }}>按用户统计（前 20）</Title>
            <Table
              size="small"
              pagination={{ pageSize: 20 }}
              dataSource={Object.entries(stats?.byUser ?? {})
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .slice(0, 20)
                .map(([k, v]) => ({ key: k, userId: k, count: v }))}
              columns={[
                { title: '用户', dataIndex: 'userId' },
                { title: '收到消息数', dataIndex: 'count', width: 120 },
              ]}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
