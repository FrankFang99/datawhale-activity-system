/**
 * 报销中心（切片 5 · PRD §5.2 / US-O8 / US-P6）
 *
 * 角色视图：
 * - ORGANIZER：默认"我的报销"tab；可点击"提交新报销"
 * - OPERATOR/ADMIN：默认"待审列表"tab，可审核 + 标记打款
 * - VOLUNTEER：可看到待审列表，可审核
 *
 * 状态：DRAFT → SUBMITTED → APPROVED → PAID
 *                  └─ REJECTED
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Tabs, Table, Tag, Button, Modal, Form, Input, InputNumber,
  message, Empty, Spin, Typography, Space, Divider, Alert, Result,
} from 'antd';
import {
  PlusOutlined, CheckOutlined, CloseOutlined, DollarOutlined,
  FileTextOutlined, RollbackOutlined, RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reimbursementApi, Reimbursement, activityApi, applicationApi, Activity } from '../../services/api';
import { authStore } from '../../store/auth';
import PageHeader from '../../components/PageHeader';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: '草稿',     color: 'default' },
  SUBMITTED: { label: '待审核',   color: 'gold' },
  APPROVED:  { label: '已审核',   color: 'blue' },
  REJECTED:  { label: '已打回',   color: 'red' },
  PAID:      { label: '已打款',   color: 'green' },
};

const MAX_AMOUNT = 10000;

export default function ReimbursementCenter() {
  const navigate = useNavigate();
  const user = authStore((s) => s.user);
  const role = user?.role;

  const [mine, setMine] = useState<Reimbursement[]>([]);
  const [pending, setPending] = useState<Reimbursement[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<Reimbursement | null>(null);
  const [payTarget, setPayTarget] = useState<Reimbursement | null>(null);
  const [submitForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [payForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const isApprover = role === 'OPERATOR' || role === 'ADMIN' || role === 'VOLUNTEER';
  const isPayer = role === 'OPERATOR' || role === 'ADMIN';

  const loadMine = async () => {
    setLoadingMine(true);
    try { setMine((await reimbursementApi.mine()).list); } catch {} finally { setLoadingMine(false); }
  };
  const loadPending = async () => {
    setLoadingPending(true);
    try { setPending((await reimbursementApi.pending()).list); } catch {} finally { setLoadingPending(false); }
  };

  useEffect(() => {
    loadMine();
    if (isApprover) loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 提交新报销 =====
  const onSubmit = async () => {
    const v = await submitForm.validateFields();
    setSubmitting(true);
    try {
      const d = await reimbursementApi.submit({
        applicationId: v.applicationId,
        amount: v.amount,
        description: v.description,
        receipts: v.receipts ? v.receipts.split('\n').filter((s: string) => s.trim()) : [],
      });
      message.success(d.message);
      setSubmitOpen(false);
      submitForm.resetFields();
      await loadMine();
      if (isApprover) await loadPending();
    } catch {} finally { setSubmitting(false); }
  };

  // ===== 审核 =====
  const onReview = async () => {
    if (!reviewTarget) return;
    const v = await reviewForm.validateFields();
    if (v.action === 'REJECT' && !v.reviewRemark) {
      message.warning('打回需填写原因');
      return;
    }
    setSubmitting(true);
    try {
      await reimbursementApi.review(reviewTarget.recordId, { action: v.action, reviewRemark: v.reviewRemark });
      message.success(v.action === 'APPROVE' ? '审核通过' : '已打回');
      setReviewTarget(null);
      reviewForm.resetFields();
      await loadPending();
      await loadMine();
    } catch {} finally { setSubmitting(false); }
  };

  // ===== 标记打款 =====
  const onPay = async () => {
    if (!payTarget) return;
    const v = await payForm.validateFields();
    setSubmitting(true);
    try {
      await reimbursementApi.pay(payTarget.recordId, v.paymentRef);
      message.success('已标记打款');
      setPayTarget(null);
      payForm.resetFields();
      await loadPending();
      await loadMine();
    } catch {} finally { setSubmitting(false); }
  };

  // 表格列
  const baseColumns = [
    { title: '报销单', dataIndex: 'reimbursementId', key: 'reimbursementId', render: (v: string) => <Text code>{v}</Text> },
    { title: '申请', dataIndex: 'applicationId', key: 'applicationId', render: (v: string) => <Button type="link" size="small" onClick={() => navigate(`/applications/${v}/tasks`)}>{v}</Button> },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: (a: number) => <strong style={{ color: '#3370FF' }}>¥ {a.toLocaleString()}</strong> },
    { title: '事由', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label ?? s}</Tag>,
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (t?: number) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const mineColumns = [
    ...baseColumns,
    {
      title: '审核/打款',
      key: 'audit',
      render: (_: any, r: Reimbursement) => {
        if (r.status === 'REJECTED' && r.reviewRemark) {
          return <Text type="danger" style={{ fontSize: 12 }}>打回：{r.reviewRemark}</Text>;
        }
        if (r.status === 'PAID' && r.paymentRef) {
          return <Text style={{ fontSize: 12 }}>流水号：<Text code>{r.paymentRef}</Text></Text>;
        }
        if (r.status === 'APPROVED') {
          return <Text type="secondary" style={{ fontSize: 12 }}>待运营打款</Text>;
        }
        return '-';
      },
    },
  ];

  const pendingColumns = [
    ...baseColumns,
    {
      title: '操作',
      key: 'actions',
      render: (_: any, r: Reimbursement) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => {
              reviewForm.setFieldsValue({ action: 'APPROVE' });
              setReviewTarget(r);
            }}
            style={{ background: '#10B981', borderColor: '#10B981' }}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => {
              reviewForm.setFieldsValue({ action: 'REJECT' });
              setReviewTarget(r);
            }}
          >
            打回
          </Button>
        </Space>
      ),
    },
  ];

  const approvedColumns = [
    ...baseColumns,
    {
      title: '操作',
      key: 'actions',
      render: (_: any, r: Reimbursement) => (
        isPayer ? (
          <Button
            type="primary"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => setPayTarget(r)}
            className="dw-gradient-btn"
          >
            标记打款
          </Button>
        ) : <Text type="secondary" style={{ fontSize: 12 }}>仅运营/ADMIN 可打款</Text>
      ),
    },
  ];

  const approvedList = pending.filter((r) => r.status === 'APPROVED');

  return (
    <div>
      <PageHeader
        title="报销中心"
        subtitle="提交发票 / 审核 / 标记打款（v1 简化：URL 列表凭证）"
      />

      <Card style={{ marginTop: 16, borderRadius: 16 }}>
        <Tabs
          defaultActiveKey={isApprover ? 'pending' : 'mine'}
          items={[
            {
              key: 'mine',
              label: <span><FileTextOutlined /> 我的报销</span>,
              children: (
                <Spin spinning={loadingMine}>
                  {mine.length === 0 ? (
                    <Empty description="您还没有提交过报销">
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setSubmitOpen(true)} className="dw-gradient-btn">
                        提交新报销
                      </Button>
                      <div style={{ marginTop: 16 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          💡 报销需要在申请进入 REVIEW_CONFIRMED 状态后提交
                        </Text>
                      </div>
                    </Empty>
                  ) : (
                    <>
                      <Space style={{ marginBottom: 16 }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setSubmitOpen(true)} className="dw-gradient-btn">
                          提交新报销
                        </Button>
                      </Space>
                      <Table rowKey="recordId" dataSource={mine} columns={mineColumns} pagination={false} size="small" />
                    </>
                  )}
                </Spin>
              ),
            },
            ...(isApprover ? [
              {
                key: 'pending',
                label: <span><FileTextOutlined /> 待审列表 ({pending.length})</span>,
                children: (
                  <Spin spinning={loadingPending}>
                    {pending.length === 0 ? (
                      <Empty description="暂无待审报销" />
                    ) : (
                      <Table rowKey="recordId" dataSource={pending} columns={pendingColumns} pagination={false} size="small" />
                    )}
                  </Spin>
                ),
              },
              {
                key: 'approved',
                label: <span><DollarOutlined /> 待打款 ({approvedList.length})</span>,
                children: (
                  <Spin spinning={loadingPending}>
                    {approvedList.length === 0 ? (
                      <Empty description="暂无待打款报销" />
                    ) : (
                      <Table rowKey="recordId" dataSource={approvedList} columns={approvedColumns} pagination={false} size="small" />
                    )}
                  </Spin>
                ),
              },
            ] : []),
          ]}
        />
      </Card>

      {/* 提交报销 Modal */}
      <Modal
        title="提交新报销"
        open={submitOpen}
        onCancel={() => setSubmitOpen(false)}
        onOk={onSubmit}
        confirmLoading={submitting}
        okText="提交"
        cancelText="取消"
        width={600}
      >
        <Alert
          message="v1 简化：URL 列表代替 OCR；单次报销金额 1-10000 元"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={submitForm} layout="vertical">
          <Form.Item
            name="applicationId"
            label="关联申请编号"
            rules={[{ required: true, message: '请填写申请编号（如 NO.001）' }]}
          >
            <Input placeholder="NO.001" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="报销金额（元）"
            rules={[
              { required: true, message: '请输入金额' },
              { type: 'number', min: 1, max: MAX_AMOUNT, message: `金额需在 1-${MAX_AMOUNT} 之间` },
            ]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="1000" min={1} max={MAX_AMOUNT} step={100} />
          </Form.Item>
          <Form.Item
            name="description"
            label="报销事由"
            rules={[{ required: true, max: 500 }]}
          >
            <TextArea rows={3} maxLength={500} showCount placeholder="如：活动物料采购（海报/横幅/小礼品）" />
          </Form.Item>
          <Form.Item
            name="receipts"
            label="凭证 URL 列表（每行一个，v1 简化）"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>v2 升级：直接上传图片，自动 OCR 识别金额</Text>}
          >
            <TextArea rows={3} placeholder="https://example.com/receipt1.png&#10;https://example.com/receipt2.png" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 审核 Modal */}
      <Modal
        title={`审核报销 · ${reviewTarget?.reimbursementId || ''}`}
        open={!!reviewTarget}
        onCancel={() => { setReviewTarget(null); reviewForm.resetFields(); }}
        onOk={onReview}
        confirmLoading={submitting}
        okText="确认"
        cancelText="取消"
      >
        {reviewTarget && (
          <div style={{ background: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <div><b>金额：</b>¥{reviewTarget.amount.toLocaleString()}</div>
            <div><b>事由：</b>{reviewTarget.description}</div>
            {reviewTarget.receipts?.length > 0 && (
              <div><b>凭证：</b>
                {reviewTarget.receipts.map((u, i) => (
                  <div key={i}><a href={u} target="_blank" rel="noreferrer">{u}</a></div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 4 }}><b>当前操作：</b>{reviewForm.getFieldValue('action') === 'APPROVE' ? '✅ 通过' : '↩️ 打回'}</div>
          </div>
        )}
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="action" hidden><Input /></Form.Item>
          <Form.Item
            name="reviewRemark"
            label="审核意见"
            rules={[{
              validator: (_, v) => reviewForm.getFieldValue('action') === 'REJECT' && !v
                ? Promise.reject(new Error('打回需填写原因'))
                : Promise.resolve(),
            }]}
          >
            <TextArea rows={3} maxLength={500} showCount placeholder="如：发票齐全 / 海报不清晰，请重新提供" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 打款 Modal */}
      <Modal
        title={`标记打款 · ${payTarget?.reimbursementId || ''}`}
        open={!!payTarget}
        onCancel={() => { setPayTarget(null); payForm.resetFields(); }}
        onOk={onPay}
        confirmLoading={submitting}
        okText="确认打款"
        cancelText="取消"
      >
        {payTarget && (
          <Alert
            type="warning"
            showIcon
            message={`即将标记 ¥${payTarget.amount.toLocaleString()} 打款给 ${payTarget.organizerName || payTarget.organizerId}，请确认已实际打款并填写流水号`}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={payForm} layout="vertical">
          <Form.Item
            name="paymentRef"
            label="打款流水号"
            rules={[{ required: true, max: 100, message: '请填写打款流水号' }]}
          >
            <Input placeholder="如 TX-2026-001 / 微信转账单号 / 银行流水号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
