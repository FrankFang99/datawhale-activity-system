import { useEffect, useState } from 'react';
import { Row, Col, Card, Tag, Input, Select, Empty, Spin, Typography, Alert, Button, Space } from 'antd';
import {
  SearchOutlined, EnvironmentOutlined, CalendarOutlined, TeamOutlined,
  BookOutlined, QuestionCircleOutlined, AuditOutlined,
  HistoryOutlined, ScheduleOutlined, DashboardOutlined,
  RightOutlined, TrophyOutlined, GlobalOutlined, UserOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { activityApi, Activity } from '../services/api';
import { authStore } from '../store/auth';
import AIAssistant from '../components/AIAssistant';
import BlobBg from '../components/BlobBg';
import { TOTAL_UNIVERSITIES } from '../data/universities';

const { Title, Paragraph } = Typography;
const { Search } = Input;

// Frank 2026-08-21 #2：4 分类活动状态（按日期 + 组织者状态动态计算）
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: '待确定',   color: 'default' },   // 未确定组织者 + 截止时间没过
  PUBLISHED: { label: '准备举办', color: 'green' },     // 已确定组织者 + 日期未到
  ONGOING:   { label: '举办中',   color: 'blue' },       // 活动当天
  FINISHED:  { label: '已结束',   color: 'default' },   // 活动办完
  CANCELLED: { label: '已取消',   color: 'red' },
};

// v16.6 Frank 16:04 Comment 6：飞书 base text 字段会自动把 URL 转 markdown 链接
// 解析 [url](url) 格式，提取真实 URL
function extractRealUrl(coverImage: string | undefined): string | null {
  if (!coverImage) return null;
  // 飞书 markdown 格式：[https://...](https://...) → 提取 https://...
  const m = coverImage.match(/\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)]+)\)/);
  if (m) return m[1];
  // 纯 URL
  if (/^https?:\/\//.test(coverImage)) return coverImage;
  return null;
}

const COVER_GRADIENTS = [
  'linear-gradient(135deg, #3370FF 0%, #62D4C8 100%)',
  'linear-gradient(135deg, #A679FF 0%, #62D4C8 100%)',
  'linear-gradient(135deg, #FF6B9D 0%, #F6C65B 100%)',
  'linear-gradient(135deg, #10B981 0%, #62D4C8 100%)',
];

/**
 * 5 角色 Landing 入口（v1.1 引入）
 * 替换原本「登入后再看菜单」逻辑 → 登录后 Landing 顶部展示角色快捷入口
 */
function getRoleEntry(role: string | undefined): { title: string; icon: React.ReactNode; items: Array<{ to: string; label: string; count?: number | null }> } | null {
  if (!role) return null;
  switch (role) {
    case 'ADMIN':
      return {
        title: '管理员工作台',
        icon: <DashboardOutlined style={{ color: '#DC2626' }} />,
        items: [
          { to: '/admin/dashboard', label: '数据看板' },
          { to: '/admin/approvals', label: '审批工作台' },
          { to: '/admin/activities', label: '活动管理' },
          { to: '/reimbursements', label: '报销中心' },
        ],
      };
    case 'OPERATOR':
      return {
        title: '运营工作台',
        icon: <AuditOutlined style={{ color: '#D97706' }} />,
        items: [
          { to: '/admin/approvals', label: '审批工作台' },
          { to: '/admin/activities', label: '活动管理' },
          { to: '/reimbursements', label: '报销中心' },
        ],
      };
    case 'VOLUNTEER':
      return {
        title: '志愿者工作台',
        icon: <TeamOutlined style={{ color: '#3370FF' }} />,
        items: [
          { to: '/volunteer/workbench', label: '我对接的申请' },
          { to: '/inbox', label: '站内消息' },
        ],
      };
    case 'ORGANIZER':
    case 'ASSISTANT':
      return {
        title: '组织者工作台',
        icon: <HistoryOutlined style={{ color: '#059669' }} />,
        items: [
          { to: '/my-applications', label: '我的申请' },
          { to: '/reimbursements', label: '报销中心' },
          { to: '/inbox', label: '站内消息' },
        ],
      };
    case 'PARTICIPANT':
      return {
        title: '参与者中心',
        icon: <ScheduleOutlined style={{ color: '#3370FF' }} />,
        items: [
          { to: '/my-registrations', label: '我的报名' },
          { to: '/inbox', label: '站内消息' },
        ],
      };
    default:
      return null;
  }
}

