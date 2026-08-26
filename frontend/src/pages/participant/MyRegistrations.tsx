/**
 * 参与者视角 · 我的报名（v4 修订）— PARTICIPANT 默认工作台
 * 列出我作为参与者报名的活动
 */
import { useEffect, useState } from 'react';
import { Card, Table, Tag, Empty, Spin, Typography, Space, Button, message } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { participantApi, Participant, activityApi, Activity } from '../../services/api';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

export default function MyRegistrations() {
  const navigate = useNavigate();
  const [list, setList] = useState<Participant[]>([]);
  const [activities, setActivities] = useState<Record<string, Activity>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { list } = await participantApi.mine();
      setList(list);
      // 拉活动详情（公开接口）
      const acts = await activityApi.list();
      const map: Record<string, Activity> = {};
      for (const a of acts.list) map[a.activityId] = a;
      setActivities(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (recordId: string) => {
    try {
      await participantApi.cancel(recordId);
      message.success('已取消报名');
      load();
    } catch { /* 拦截器已处理 */ }
  };

  if (loading && list.length === 0) return <Spin style={{ display: 'block', margin: 64 }} />;

  return (
    <div>
      <PageHeader
        title="我的报名"
        subtitle="作为参与者报名的活动列表；取消后状态变更为「已取消」"
      />

      <Card style={{ marginTop: 16 }}>
        {list.length === 0 ? (
          <Empty description="你还没有报名任何活动">
            <Button type="primary" onClick={() => navigate('/')}>去看看活动大厅</Button>
          </Empty>
        ) : (
          <Table
            size="small"
            rowKey="recordId"
            pagination={{ pageSize: 10 }}
            dataSource={list}
            columns={[
              {
                title: '活动',
                dataIndex: 'activityId',
                render: (id: string) => {
                  const a = activities[id];
                  if (!a) return <Text type="secondary">{id}</Text>;
                  return (
                    <Space direction="vertical" size={0}>
                      <a onClick={() => navigate(`/activities/${id}`)} style={{ fontWeight: 500 }}>{a.title}</a>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <CalendarOutlined /> {a.startDate} · <EnvironmentOutlined /> {a.location}
                      </Text>
                    </Space>
                  );
                },
              },
              {
                title: '报名状态',
                dataIndex: 'status',
                width: 110,
                render: (s: string) => {
                  if (s === 'REGISTERED') return <Tag icon={<CheckCircleOutlined />} color="green">已报名</Tag>;
                  if (s === 'UNREGISTERED') return <Tag icon={<CloseCircleOutlined />} color="default">已取消</Tag>;
                  return <Tag>{s}</Tag>;
                },
              },
              {
                title: '报名时间',
                dataIndex: 'registeredAt',
                width: 160,
                render: (t?: number) => (t ? new Date(t).toLocaleString('zh-CN') : '—'),
              },
              {
                title: '操作',
                width: 100,
                render: (_: any, r: Participant) =>
                  r.status === 'REGISTERED' ? (
                    <Button type="link" size="small" danger onClick={() => handleCancel(r.recordId)}>
                      取消报名
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
