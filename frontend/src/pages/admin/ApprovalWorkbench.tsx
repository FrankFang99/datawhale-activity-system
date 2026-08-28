/**
 * 运营后台：审批工作台（切片 3 · Frank 27 16:42 v3）
 * PRD §4.2.2 + AC4
 *
 * v3 修订（Frank 27 16:42 反馈 Comment 1）：
 * - 详情 Drawer 用共享组件 ApplicationDetailBody，跟 /applications/:id 详情页对齐
 * - 删"高风险字段"Alert（v17.1 同步）
 * - 删"基本信息"二级 Title + 单独的申请动机/价值/经验 Card
 *   统一走 ApplicationDetailBody 的 6 维评分 Card 网格 + 申请原文 tab
 * - Drawer 标题改 "申请详情 NO.XXX"（去掉冗余 ID 描述）
 * - 后端 GET /api/admin/applications/:id 加 3 重搜索 fallback + activityTitle 字段
 *
 * v1.2 修复：Tabs 区分 SCREENING（初审）/ REVIEW（复审）两种待审状态
 */
import { useEffect, useState } from 'react';
import {
  Table, Tag, Button, Space, Modal, Input, Form, message, Typography, Card, Spin, Alert, Drawer, Tabs, Select,
} from 'antd';
import { CheckOutlined, CloseOutlined, RollbackOutlined, EyeOutlined, ThunderboltOutlined, UserAddOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import http, { adminApi } from '../../services/api';
import { authStore } from '../../store/auth';
import PageHeader from '../../components/PageHeader';
import ApplicationDetailBody from '../../components/ApplicationDetailBody';


const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface PendingApp {
  applicationId: string;
  applicationNo: string;
  activityId: string;
  organizerName: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  score: number;
  grade: string;
  gradeLabel: string;
  submittedAt: number;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  S: { color: 'orange', label: 'S · 优质' },
  A: { color: 'green', label: 'A · 良好' },
  B: { color: 'blue', label: 'B · 中等' },
  C: { color: 'orange', label: 'C · 较弱' },
  D: { color: 'red', label: 'D · 不达标' },
};

export default function ApprovalWorkbench() {
  const [tab, setTab] = useState<'SCREENING' | 'REVIEW'>('SCREENING');
  const [list, setList] = useState<PendingApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<{ SCREENING: number; REVIEW: number }>({ SCREENING: 0, REVIEW: 0 });
  const [detailDrawer, setDetailDrawer] = useState<{
    open: boolean;
    appId?: string;
    data?: any;
  }>({ open: false });
  const [detailLoading, setDetailLoading] = useState(false);
  const [volunteers, setVolunteers] = useState<Array<{ userId: string; email: string; name: string; province?: string }>>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignVolunteerId, setAssignVolunteerId] = useState<string | undefined>();
  const [assignRemark, setAssignRemark] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [drawerComment, setDrawerComment] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = authStore((s) => s.user);

  useEffect(() => {
    if (user && !['OPERATOR', 'ADMIN', 'VOLUNTEER'].includes(user.role)) {
      message.warning('权限不足，仅运营/志愿者可访问审批工作台');
      navigate('/');
    }
  }, [user, navigate]);

  // Frank #4: 消息中心带 ?focus=NO.008 → 自动打开对应申请详情
  useEffect(() => {
    const focus = searchParams.get('focus');
    if (focus) {
      (async () => {
        try {
          const r = await adminApi.getApp(focus);
          setDetailDrawer({ open: true, appId: focus, data: r });
        } catch {
          message.error('申请不存在或已下架');
        }
        // 清除 query 参数避免重复触发
        searchParams.delete('focus');
        setSearchParams(searchParams, { replace: true });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('focus')]);

  const load = async () => {
    setLoading(true);
    try {
      // v1.2 修复：并取两个 tab 数据 + 计数，让 Tab badge 实时显示
      const [pending, review] = await Promise.all([
        http.get<{ code: 0; data: { list: PendingApp[]; total: number } }>('/admin/applications/pending'),
        http.get<{ code: 0; data: { list: PendingApp[]; total: number } }>('/admin/applications/review-pending'),
      ]);
      setList(tab === 'SCREENING' ? pending.data.data.list : review.data.data.list);
      setCounts({
        SCREENING: pending.data.data.total,
        REVIEW: review.data.data.total,
      });
    } catch (e) {
      /* 拦截器已处理 */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  // v1.3 Frank 17:43 反馈 Comment 3：审批决策（通过/拒绝/打回）直接放在 Drawer 内完成，删 Modal + TRANSFER
  const handleDecision = async (action: 'APPROVE' | 'REJECT' | 'RETURN') => {
    if (!detailDrawer.appId) return;
    const comment = drawerComment.trim();
    if ((action === 'REJECT' || action === 'RETURN') && !comment) {
      message.warning('拒绝/打回必须填写审批意见');
      return;
    }
    setSubmittingAction(action);
    try {
      const res = await http.post(`/admin/applications/${detailDrawer.appId}/approve`, {
        action,
        comment: comment || undefined,
      });
      message.success(res.data.data.message);
      setDetailDrawer({ open: false });
      setDrawerComment('');
      load();
    } catch (e) {
      /* 拦截器已处理 */
    } finally {
      setSubmittingAction(null);
    }
  };

  // v1.3 Frank 17:43：AI 草拟填到 Drawer 的 drawerComment（不再走 Modal form）
  const handleDraftReview = async () => {
    if (!detailDrawer.appId) return;
    if (drawerComment.trim()) {
      Modal.confirm({
        title: '已有人工编辑的审批意见',
        content: '是否用 AI 草拟的意见覆盖？',
        okText: '覆盖',
        cancelText: '取消',
        onOk: async () => {
          try {
            const d = await adminApi.draftReview(detailDrawer.appId!);
            setDrawerComment(d.draft);
            message.success('已草拟到审批意见（可直接修改）');
          } catch {
            /* 拦截器已处理 */
          }
        },
      });
      return;
    }
    try {
      const d = await adminApi.draftReview(detailDrawer.appId);
      setDrawerComment(d.draft);
      message.success('已草拟到审批意见（可直接修改）');
    } catch {
      /* 拦截器已处理 */
    }
  };

  const openDetail = async (appId: string) => {
    setDetailDrawer({ open: true, appId });
    setDetailLoading(true);
    try {
      const res = await http.get(`/admin/applications/${appId}`);
      setDetailDrawer({ open: true, appId, data: res.data.data });
    } catch (e) {
      /* 拦截器已处理 */
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="审批工作台"
        subtitle={`待审申请 · SCREENING ${counts.SCREENING} / REVIEW ${counts.REVIEW}`}
      />

      <Card style={{ marginTop: 16, borderRadius: 16 }}>
        {/* v1.2 修复：Tabs 区分 SCREENING（初审）/ REVIEW（复审）两种待审状态 */}
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'SCREENING' | 'REVIEW')}
          style={{ marginBottom: 8 }}
          items={[
            { key: 'SCREENING', label: `初审 (${counts.SCREENING})` },
            { key: 'REVIEW', label: `复审 (${counts.REVIEW})` },
          ]}
        />
        <Spin spinning={loading}>
          {list.length === 0 ? (
            <Alert
              message={tab === 'SCREENING' ? '暂无初审申请' : '暂无复审申请'}
              description={tab === 'SCREENING' ? '所有初审都已处理完毕。' : '所有复审都已处理完毕。'}
              type="info"
              showIcon
              style={{ margin: 32 }}
            />
          ) : (
            <Table
              rowKey="applicationId"
              dataSource={list}
              pagination={false}
              columns={[
                { title: '申请编号', dataIndex: 'applicationNo', key: 'applicationNo' },
                { title: '申请人', dataIndex: 'organizerName', key: 'organizerName' },
                { title: '活动 ID', dataIndex: 'activityId', key: 'activityId', render: (id) => <Text code>{id}</Text> },
                {
                  title: '评分',
                  dataIndex: 'score',
                  key: 'score',
                  render: (s, row) => (
                    <Space>
                      <strong style={{ color: '#3370FF' }}>{s}</strong>
                      {row.grade && <Tag color={STATUS_MAP[row.grade]?.color}>{STATUS_MAP[row.grade]?.label ?? row.grade}</Tag>}
                    </Space>
                  ),
                },
                {
                  title: '提交时间',
                  dataIndex: 'submittedAt',
                  key: 'submittedAt',
                  render: (t) => new Date(t).toLocaleString('zh-CN'),
                },
                {
                  title: '操作',
                  key: 'actions',
                  render: (_, app) => (
                    <Space>
                      <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(app.applicationId)}>
                        详情
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </Card>

      {/* v1.3 Frank 17:43 反馈 Comment 3：删审批操作 Modal（决策移到 Drawer 内） */}

      {/* 详情 Drawer（v6 · 3 tab：申请原文 / AI 评分 / 审核日志 + AI 草拟意见） */}
      <Drawer
        title={detailDrawer.appId ? `申请详情 ${detailDrawer.appId}` : ''}
        open={detailDrawer.open}
        onClose={() => setDetailDrawer({ open: false })}
        width={760}
      >
        <Spin spinning={detailLoading}>
          {detailDrawer.data && (
            <div>
              {/* Frank 27 16:42 反馈 Comment 1：审批工作台 Drawer 跟 /applications/:id 详情页对齐
                  用共享组件 ApplicationDetailBody */}
              <ApplicationDetailBody data={detailDrawer.data} applicationId={detailDrawer.appId} />

              {/* v1.3 Frank 17:43 反馈 Comment 3：审批决策完整区（原 AI 草拟按钮 + Modal 内容合并到这里）
                  - AI 草拟填到下方 textarea
                  - 通过/拒绝/打回 3 个按钮直接调用 API（不再弹 Modal） */}
              <Card
                size="small"
                style={{ marginTop: 16, background: '#F0F8FF' }}
                title={<Space><ThunderboltOutlined /> 审批决策</Space>}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Space>
                    <Button
                      type="default"
                      size="small"
                      icon={<ThunderboltOutlined />}
                      onClick={handleDraftReview}
                    >
                      AI 草拟审核意见
                    </Button>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      点击后填到下方"审批意见"字段，可继续修改
                    </Text>
                  </Space>
                  <TextArea
                    rows={3}
                    maxLength={200}
                    showCount
                    value={drawerComment}
                    onChange={(e) => setDrawerComment(e.target.value)}
                    placeholder="审批意见（≤200 字符）· 拒绝/打回必填，通过可选"
                  />
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      loading={submittingAction === 'APPROVE'}
                      onClick={() => handleDecision('APPROVE')}
                    >
                      通过
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      loading={submittingAction === 'REJECT'}
                      onClick={() => handleDecision('REJECT')}
                    >
                      拒绝
                    </Button>
                    <Button
                      size="small"
                      icon={<RollbackOutlined />}
                      loading={submittingAction === 'RETURN'}
                      onClick={() => handleDecision('RETURN')}
                    >
                      打回
                    </Button>
                  </Space>
                </Space>
              </Card>

              {/* 分配志愿者（v6 · 仅 admin/operator） */}
              {(user?.role === 'ADMIN' || user?.role === 'OPERATOR') && (
                <Card
                  size="small"
                  style={{ marginTop: 16, background: '#F0FFF4' }}
                  title={<Space><UserAddOutlined /> 分配志愿者（PRD §5.3.2）</Space>}
                >
                  {detailDrawer.data.volunteerId ? (
                    <div>
                      <Text>已分配：</Text>
                      <Tag color="blue" style={{ marginLeft: 8 }}>{detailDrawer.data.volunteerId}</Tag>
                    </div>
                  ) : (
                    <Text type="secondary">尚未分配志愿者</Text>
                  )}
                  <Button
                    type="primary"
                    size="small"
                    icon={<UserAddOutlined />}
                    style={{ marginTop: 8 }}
                    onClick={async () => {
                      setAssignOpen(true);
                      setAssignVolunteerId(undefined);
                      setAssignRemark('');
                      try {
                        const r = await adminApi.listVolunteers();
                        setVolunteers(r.list);
                      } catch { /* */ }
                    }}
                  >
                    {detailDrawer.data.volunteerId ? '改派志愿者' : '分配志愿者'}
                  </Button>
                </Card>
              )}
            </div>
          )}
        </Spin>
      </Drawer>

      {/* 分配志愿者 Modal */}
      <Modal
        title="分配志愿者"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={async () => {
          if (!assignVolunteerId || !detailDrawer.appId) {
            message.warning('请选择志愿者');
            return;
          }
          setAssignSubmitting(true);
          try {
            const r = await adminApi.assignVolunteer(detailDrawer.appId, {
              volunteerId: assignVolunteerId,
              remark: assignRemark || undefined,
            });
            message.success(r.message);
            setAssignOpen(false);
            // 刷新详情
            const fresh = await adminApi.getApp(detailDrawer.appId);
            setDetailDrawer({ ...detailDrawer, data: fresh });
          } finally {
            setAssignSubmitting(false);
          }
        }}
        confirmLoading={assignSubmitting}
        okText="确认分配"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="选择志愿者" required>
            <Select
              placeholder="请选择志愿者"
              value={assignVolunteerId}
              onChange={setAssignVolunteerId}
              showSearch
              optionFilterProp="label"
              options={volunteers.map((v) => ({
                value: v.userId,
                label: `${v.name} (${v.email})${v.province ? ' · ' + v.province : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="备注（可选）">
            <Input.TextArea rows={2} maxLength={200} showCount value={assignRemark} onChange={(e) => setAssignRemark(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