export default function ActivityList() {
  const navigate = useNavigate();
  const user = authStore((s) => s.user);
  const [list, setList] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [series, setSeries] = useState<string | undefined>();
  const [allSeries, setAllSeries] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await activityApi.list({ keyword, status, series, pageSize: 24 });
      setList(data.list);
      setTotal(data.total);
      // 从列表中提取所有 series（去重）
      const seriesSet = new Set<string>();
      for (const a of data.list) if (a.series) seriesSet.add(a.series);
      setAllSeries(Array.from(seriesSet));
    } catch {
      /* 拦截器已处理 */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleEntry = getRoleEntry(user?.role);
  const onlineCount = list.reduce((s, a) => s + (a.maxParticipants || 0), 0);

  return (
    <div>
      {/* Hero 渐变区（v1.1：加 BlobBg 装饰球） */}
      <div className="dw-hero dw-fade-in">
        <BlobBg variant="landing" />
        <div className="dw-hero__inner">
          <h1>{user ? `欢迎，${user.name}` : '高校 AI 活动 · 共创平台'}</h1>
          <p>由 Datawhale 社区发起 · 全国 {TOTAL_UNIVERSITIES}+ 高校参与</p>
        </div>
      </div>

      {/* 5 角色 Landing 入口（v1.1 引入） */}
      {roleEntry && (
        <div className="dw-role-entry dw-fade-in">
          <h3 className="dw-role-entry__title">
            {roleEntry.icon}
            {roleEntry.title}
          </h3>
          <div className="dw-role-entry__list">
            {roleEntry.items.map((it) => (
              <Link key={it.to} to={it.to} className="dw-role-entry__item">
                <span className="dw-role-entry__item-label">{it.label}</span>
                <Space size={4}>
                  {it.count != null && <span className="dw-role-entry__item-count">{it.count}</span>}
                  <RightOutlined style={{ color: '#9CA3AF', fontSize: 12 }} />
                </Space>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 数据卡（v1.1 引入） */}
      <Row gutter={[16, 16]} className="dw-fade-in">
        <Col xs={24} sm={12} md={8}>
          <div className="dw-stat-card">
            <div className="dw-stat-card__icon dw-stat-card__icon--blue">
              <TrophyOutlined />
            </div>
            <div>
              <div className="dw-stat-card__value">{total}</div>
              <div className="dw-stat-card__label">在办活动</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <div className="dw-stat-card">
            <div className="dw-stat-card__icon dw-stat-card__icon--purple">
              <GlobalOutlined />
            </div>
            <div>
              <div className="dw-stat-card__value">{TOTAL_UNIVERSITIES}+</div>
              <div className="dw-stat-card__label">覆盖高校</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <div className="dw-stat-card">
            <div className="dw-stat-card__icon dw-stat-card__icon--green">
              <UserOutlined />
            </div>
            <div>
              <div className="dw-stat-card__value">{onlineCount.toLocaleString()}</div>
              <div className="dw-stat-card__label">预计可参与人次</div>
            </div>
          </div>
        </Col>
      </Row>

      {/* v4 修订：按系列 + 状态筛选 */}
      <div className="dw-section-title">
        全部活动
        <span className="dw-section-title__sub">共 {total} 个</span>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Search
          placeholder="搜索活动标题/描述/地点"
          allowClear
          enterButton={<SearchOutlined />}
          style={{ maxWidth: 320, flex: 1 }}
          onSearch={(v) => {
            setKeyword(v);
            load();
          }}
        />
        <Select
          placeholder="按系列筛选"
          allowClear
          style={{ width: 200 }}
          value={series}
          onChange={(v) => {
            setSeries(v);
            load();
          }}
          options={allSeries.map((s) => ({ value: s, label: `📚 ${s}` }))}
        />
        <Select
          placeholder="活动状态"
          allowClear
          style={{ width: 140 }}
          value={status}
          onChange={(v) => {
            setStatus(v);
            load();
          }}
          options={[
            { value: 'PENDING',   label: '待确定' },
            { value: 'PUBLISHED', label: '准备举办' },
            { value: 'ONGOING',   label: '举办中' },
            { value: 'FINISHED',  label: '已结束' },
          ]}
        />
      </div>

      <Spin spinning={loading}>
        {list.length === 0 ? (
          <Empty description="暂无活动" style={{ padding: 64 }} />
        ) : (
          <Row gutter={[16, 16]}>
            {list.map((a, idx) => {
              const statusInfo = STATUS_MAP[a.status] ?? { label: a.status, color: 'default' };
              const gradient = COVER_GRADIENTS[idx % COVER_GRADIENTS.length];
              const isPending = a.status === 'PENDING';
              // v16.6 Frank 16:04 Comment 6：img onError fallback + 解析飞书 markdown 链接
              const realCoverUrl = extractRealUrl(a.coverImage);
              return (
                <Col key={a.activityId} xs={24} sm={12} md={12} lg={8} xl={8}>
                  <Link to={`/activities/${a.activityId}`}>
                    <Card
                      className="dw-card"
                      cover={
                        <div
                          style={{
                            height: 160,
                            background: gradient,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 28,
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            opacity: isPending ? 0.7 : 1,
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {/* v16.6 有 coverImage URL → 显示图片；加载失败 → 隐藏 img 露出 gradient */}
                          {realCoverUrl && (
                            <img
                              src={realCoverUrl}
                              alt={a.title}
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          )}
                          {/* v16.6 无 coverImage 或加载失败 → 显示标题前 8 字 */}
                          <span style={{ position: 'relative', zIndex: 1 }}>{a.title.slice(0, 8)}</span>
                        </div>
                      }
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                        <Title level={4} style={{ margin: 0, flex: 1 }}>
                          {a.title}
                        </Title>
                        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                      </div>
                      {a.series && (
                        <Tag color="purple" style={{ marginBottom: 8 }}>
                          <BookOutlined /> {a.series}
                        </Tag>
                      )}
                      <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 2 }}
                        style={{ minHeight: 44, marginBottom: 12, fontSize: 13 }}
                      >
                        {a.description || (isPending ? '（该站点暂未确定组织者，欢迎感兴趣的同学报名参与者或申请成为组织者）' : '暂无描述')}
                      </Paragraph>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#6B7280', fontSize: 13 }}>
                        {isPending ? (
                          <Alert
                            type="warning"
                            showIcon
                            message="该站点暂未确定组织者"
                            description="你可以先报名成为参与者，运营确认组织者后会通知你"
                            style={{ padding: 4, fontSize: 12 }}
                          />
                        ) : (
                          <>
                            <span>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              {a.startDate} ~ {a.endDate}
                              {a.daysToStart != null && a.daysToStart > 0 && (
                                <Tag color="orange" style={{ marginLeft: 8 }}>还有 {a.daysToStart} 天</Tag>
                              )}
                            </span>
                            <span><EnvironmentOutlined style={{ marginRight: 4 }} />{a.location}</span>
                            <span><TeamOutlined style={{ marginRight: 4 }} />最多 {a.maxParticipants} 人</span>
                          </>
                        )}
                      </div>
                    </Card>
                  </Link>
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>

      {/* v4 修订：没找到学校时 CTA */}
      <Card
        style={{ marginTop: 24, borderRadius: 16, background: 'linear-gradient(135deg, #F0F7FF 0%, #FAFCFF 100%)' }}
      >
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Title level={4} style={{ margin: 0 }}>
              <QuestionCircleOutlined style={{ color: '#3370FF', marginRight: 8 }} />
              没找到你的学校？
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              可以登记"对该学校感兴趣"，运营确认组织者后会通知你；也可以直接申请成为该学校站点的组织者。
            </Paragraph>
          </Col>
          <Col>
            <Space>
              <Button onClick={() => navigate('/interests')}>登记兴趣</Button>
              <Button type="primary" onClick={() => navigate('/apply/organizer')} className="dw-gradient-btn">
                申请成为组织者
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {user && <AIAssistant />}
    </div>
  );
}
