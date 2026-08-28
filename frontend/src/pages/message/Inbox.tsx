/**
 * 通知中心（v7 · PRD §4.1.8 US-O11）
 * 5 角色都能进：列出我的消息 + 标已读
 * Frank #4 (2026-08-21)：点击消息 → 弹详情 Modal 显示完整内容 + 标已读 + 跳审批页
 */
import { useEffect, useState } from 'react';
import {
  Card, List, Tag, Empty, Spin, Button, Space, Typography, Badge, Tabs, message, Popconfirm, Modal, Descriptions,
} from 'antd';
import { BellOutlined, CheckOutlined, LinkOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { messageApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const TYPE_META: Record<string, { label: string; color: string }> = {
  APPLICATION_SUBMIT:   { label: '申请提交', color: 'blue' },
  APPLICATION_APPROVE:  { label: '申请通过', color: 'green' },
  APPLICATION_REJECT:   { label: '申请拒绝', color: 'red' },
  REIMBURSEMENT_PAID:   { label: '报销到账', color: 'orange' },
  STAGE_TASK:           { label: '任务通知', color: 'cyan' },
  SYSTEM:               { label: '系统通知', color: 'default' },
};

// v1.9.26 Frank 28 23:18 反馈：志愿者申请运营介入（UNCERTAIN）通知用黄色标记 + 置顶
// 后端 stages/controller.ts UNCERTAIN 分支 3 个通知的 title 都有 "志愿者无法判断" 关键字
function isUncertainMsg(m: any): boolean {
  return typeof m?.title === 'string' && m.title.includes('无法判断');
}

function formatTime(t?: number) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 24) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatFullTime(t?: number) {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleString('zh-CN', { hour12: false });
}

export default function Inbox() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [detailMsg, setDetailMsg] = useState<any | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { list } = await messageApi.mine();
      setList(list);
    } catch { /* */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Frank #4: 点击消息 → 弹详情 Modal（显示完整 title + content + 跳转按钮）+ 标已读
  const handleClick = async (m: any) => {
    setDetailMsg(m);
    if (!m.read) {
      try {
        await messageApi.markRead(m.messageId);
        setList((prev) => prev.map((x) => (x.messageId === m.messageId ? { ...x, read: true } : x)));
      } catch { /* */ }
    }
  };

  // 详情 Modal 内的"查看详情"按钮 → 跳转到消息 link 对应页面（通常是审批工作台）
  const handleGoLink = () => {
    if (detailMsg?.link) {
      navigate(detailMsg.link);
      setDetailMsg(null);
    }
  };

  const handleMarkAll = async () => {
    try {
      await messageApi.markAllRead();
      setList((prev) => prev.map((x) => ({ ...x, read: true })));
      message.success('已全部标记为已读');
    } catch { /* */ }
  };

  const filtered = filter === 'unread' ? list.filter((m) => !m.read) : list;
  // v1.9.26 Frank 28 23:18 反馈：UNCERTAIN（志愿者无法判断）通知置顶
  const sorted = [...filtered].sort((a, b) => Number(isUncertainMsg(b)) - Number(isUncertainMsg(a)));
  const unreadCount = list.filter((m) => !m.read).length;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>
        <BellOutlined /> 通知中心
        {unreadCount > 0 && <Badge count={unreadCount} style={{ marginLeft: 12 }} />}
      </Title>
      <Text type="secondary">申请/任务/系统消息统一收件箱，点击消息查看完整内容</Text>

      <Card style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Tabs
            size="small"
            activeKey={filter}
            onChange={(k) => setFilter(k as 'all' | 'unread')}
            items={[
              { key: 'all', label: `全部 (${list.length})` },
              { key: 'unread', label: `未读 (${unreadCount})` },
            ]}
          />
          {unreadCount > 0 && (
            <Popconfirm title="全部标记为已读？" onConfirm={handleMarkAll}>
              <Button icon={<CheckOutlined />}>全部已读</Button>
            </Popconfirm>
          )}
        </Space>

        {loading && list.length === 0 ? (
          <Spin style={{ display: 'block', margin: 64 }} />
        ) : filtered.length === 0 ? (
          <Empty description={filter === 'unread' ? '没有未读消息' : '暂无消息'} />
        ) : (
          <List
            dataSource={sorted}
            renderItem={(m) => {
              const type = TYPE_META[m.type] ?? { label: m.type, color: 'default' };
              const uncertain = isUncertainMsg(m);
              return (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    // v1.9.26 Frank 28 23:18：UNCERTAIN 通知背景浅黄
                    background: uncertain ? '#FFFBE6' : (m.read ? '#fff' : '#F0F7FF'),
                    padding: '12px 16px',
                    borderRadius: 8,
                    marginBottom: 8,
                    border: uncertain ? '1px solid #FFE58F' : (m.read ? '1px solid #f0f0f0' : '1px solid #91caff'),
                  }}
                  onClick={() => handleClick(m)}
                >
                  <List.Item.Meta
                    avatar={
                      uncertain ? (
                        <Badge dot color="gold">
                          <BellOutlined style={{ fontSize: 24, color: '#D48806' }} />
                        </Badge>
                      ) : m.read ? (
                        <BellOutlined style={{ fontSize: 24, color: '#9CA3AF' }} />
                      ) : (
                        <Badge dot>
                          <BellOutlined style={{ fontSize: 24, color: '#3370FF' }} />
                        </Badge>
                      )
                    }
                    title={
                      <Space>
                        {/* v1.9.26 Frank 28 23:18：UNCERTAIN 通知标题用黄色高亮 */}
                        <Text strong={!m.read} style={uncertain ? { color: '#D48806' } : undefined}>{m.title}</Text>
                        <Tag color={uncertain ? 'gold' : type.color}>{type.label}</Tag>
                        {m.link && <LinkOutlined style={{ color: '#9CA3AF' }} />}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>{m.content}</Paragraph>
                        <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(m.createdAt)} · 点击查看详情</Text>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      {/* Frank #4: 消息详情 Modal — 显示完整 title + content + 跳转按钮 */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            {detailMsg && TYPE_META[detailMsg.type] && (
              <Tag color={TYPE_META[detailMsg.type].color}>{TYPE_META[detailMsg.type].label}</Tag>
            )}
            <span>{detailMsg?.title}</span>
          </Space>
        }
        open={!!detailMsg}
        onCancel={() => setDetailMsg(null)}
        footer={[
          <Button key="close" onClick={() => setDetailMsg(null)}>关闭</Button>,
          detailMsg?.link ? (
            <Button key="go" type="primary" icon={<LinkOutlined />} onClick={handleGoLink}>
              查看详情 →
            </Button>
          ) : null,
        ]}
        width={640}
      >
        {detailMsg && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="消息类型">
              <Tag color={TYPE_META[detailMsg.type]?.color}>{TYPE_META[detailMsg.type]?.label ?? detailMsg.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {detailMsg.read ? <Tag>已读</Tag> : <Tag color="blue">未读</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="发送时间">
              {formatFullTime(detailMsg.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="标题">{detailMsg.title}</Descriptions.Item>
            <Descriptions.Item label="内容">
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {detailMsg.content}
              </Paragraph>
            </Descriptions.Item>
            {detailMsg.link && (
              <Descriptions.Item label="跳转链接">
                <Text code>{detailMsg.link}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
