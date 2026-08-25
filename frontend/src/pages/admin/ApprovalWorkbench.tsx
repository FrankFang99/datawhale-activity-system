/**
 * 运营后台：审批工作台（切片 3）
 * PRD §4.2.2 + AC4
 */
import { useEffect, useState } from 'react';
import {
  Table, Tag, Button, Space, Modal, Input, Form, message, Typography, Card, Descriptions, Spin, Alert, Drawer, Tabs, Select,
} from 'antd';
import { CheckOutlined, CloseOutlined, RollbackOutlined, SwapOutlined, EyeOutlined, RobotOutlined, ThunderboltOutlined, UserAddOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import http, { adminApi } from '../../services/api';
import { authStore } from '../../store/auth';


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
  const [list, setList] = useState<PendingApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    app?: PendingApp;
    action?: 'APPROVE' | 'REJECT' | 'RETURN' | 'TRANSFER';
  }>({ open: false });
  const [detailDrawer, setDetailDrawer] = useState<{
    open: boolean;
    appId?: string;
    data?: any;
  }>({ open: false });
  const [detailLoading, setDetailLoading] = useState(false);
  const [draftReview, setDraftReview] = useState<string | null>(null);
  const [volunteers, setVolunteers] = useState<Array<{ userId: string; email: string; name: string; province?: string }>>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignVolunteerId, setAssignVolunteerId] = useState<string | undefined>();
  const [assignRemark, setAssignRemark] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [form] = Form.useForm();
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
      const res = await http.get<{ code: 0; data: { list: PendingApp[]; total: number } }>(
        '/admin/applications/pending'
      );
      setList(res.data.data.list);
    } catch (e) {
      /* 拦截器已处理 */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAction = (app: PendingApp, action: 'APPROVE' | 'REJECT' | 'RETURN' | 'TRANSFER') => {
    setActionModal({ open: true, app, action });
    form.resetFields();
  };

  const submitAction = async () => {
    if (!actionModal.app || !actionModal.action) return;
    const values = await form.validateFields();
    try {
      const res = await http.post(`/admin/applications/${actionModal.app.applicationId}/approve`, {
        action: actionModal.action,
        ...values,
      });
      message.success(res.data.data.message);
      setActionModal({ open: false });
      load();
    } catch (e) {
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

  const actionText = {
    APPROVE: '通过',
    REJECT: '拒绝',
    RETURN: '打回修改',
    TRANSFER: '转交',
  } as const;

  return (
    <div>
      <Title level={2}>审批工作台</Title>
      <Text type="secondary">SCREENING 状态的申请 · {list.length} 条待处理</Text>

      <Card style={{ marginTop: 16, borderRadius: 16 }}>
        <Spin spinning={loading}>
          {list.length === 0 ? (
            <Alert message="暂无待审批申请" type="info" showIcon style={{ margin: 32 }} />
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
                      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openAction(app, 'APPROVE')}>
                        通过
                      </Button>
                      <Button size="small" danger icon={<CloseOutlined />} onClick={() => openAction(app, 'REJECT')}>
                        拒绝
                      </Button>
                      <Button size="small" icon={<RollbackOutlined />} onClick={() => openAction(app, 'RETURN')}>
                        打回
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </Card>

      {/* 审批操作 Modal */}
      <Modal
        title={actionModal.app ? `${actionText[actionModal.action!]} - ${actionModal.app.organizerName}` : ''}
        open={actionModal.open}
        onCancel={() => setActionModal({ open: false })}
        onOk={submitAction}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: actionModal.action === 'REJECT' }}
      >
        <Form form={form} layout="vertical">
          {(actionModal.action === 'REJECT' || actionModal.action === 'RETURN') && (
            <Form.Item
              label="原因"
              name="comment"
              rules={[{ required: true, message: '请填写原因' }, { max: 200, message: '≤200 字符' }]}
            >
              <TextArea rows={3} maxLength={200} showCount placeholder={`请说明 ${actionText[actionModal.action!]} 的原因`} />
            </Form.Item>
          )}
          {actionModal.action === 'TRANSFER' && (
            <Form.Item
              label="转交给（用户 ID）"
              name="transferTo"
              rules={[{ required: true, message: '请填写目标用户 ID' }]}
            >
              <Input placeholder="例：USR-xxxx" />
            </Form.Item>
          )}
          {actionModal.action === 'APPROVE' && (
            <Form.Item label="备注（可选）" name="comment" rules={[{ max: 200 }]}>
              <TextArea rows={2} maxLength={200} showCount placeholder="审批意见（≤200 字符）" />
            </Form.Item>
          )}
        </Form>
      </Modal>

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
              <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="申请编号">{detailDrawer.data.applicationNo}</Descriptions.Item>
                <Descriptions.Item label="申请人">{detailDrawer.data.organizerName}</Descriptions.Item>
                <Descriptions.Item label="联系手机">{detailDrawer.data.organizerPhone || '—'}</Descriptions.Item>
                <Descriptions.Item label="联系邮箱">{detailDrawer.data.organizerEmail || '—'}</Descriptions.Item>
                <Descriptions.Item label="活动 ID"><Text code>{detailDrawer.data.activityId}</Text></Descriptions.Item>
                <Descriptions.Item label="状态"><Tag color={detailDrawer.data.statusColor}>{detailDrawer.data.statusLabel}</Tag></Descriptions.Item>
                <Descriptions.Item label="AI 评分">
                  <Space>
                    <strong style={{ color: '#3370FF' }}>{detailDrawer.data.score}</strong>
                    {detailDrawer.data.grade && <Tag color={detailDrawer.data.gradeColor}>{detailDrawer.data.gradeLabel}</Tag>}
                  </Space>
                </Descriptions.Item>
              </Descriptions>

              {detailDrawer.data.riskFlags && (detailDrawer.data.riskFlags.motivationShort || detailDrawer.data.riskFlags.experienceShort) && (
                <Alert
                  style={{ marginBottom: 16 }}
                  type="warning"
                  showIcon
                  message="高风险字段"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {detailDrawer.data.riskFlags.motivationShort && <li>申请动机内容过短（&lt;30 字）</li>}
                      {detailDrawer.data.riskFlags.experienceShort && <li>组织经验内容过短（&lt;20 字）</li>}
                    </ul>
                  }
                />
              )}

              <Tabs
                defaultActiveKey="original"
                items={[
                  {
                    key: 'original',
                    label: '📋 申请原文',
                    children: (
                      <div>
                        <Title level={5}>基本信息</Title>
                        <Descriptions column={1} bordered size="small">
                          <Descriptions.Item label="活动地点">{detailDrawer.data.location || '—'}</Descriptions.Item>
                          <Descriptions.Item label="计划日期">
                            {detailDrawer.data.expectedDate ? new Date(detailDrawer.data.expectedDate).toLocaleString('zh-CN') : '—'}
                          </Descriptions.Item>
                          <Descriptions.Item label="场地状态"><Tag color={detailDrawer.data.venueStatus === '已确定' ? 'green' : 'gold'}>{detailDrawer.data.venueStatus || '—'}</Tag></Descriptions.Item>
                          <Descriptions.Item label="招募渠道">
                            <Space size={4} wrap>
                              {(detailDrawer.data.recruitChannel ?? []).map((ch: string) => (
                                <Tag key={ch} color="blue">{ch}</Tag>
                              ))}
                            </Space>
                          </Descriptions.Item>
                        </Descriptions>
                        <Title level={5} style={{ marginTop: 16 }}>申请动机</Title>
                        <Card size="small" style={{ background: '#F5F8FF' }}>
                          <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                            {detailDrawer.data.motivation || '（未填写）'}
                          </Paragraph>
                        </Card>
                        <Title level={5} style={{ marginTop: 16 }}>对参与者的价值</Title>
                        <Card size="small" style={{ background: '#F5F8FF' }}>
                          <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                            {detailDrawer.data.participantValue || '（未填写）'}
                          </Paragraph>
                        </Card>
                        <Title level={5} style={{ marginTop: 16 }}>组织经验</Title>
                        <Card size="small" style={{ background: '#F5F8FF' }}>
                          <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                            {detailDrawer.data.experience || '（未填写）'}
                          </Paragraph>
                        </Card>
                      </div>
                    ),
                  },
                  {
                    key: 'ai',
                    label: '🤖 AI 评分',
                    children: (
                      <div>
                        {detailDrawer.data.scoreBreakdown ? (
                          <Tabs
                            size="small"
                            tabPosition="top"
                            items={[
                              { key: 'RC001', label: '场地 (RC001)', children: <DimensionPanel data={detailDrawer.data.scoreBreakdown.RC001} max={20} /> },
                              { key: 'RC002', label: '招募 (RC002)', children: <DimensionPanel data={detailDrawer.data.scoreBreakdown.RC002} max={20} /> },
                              { key: 'RC003', label: '经验 (RC003)', children: <DimensionPanel data={detailDrawer.data.scoreBreakdown.RC003} max={25} /> },
                              { key: 'RC004', label: '时间 (RC004)', children: <DimensionPanel data={detailDrawer.data.scoreBreakdown.RC004} max={15} /> },
                              { key: 'RC005', label: '价值 (RC005)', children: <DimensionPanel data={detailDrawer.data.scoreBreakdown.RC005} max={20} /> },
                            ]}
                          />
                        ) : (
                          <Text type="secondary">暂无评分数据</Text>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'log',
                    label: '📜 审核日志',
                    children: (
                      <div>
                        {detailDrawer.data.auditLog && detailDrawer.data.auditLog.length > 0 ? (
                          detailDrawer.data.auditLog.map((log: any, i: number) => (
                            <Card key={i} size="small" style={{ marginBottom: 8 }}>
                              <Space>
                                <Tag color="blue">{log.action}</Tag>
                                <Text type="secondary">{new Date(log.at).toLocaleString('zh-CN')}</Text>
                                {log.operatorId && <Tag color="default">操作人: {log.operatorId}</Tag>}
                              </Space>
                              {log.fromStatus && <div style={{ marginTop: 4, fontSize: 12 }}>{log.fromStatus} → {log.toStatus}</div>}
                              {log.comment && <Paragraph style={{ margin: '4px 0 0' }}>{log.comment}</Paragraph>}
                            </Card>
                          ))
                        ) : (
                          <Text type="secondary">暂无审核记录</Text>
                        )}
                      </div>
                    ),
                  },
                ]}
              />

              {/* AI 草拟意见按钮（v6） */}
              <Card
                size="small"
                style={{ marginTop: 16, background: '#FAFCFF' }}
                title={<Space><RobotOutlined /> AI 草拟审核意见</Space>}
                extra={
                  <Button
                    type="primary"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={async () => {
                      try {
                        const d = await adminApi.draftReview(detailDrawer.appId!);
                        setDraftReview(d.draft);
                        message.success('已草拟');
                      } catch {
                        /* 拦截器已处理 */
                      }
                    }}
                  >
                    一键草拟
                  </Button>
                }
              >
                {draftReview ? (
                  <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{draftReview}</Paragraph>
                ) : (
                  <Text type="secondary">点击"一键草拟"按等级（S/A/B/C/D）生成建议意见，运营/志愿者可在此基础上修改后提交</Text>
                )}
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

function DimensionPanel({ data, max }: { data: any; max: number }) {
  if (!data) return <Text type="secondary">无数据</Text>;
  return (
    <div>
      <Title level={4} style={{ margin: 0, color: '#3370FF' }}>{data.score} <Text type="secondary" style={{ fontSize: 14 }}>/ {max}</Text></Title>
      <Paragraph style={{ marginTop: 8 }}>{data.reason}</Paragraph>
      {data.hitKeywords && (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>命中关键词：</Text>
          {data.hitKeywords.map((kw: string) => (
            <Tag key={kw} color="blue" style={{ marginLeft: 4 }}>{kw}</Tag>
          ))}
        </div>
      )}
      {data.input && (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>输入：</Text>
          <Text code>{data.input}</Text>
        </div>
      )}
    </div>
  );
}
