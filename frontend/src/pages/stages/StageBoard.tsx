/**
 * 5 阶段任务进度看板（切片 4）
 *
 * 角色行为：
 * - ORGANIZER（组织者）：提交凭证 / 修改凭证
 * - VOLUNTEER/OPERATOR/ADMIN：审核（通过/打回+原因 / 优秀推荐）
 *
 * 状态机：PENDING → IN_PROGRESS → COMPLETED / OVERDUE
 * 5 阶段顺序：INTENT → RECRUIT → PREPARE → EXECUTE → REVIEW
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Steps, Button, Tag, Modal, Form, Input, message, Spin, Empty,
  Typography, Space, Divider, Result, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  CheckOutlined, RollbackOutlined, FileTextOutlined, StarOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { stageApi, applicationApi, StageTask } from '../../services/api';
import { authStore } from '../../store/auth';

const { Title, Text, Paragraph } = Typography;

const STAGE_LABELS: Record<string, { title: string; hint: string }> = {
  INTENT:  { title: '确认意向',  hint: 'T-10 志愿者加好友 + 飞书日历登记' },
  RECRUIT: { title: '对外招募',  hint: 'T-7  建群+物料+报名+宣传' },
  PREPARE: { title: '现场筹备',  hint: 'T-5  场地+培训+物料+推文' },
  EXECUTE: { title: '活动执行',  hint: 'T    签到+分享+实操+素材' },
  REVIEW:  { title: '活动复盘',  hint: 'T+3  复盘文档+作品上墙' },
};

const OWNER_LABEL: Record<string, { label: string; color: string }> = {
  ORGANIZER: { label: '组织者', color: 'green' },
  VOLUNTEER: { label: '志愿者', color: 'blue' },
  OPERATOR:  { label: '运营',   color: 'orange' },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:     { label: '待开始',     color: 'default' },
  IN_PROGRESS: { label: '进行中',     color: 'blue' },
  COMPLETED:   { label: '已完成',     color: 'green' },
  OVERDUE:     { label: '已超期',     color: 'red' },
};

const REVIEW_MAP: Record<string, { label: string; color: string }> = {
  PENDING:  { label: '待审核', color: 'gold' },
  APPROVED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已打回', color: 'red' },
};

function statusToStep(s: string): 'wait' | 'process' | 'finish' | 'error' {
  if (s === 'COMPLETED') return 'finish';
  if (s === 'OVERDUE') return 'error';
  if (s === 'IN_PROGRESS') return 'process';
  return 'wait';
}

export default function StageBoard() {
  const { id: applicationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = authStore((s) => s.user);
  const role = user?.role;

  const [tasks, setTasks] = useState<StageTask[]>([]);
  const [appStatus, setAppStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<StageTask | null>(null);
  const [submitForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const reload = async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const [d, app] = await Promise.all([
        stageApi.list(applicationId),
        applicationApi.get(applicationId).catch(() => null),
      ]);
      setTasks(d.list);
      setAppStatus(app?.status || '');
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const handleInit = async () => {
    if (!applicationId) return;
    setInitializing(true);
    try {
      const d = await stageApi.initialize(applicationId);
      message.success(d.message);
      await reload();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setInitializing(false);
    }
  };

  const openSubmit = (t: StageTask) => {
    setActiveTask(t);
    submitForm.setFieldsValue({
      proofFile: t.proofFile || '',
      remark: t.remark || '',
    });
  };

  const openReview = (t: StageTask) => {
    setActiveTask(t);
    reviewForm.resetFields();
  };

  const onSubmit = async () => {
    if (!activeTask) return;
    const v = await submitForm.validateFields();
    setSubmitting(true);
    try {
      await stageApi.submit(activeTask.taskId, v);
      message.success('凭证已提交，等待志愿者审核');
      setActiveTask(null);
      await reload();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setSubmitting(false);
    }
  };

  const onReview = async () => {
    if (!activeTask) return;
    const v = await reviewForm.validateFields();
    if (v.action === 'REJECT' && !v.reviewRemark) {
      message.warning('打回需填写原因');
      return;
    }
    setSubmitting(true);
    try {
      await stageApi.review(activeTask.taskId, {
        action: v.action,
        reviewRemark: v.reviewRemark,
        excellentOrganizer: v.excellentOrganizer,
      });
      message.success(v.action === 'APPROVE' ? '审核通过' : '已打回');
      setActiveTask(null);
      await reload();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && tasks.length === 0) {
    return <Spin style={{ display: 'block', margin: 64 }} />;
  }

  if (tasks.length === 0) {
    return (
      <div>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ padding: 0, marginBottom: 16 }}>
          返回
        </Button>
        <Card style={{ borderRadius: 16 }}>
          <Empty description="尚未初始化 5 阶段任务">
            {(role === 'OPERATOR' || role === 'ADMIN') && (
              <Button type="primary" loading={initializing} onClick={handleInit} className="dw-gradient-btn">
                初始化 5 阶段任务
              </Button>
            )}
            {role === 'ORGANIZER' && (
              <Text type="secondary">请联系运营同学为您初始化 5 阶段任务</Text>
            )}
            {role === 'VOLUNTEER' && (
              <Text type="secondary">志愿者视角：待运营初始化任务后即可在此审核</Text>
            )}
          </Empty>
        </Card>
      </div>
    );
  }

  // 当前阶段（IN_PROGRESS 优先；否则最后一个 PENDING；都无则已全 COMPLETED）
  const currentStepIdx = (() => {
    const idx = tasks.findIndex((t) => t.status === 'IN_PROGRESS');
    if (idx >= 0) return idx;
    const lastPending = tasks.findIndex((t) => t.status === 'PENDING' || t.status === 'OVERDUE');
    if (lastPending >= 0) return lastPending;
    return tasks.length - 1;
  })();

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ padding: 0, marginBottom: 16 }}>
        返回
      </Button>

      <Card style={{ borderRadius: 16, marginBottom: 16 }}>
        <Title level={3} style={{ marginTop: 0 }}>5 阶段任务看板</Title>
        <Space>
          <Text type="secondary">申请编号：</Text>
          <Text code>{applicationId}</Text>
          {appStatus && (
            <Tag color={
              appStatus === 'REVIEW_CONFIRMED' ? 'green' :
              appStatus === 'CONFIRMED' ? 'blue' :
              appStatus === 'REJECTED' ? 'red' : 'default'
            }>{appStatus}</Tag>
          )}
          {appStatus === 'REVIEW_CONFIRMED' && role === 'ORGANIZER' && (
            <Button
              type="primary"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => navigate('/reimbursements')}
              className="dw-gradient-btn"
            >
              提交报销 →
            </Button>
          )}
        </Space>

        <Divider />

        <Steps
          current={currentStepIdx}
          size="small"
          items={tasks.map((t) => {
            const meta = STAGE_LABELS[t.stage] || { title: t.stage, hint: '' };
            return {
              title: meta.title,
              description: (
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {meta.hint}
                  <div style={{ marginTop: 4 }}>
                    <Tag color={STATUS_MAP[t.status]?.color}>{STATUS_MAP[t.status]?.label}</Tag>
                    {t.reviewStatus && (
                      <Tag color={REVIEW_MAP[t.reviewStatus]?.color} style={{ marginLeft: 4 }}>
                        审核：{REVIEW_MAP[t.reviewStatus]?.label}
                      </Tag>
                    )}
                  </div>
                </div>
              ),
              status: statusToStep(t.status),
              icon: t.status === 'COMPLETED' ? <CheckCircleOutlined /> : undefined,
            };
          })}
        />
      </Card>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {tasks.map((t) => {
          const meta = STAGE_LABELS[t.stage] || { title: t.stage, hint: '' };
          const isOverdue = t.status === 'OVERDUE' || (t.dueDate && t.status !== 'COMPLETED' && t.dueDate < Date.now());
          const ownerInfo = OWNER_LABEL[t.ownerType ?? 'ORGANIZER'];
          // v6：不同 ownerType 的权限不同
          const canSubmit = (role === 'ORGANIZER' || role === 'VOLUNTEER' || role === 'OPERATOR' || role === 'ADMIN')
            && t.ownerType === role
            && t.status !== 'COMPLETED'
            && t.status !== 'OVERDUE';
          const canReview = (role === 'VOLUNTEER' || role === 'OPERATOR' || role === 'ADMIN')
            && t.ownerType === 'ORGANIZER'
            && t.status === 'IN_PROGRESS'
            && t.reviewStatus !== 'APPROVED';

          return (
            <Card
              key={t.taskId}
              style={{ borderRadius: 16 }}
              title={
                <Space wrap>
                  {t.status === 'COMPLETED' ? <CheckCircleOutlined style={{ color: '#10B981' }} /> : <span style={{ color: '#9CA3AF' }}>{t.order}️⃣</span>}
                  <span><Tag color="blue">{t.subTaskName ?? t.title}</Tag></span>
                  <Tag color={ownerInfo?.color}>{ownerInfo?.label ?? t.ownerType}</Tag>
                  <Tag color={STATUS_MAP[t.status]?.color}>{STATUS_MAP[t.status]?.label}</Tag>
                  {t.reviewStatus && (
                    <Tag color={REVIEW_MAP[t.reviewStatus]?.color}>审核：{REVIEW_MAP[t.reviewStatus]?.label}</Tag>
                  )}
                </Space>
              }
              extra={
                <Space>
                  {t.dueDate && (
                    <Text type={isOverdue ? 'danger' : 'secondary'} style={{ fontSize: 13 }}>
                      截止 {dayjs(t.dueDate).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  )}
                </Space>
              }
            >
              <Paragraph style={{ color: '#374151' }}>{t.description}</Paragraph>

              {(t.proofFile || t.remark) && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    <div>
                      {t.remark && <div><b>凭证说明：</b>{t.remark}</div>}
                      {t.proofFile && <div><b>凭证链接：</b><a href={t.proofFile} target="_blank" rel="noreferrer">{t.proofFile}</a></div>}
                      {t.submittedAt && <div style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>提交时间：{dayjs(t.submittedAt).format('YYYY-MM-DD HH:mm')}</div>}
                    </div>
                  }
                />
              )}

              {t.reviewRemark && (
                <Alert
                  type={t.reviewStatus === 'APPROVED' ? 'success' : 'warning'}
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    <div>
                      <b>审核意见：</b>{t.reviewRemark}
                      {t.reviewerId && <span style={{ color: '#6B7280', marginLeft: 8 }}>by {t.reviewerId}</span>}
                    </div>
                  }
                />
              )}

              {t.completedAt && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ✅ 完成时间：{dayjs(t.completedAt).format('YYYY-MM-DD HH:mm')}
                </Text>
              )}

              <Divider style={{ margin: '12px 0' }} />

              <Space>
                {canSubmit && (
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => openSubmit(t)}
                    className="dw-gradient-btn"
                  >
                    {t.submittedAt ? '修改凭证' : '提交凭证'}
                  </Button>
                )}
                {canReview && (
                  <>
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => {
                        reviewForm.setFieldsValue({ action: 'APPROVE' });
                        openReview(t);
                      }}
                      style={{ background: '#10B981', borderColor: '#10B981' }}
                    >
                      审核通过
                    </Button>
                    <Button
                      danger
                      icon={<RollbackOutlined />}
                      onClick={() => {
                        reviewForm.setFieldsValue({ action: 'REJECT' });
                        openReview(t);
                      }}
                    >
                      打回
                    </Button>
                  </>
                )}
                {!canSubmit && !canReview && (
                  <Text type="secondary" style={{ fontSize: 12 }}>本阶段无操作权限</Text>
                )}
              </Space>
            </Card>
          );
        })}
      </Space>

      {/* 提交凭证 Modal */}
      <Modal
        title={activeTask ? `提交凭证 · ${STAGE_LABELS[activeTask.stage]?.title || activeTask.stage}` : ''}
        open={!!activeTask && !reviewForm.isFieldsTouched()}
        onCancel={() => setActiveTask(null)}
        onOk={onSubmit}
        confirmLoading={submitting}
        okText="提交"
        cancelText="取消"
      >
        <Form form={submitForm} layout="vertical">
          <Form.Item
            name="proofFile"
            label="凭证链接（飞书云文档/图片等）"
            rules={[{ type: 'url', message: '请填写正确的 URL' }]}
          >
            <Input placeholder="https://example.com/proof.png" />
          </Form.Item>
          <Form.Item
            name="remark"
            label="凭证说明"
            rules={[{ max: 500 }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount placeholder="如：飞书日历已登记 + 飞书好友已加" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 审核 Modal */}
      <Modal
        title={activeTask ? `审核 · ${STAGE_LABELS[activeTask.stage]?.title || activeTask.stage}` : ''}
        open={!!activeTask && reviewForm.isFieldsTouched()}
        onCancel={() => { setActiveTask(null); reviewForm.resetFields(); }}
        onOk={onReview}
        confirmLoading={submitting}
        okText="确认"
        cancelText="取消"
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="action" hidden>
            <Input />
          </Form.Item>

          <div style={{ background: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <div><b>当前操作：</b>{reviewForm.getFieldValue('action') === 'APPROVE' ? '✅ 审核通过' : '↩️ 打回'}</div>
            {activeTask?.remark && <div style={{ marginTop: 8 }}><b>组织者说明：</b>{activeTask.remark}</div>}
            {activeTask?.proofFile && (
              <div style={{ marginTop: 8 }}><b>凭证：</b><a href={activeTask.proofFile} target="_blank" rel="noreferrer">{activeTask.proofFile}</a></div>
            )}
          </div>

          <Form.Item
            name="reviewRemark"
            label="审核意见"
            rules={[
              {
                validator: (_, v) => {
                  if (reviewForm.getFieldValue('action') === 'REJECT' && !v) {
                    return Promise.reject(new Error('打回需填写原因'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount placeholder="如：凭证清晰、符合要求 / 海报不够清晰，请重新设计" />
          </Form.Item>

          {activeTask?.stage === 'REVIEW' && reviewForm.getFieldValue('action') === 'APPROVE' && (
            <Form.Item
              name="excellentOrganizer"
              label={<span><StarOutlined style={{ color: '#F59E0B' }} /> 推荐优秀组织者（仅 REVIEW 阶段）</span>}
            >
              <Input.Group compact>
                <Button onClick={() => reviewForm.setFieldValue('excellentOrganizer', 'Y')} style={{ width: '50%' }}>⭐ 是</Button>
                <Button onClick={() => reviewForm.setFieldValue('excellentOrganizer', 'N')} style={{ width: '50%' }}>否</Button>
              </Input.Group>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
