/**
 * 活动管理（PRD §4.2.3 · v6）— ADMIN / OPERATOR 专用
 * 活动列表 + 创建/编辑表单 + 上架/下架/归档
 *
 * Frank 2026-08-22 20:25 反馈：
 *   1. 所属系列 必填
 *   2. 时间双轨：确定组织者前用模糊日期；确定组织者后用精确到天/小时 + 精确地址
 *   3. 地点用下拉精确到"区"（省·市·区三级 Cascader）
 */
import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, DatePicker, TimePicker, InputNumber, Select, Cascader, message, Typography, Popconfirm, Tabs, Alert, Upload,
} from 'antd';
import { PlusOutlined, EditOutlined, CheckCircleOutlined, StopOutlined, InboxOutlined, EyeOutlined, UploadOutlined, LoadingOutlined, UserAddOutlined, SwapOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import http, { adminApi } from '../../services/api';

const { Title, Text } = Typography;
// v1.2 Frank 19:38 Comment 1：地点 Cascader 用全国 31 省 + 333 地级市（民政部 2024 数据精简）
// 2 级 Cascader：省 → 市（区/商圈级别在"精确地址"字段手填）
import { CHINA_REGIONS } from '../../data/china-regions';
const LOCATION_OPTIONS = CHINA_REGIONS;

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: '草稿',     color: 'default' },
  PENDING:   { label: '待确定',   color: 'default' },
  PUBLISHED: { label: '已发布',   color: 'green' },
  ONGOING:   { label: '进行中',   color: 'blue' },
  FINISHED:  { label: '已结束',   color: 'default' },
  ARCHIVED:  { label: '已归档',   color: 'default' },
  CANCELLED: { label: '已取消',   color: 'red' },
};

interface Activity {
  activityId: string;
  title: string;
  status: string;
  series?: string;
  startDate?: number;
  endDate?: number;
  startTime?: number;  // v10：精确开始时间（HH:MM ms since epoch）
  endTime?: number;    // v10：精确结束时间
  location?: string;   // 模糊地点（确认前）
  confirmedAddress?: string;  // v10：精确地址（确认后）
  maxParticipants?: number;
  description?: string;
  requirements?: string;
  groupQrCode?: string;
  coverImage?: string;  // v16.6 Frank 16:04 Comment 6：活动大厅封面图
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

export default function ActivityManager() {
  const [formErrorMsg, setFormErrorMsg] = useState('');
  const [list, setList] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');
  // Frank 27 19:27 反馈：活动管理页加"志愿者配置"按钮（v3）
  const [volunteerConfig, setVolunteerConfig] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null });

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listActivities();
      setList(data.list.map((a: any) => ({ ...a, status: normStatus(a.status) })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ maxParticipants: 50 });
    setModalOpen(true);
  };

  const onEdit = (a: Activity) => {
    setEditing(a);
    form.setFieldsValue({
      title: a.title,
      series: a.series,
      description: a.description,
      // v10 地点：Cascader 数组格式（[省, 市, 区]），兼容老数据（字符串）
      location: a.location?.includes('·') ? a.location.split('·') : a.location,
      startDate: a.startDate ? dayjs(a.startDate) : undefined,
      endDate: a.endDate ? dayjs(a.endDate) : undefined,
      startTime: a.startTime ? dayjs(a.startTime) : undefined,
      endTime: a.endTime ? dayjs(a.endTime) : undefined,
      confirmedAddress: a.confirmedAddress,
      maxParticipants: a.maxParticipants,
      requirements: a.requirements,
      groupQrCode: a.groupQrCode,
      // v16.6 Frank 16:04 Comment 6：活动大厅图片背景不能用 → 运营能管理 coverImage
      coverImage: a.coverImage,
    });
    setModalOpen(true);
  };

  // 字段名 → 中文标签（错误提示用）
  // v1.2 Frank 19:55：Modal 顶部 Alert + 字段红框 + 自动 focus（不依赖 toast 自动消失）
  const showFieldError = (name: string, msg: string) => {
    setFormErrorMsg(`请检查「${labelOf(name)}」：${msg}`);
  };

  const labelOf = (name: string) => {
    const map: Record<string, string> = {
      title: '活动标题',
      series: '所属系列',
      startDate: '开始日期',
      endDate: '结束日期',
      startTime: '精确开始时间',
      endTime: '精确结束时间',
      confirmedAddress: '精确地址',
      location: '地点',
      maxParticipants: '最大参与人数',
      description: '活动介绍',
      requirements: '申请要求',
      groupQrCode: '飞书群二维码',
      coverImage: '活动大厅封面图',
    };
    return map[name] ?? name;
  };

  const onSubmit = async () => {
    let v;
    try {
      // v1.2 Frank 19:14 Comment 2 + 19:38 Comment 3：validateFields 失败要把错误显出来
      v = await form.validateFields();
    } catch (err: any) {
      // 第一个校验失败的字段：Modal 顶部 Alert + 滚动到 + 高亮 + 自动 focus
      const firstError = err?.errorFields?.[0];
      if (firstError) {
        const fname = firstError.name;
        const fmsg = firstError.errors?.[0] ?? '表单校验失败';
        showFieldError(fname, fmsg);
        form.scrollToField(fname);
        // 同步用 toast 也提示一下（兜底）
        message.error({
          content: `请检查「${labelOf(fname)}」：${fmsg}`,
          duration: 6,
          key: 'form-validate-err',
        });
        setTimeout(() => {
          try { form.getFieldInstance?.(fname)?.focus?.(); } catch { /* */ }
        }, 100);
      } else {
        setFormErrorMsg('表单校验失败');
        message.error({ content: '表单校验失败', duration: 6, key: 'form-validate-err' });
      }
      throw err;  // 让 antd Modal 知道失败
    }
    // v10 地点：数组 → 字符串（如 ["北京", "海淀区", "中关村"] → "北京·海淀区·中关村"）
    let locationStr = v.location;
    if (Array.isArray(v.location)) {
      locationStr = v.location.filter(Boolean).join('·');
    }
    const data: any = {
      title: v.title,
      series: v.series,
      description: v.description,
      location: locationStr,
      startDate: v.startDate ? v.startDate.valueOf() : undefined,
      endDate: v.endDate ? v.endDate.valueOf() : undefined,
      // v10 精确时间：后端 schema 期望 HH:mm 字符串格式
      startTime: v.startTime ? v.startTime.format('HH:mm') : undefined,
      endTime: v.endTime ? v.endTime.format('HH:mm') : undefined,
      confirmedAddress: v.confirmedAddress,
      maxParticipants: v.maxParticipants,
      requirements: v.requirements,
      groupQrCode: v.groupQrCode,
      // v16.6 Frank 16:04 Comment 6：活动大厅图片管理
      coverImage: v.coverImage,
    };
    try {
      if (editing) {
        await adminApi.updateActivity(editing.activityId, data);
        message.success('已更新');
      } else {
        await adminApi.createActivity(data);
        message.success('已创建（草稿）');
      }
      setModalOpen(false);
      setFormErrorMsg('');
      load();
    } catch (err: any) {
      // v1.2 Frank 2026-08-26 20:08：API 错误也要显式显示，不再静默吞
      console.error('[ActivityManager] save error:', err);
      const apiMsg = err?.response?.data?.message ?? err?.message ?? '保存失败，请重试';
      setFormErrorMsg(`保存失败：${apiMsg}`);
      message.error({ content: `保存失败：${apiMsg}`, duration: 6, key: 'save-err' });
    }
  };

  const onPublish = async (a: Activity) => {
    try {
      await adminApi.publishActivity(a.activityId);
      message.success(`已上架：${a.title}`);
      load();
    } catch { /* */ }
  };

  const onUnpublish = async (a: Activity) => {
    try {
      await adminApi.unpublishActivity(a.activityId);
      message.success(`已下架：${a.title}`);
      load();
    } catch { /* */ }
  };

  const onArchive = async (a: Activity) => {
    try {
      await adminApi.archiveActivity(a.activityId);
      message.success(`已归档：${a.title}`);
      load();
    } catch { /* */ }
  };

  // Frank 28 14:39 反馈：硬删除活动（级联删申请/子任务/消息/报销/参与者，不可恢复）
  const onDelete = async (a: Activity) => {
    try {
      const r = await adminApi.deleteActivity(a.activityId);
      message.success(`已删除：${a.title}（${r.message}）`, 5);
      load();
    } catch { /* 拦截器已处理 */ }
  };

  const filteredList = filter === 'ALL' ? list : list.filter((a) => a.status === filter);

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>活动管理</Title>
      <Text type="secondary">运营/管理员创建、编辑、上架、下架活动（PRD §4.2.3）</Text>

      <Card style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>创建活动</Button>
          <Tabs
            size="small"
            activeKey={filter}
            onChange={setFilter}
            items={[
              { key: 'ALL', label: `全部 (${list.length})` },
              { key: 'DRAFT', label: `草稿 (${list.filter((a) => a.status === 'DRAFT').length})` },
              { key: 'PUBLISHED', label: `已发布 (${list.filter((a) => a.status === 'PUBLISHED').length})` },
              { key: 'PENDING', label: `待确定 (${list.filter((a) => a.status === 'PENDING').length})` },
              { key: 'ARCHIVED', label: `已归档 (${list.filter((a) => a.status === 'ARCHIVED').length})` },
            ]}
          />
        </Space>

        <Table
          size="small"
          rowKey="activityId"
          loading={loading}
          dataSource={filteredList}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '活动 ID', dataIndex: 'activityId', width: 100 },
            { title: '标题', dataIndex: 'title', width: 220 },
            { title: '系列', dataIndex: 'series', width: 120, render: (s) => s ? <Tag color="purple">{s}</Tag> : '—' },
            {
              title: '状态',
              dataIndex: 'status',
              width: 90,
              render: (s) => {
                const d = STATUS_DISPLAY[s] ?? { label: s, color: 'default' };
                return <Tag color={d.color}>{d.label}</Tag>;
              },
            },
            {
              title: '时间',
              width: 180,
              render: (_: any, a: Activity) =>
                a.startDate ? `${dayjs(a.startDate).format('YYYY-MM-DD')} ~ ${dayjs(a.endDate).format('YYYY-MM-DD')}` : '—',
            },
            { title: '地点', dataIndex: 'location', width: 120 },
            { title: '规模', dataIndex: 'maxParticipants', width: 60 },
            {
              title: '操作',
              width: 320,
              render: (_: any, a: Activity) => (
                <Space size="small" wrap>
                  <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(a)}>编辑</Button>
                  <Button size="small" icon={<UserAddOutlined />} onClick={() => setVolunteerConfig({ open: true, activity: a })}>
                    志愿者配置
                  </Button>
                  {a.status !== 'PUBLISHED' && (
                    <Popconfirm title="确认上架？" onConfirm={() => onPublish(a)}>
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />}>上架</Button>
                    </Popconfirm>
                  )}
                  {a.status === 'PUBLISHED' && (
                    <Popconfirm title="确认下架？已有申请不受影响" onConfirm={() => onUnpublish(a)}>
                      <Button size="small" icon={<StopOutlined />}>下架</Button>
                    </Popconfirm>
                  )}
                  {a.status !== 'ARCHIVED' && (
                    <Popconfirm title="确认归档？" onConfirm={() => onArchive(a)}>
                      <Button size="small" icon={<InboxOutlined />}>归档</Button>
                    </Popconfirm>
                  )}
                  {/*
                    Frank 28 14:39 反馈：硬删除按钮（红色 danger + 二次确认）
                    - 不可恢复：级联删申请/子任务/消息/报销/参与者
                    - 仅 ADMIN 可见（后端 requireRole('ADMIN')）
                    - 演示活动 NO.018/NO.045 不要删（演示用）
                    - 推荐：不需要的活动先归档（可恢复），确认无用再硬删
                  */}
                  <Popconfirm
                    title={
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ 硬删除活动「{a.title}」？</div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          将一并删除：相关申请 / 5 阶段子任务 / 站内消息 / 报销记录 / 参与者
                        </div>
                        <div style={{ fontSize: 12, color: '#cf1322', marginTop: 4 }}>
                          <b>此操作不可恢复</b>，确认无用后再删除。
                        </div>
                      </div>
                    }
                    okText="确认删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => onDelete(a)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? `编辑活动：${editing.title}` : '创建活动'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setFormErrorMsg(''); }}
        onOk={onSubmit}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        {/* v1.2 Frank 2026-08-26 20:08：Modal 顶部错误 Alert（不依赖 toast 自动消失）
            之前 formErrorMsg state 定义但 UI 没渲染 → Frank 看不到保存失败的提示 */}
        {formErrorMsg && (
          <Alert
            type="error"
            showIcon
            closable
            onClose={() => setFormErrorMsg('')}
            message={formErrorMsg}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="活动标题" rules={[{ required: true, max: 100 }]}>
            <Input placeholder="例：AI+X 创造节 - 北京大学站" />
          </Form.Item>
          {/* Frank 2026-08-22 20:25：所属系列 必填 */}
          <Form.Item name="series" label="所属系列" tooltip="如：AI+X 创造节" rules={[{ required: true, message: '请填写所属系列' }]}>
            <Input placeholder="例：AI+X 创造节" />
          </Form.Item>

          {/* Frank 2026-08-22 20:25：时间双轨 · 模糊日期范围 */}
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="时间双轨：还没确定组织者时填模糊日期范围；确定组织者后补充精确时间和精确地址"
          />
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="startDate" label="开始日期" style={{ flex: 1 }}>
              {/* v1.2 Frank 19:14 Comment 1：活动只能选未来日期（不能选今天之前） */}
              <DatePicker
                style={{ width: '100%' }}
                placeholder="例：2024-10-16"
                disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
              />
            </Form.Item>
            <Form.Item name="endDate" label="结束日期" style={{ flex: 1 }} dependencies={['startDate']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, v) {
                    const s = getFieldValue('startDate');
                    if (v && s && v.isBefore(s)) {
                      return Promise.reject(new Error('结束日期必须 ≥ 开始日期'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}>
              <DatePicker
                style={{ width: '100%' }}
                placeholder="例：2024-11-15"
                disabledDate={(d) => {
                  // 1. 不能选今天之前
                  if (d && d.isBefore(dayjs().startOf('day'))) return true;
                  // 2. 不能选开始日期之前（如果填了开始日期）
                  const start = form.getFieldValue('startDate');
                  if (start && d && d.isBefore(start, 'day')) return true;
                  return false;
                }}
              />
            </Form.Item>
          </Space>

          {/* v1.2 Frank 17:08 Comment 3：精确时间只在「编辑已有活动」时显示
              创建活动时只填日期 + 模糊地点；精确时间由组织者在 INT-1 任务确认意向时补 */}
          {editing && (
            <Form.Item shouldUpdate={(p, c) => p.startDate !== c.startDate || p.endDate !== c.endDate} noStyle>
              {() => {
                const sd = form.getFieldValue('startDate');
                const ed = form.getFieldValue('endDate');
                const showPrecise = !!(sd && ed);
                return showPrecise ? (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="精确时间由组织者在 INT-1「确认意向」任务时填写（v1.2 Frank 17:08 Comment 3）"
                    />
                    <Space style={{ width: '100%' }} size="middle">
                      <Form.Item name="startTime" label="精确开始时间" style={{ flex: 1 }} tooltip="组织者在 INT-1 阶段补填">
                        <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="例：14:00" />
                      </Form.Item>
                      <Form.Item name="endTime" label="精确结束时间" style={{ flex: 1 }}>
                        <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="例：17:00" />
                      </Form.Item>
                    </Space>
                    <Form.Item
                      name="confirmedAddress"
                      label="精确地址（可选）"
                      tooltip="确定场所后补充填写（如：上海交大闵行校区 学术活动中心 3F-301）"
                    >
                      <Input placeholder="例：上海交大闵行校区 学术活动中心 3F-301" maxLength={200} />
                    </Form.Item>
                  </>
                ) : null;
              }}
            </Form.Item>
          )}

          <Space style={{ width: '100%' }} size="middle">
            {/* Frank 2026-08-22 20:25：地点用 Cascader 下拉，精确到区/商圈 */}
            <Form.Item name="location" label="地点" style={{ flex: 1 }} tooltip="v1.2 全国 32 省 + 361 地级市（区/商圈在「精确地址」字段手填）">
              <Cascader
                options={LOCATION_OPTIONS}
                placeholder="例：北京 / 海淀区（中关村/学院路等在「精确地址」补充）"
                showSearch
                allowClear
              />
            </Form.Item>
            <Form.Item name="maxParticipants" label="最大参与人数" style={{ width: 160 }}>
              <InputNumber min={1} max={500} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="活动介绍">
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="requirements" label="申请要求">
            <Input.TextArea rows={2} maxLength={1000} showCount />
          </Form.Item>
          <Form.Item
            name="groupQrCode"
            label="飞书群二维码 URL"
            tooltip="运营在飞书云空间上传二维码图片后复制图片 URL 粘贴；接受 feishu.cn / larksuite.com 群链接、QR 图 URL、base64 QR 图（data:image/...;base64,...）"
            rules={[
              { required: true, message: '请填写飞书群二维码（必填，活动详情页扫码加群按钮依赖此字段）' },
              {
                pattern: /^(https:\/\/([\w-]+\.)?(feishu\.cn|larksuite\.com)\/|data:image\/(png|jpe?g|gif|webp);base64,|https:\/\/.+)/i,
                message: '请填写有效的飞书群链接（feishu.cn 或 larksuite.com 域名）或飞书群 QR 图 URL（https:// 开头）',
              },
            ]}
          >
            <Input.TextArea
              rows={2}
              placeholder="例如：https://feishu.cn/group/oc_xxxxxx （运营手工创建群后复制群链接粘贴）"
              maxLength={2000}
            />
          </Form.Item>
          {/* v1.2 Frank 17:08 Comment 2：封面图改 Upload 组件（后端 /api/upload/image v16.8 已就绪） */}
          <Form.Item
            name="coverImage"
            label="活动大厅封面图（可选）"
            tooltip="活动大厅卡片封面图（160px 高度）。支持 jpg/png/gif/webp，≤5MB。也可填 https:// 开头的 URL（推荐 placehold.co / Unsplash / CDN）"
          >
            <Upload {...{
              name: 'file',
              action: '/api/upload/image',
              headers: { Authorization: `Bearer ${localStorage.getItem('datawhale-auth') ? JSON.parse(localStorage.getItem('datawhale-auth')!).state.token : ''}` },
              accept: 'image/*',
              listType: 'picture',
              showUploadList: { showPreviewIcon: true, showRemoveIcon: true },
              beforeUpload: (file: any) => {
                if (!file.type.startsWith('image/')) {
                  message.error('只支持图片文件（jpg/png/gif/webp）');
                  return Upload.LIST_IGNORE;
                }
                if (file.size > 5 * 1024 * 1024) {
                  message.error('文件大小超过 5MB');
                  return Upload.LIST_IGNORE;
                }
                return true;
              },
              onChange: (info: any) => {
                if (info.file.status === 'done' && info.file.response?.code === 0) {
                  const url = info.file.response.data.url;
                  form.setFieldValue('coverImage', url);
                  message.success('已上传');
                } else if (info.file.status === 'error') {
                  message.error(`上传失败：${info.file.response?.message ?? '未知错误'}`);
                }
              },
            } as any}>
              <Button icon={<UploadOutlined />}>点击上传封面图（jpg/png/gif/webp，≤5MB）</Button>
            </Upload>
            <Input
              placeholder="或直接粘贴 https:// 开头的图片 URL"
              maxLength={500}
              allowClear
              style={{ marginTop: 8 }}
              onChange={(e) => form.setFieldValue('coverImage', e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Frank 27 19:27 反馈：活动管理页加"志愿者配置"按钮（v3） */}
      <VolunteerConfigModal
        activity={volunteerConfig.activity}
        open={volunteerConfig.open}
        onClose={() => setVolunteerConfig({ open: false, activity: null })}
      />
    </div>
  );
}

// =====================================================================
// 志愿者配置 Modal（v3 · Frank 27 19:27 反馈）
// 列出该活动的所有申请 + 当前志愿者，运营可手动分配/更换志愿者
// 数据流：调 adminApi.listApplicationsByActivity 拉申请，调 adminApi.listVolunteers 拉志愿者
// 写操作：调 adminApi.assignVolunteer（POST /:id/assign）
// =====================================================================
function VolunteerConfigModal({
  activity,
  open,
  onClose,
}: {
  activity: Activity | null;
  open: boolean;
  onClose: () => void;
}) {
  const [apps, setApps] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<Array<{ userId: string; email: string; name: string; province?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [pendingApp, setPendingApp] = useState<string | null>(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | undefined>(undefined);
  const [remark, setRemark] = useState('');

  const load = async () => {
    if (!activity) return;
    setLoading(true);
    try {
      const [appsData, volsData] = await Promise.all([
        adminApi.listApplicationsByActivity(activity.activityId),
        adminApi.listVolunteers(),
      ]);
      setApps(appsData.list ?? []);
      setVolunteers(volsData.list ?? []);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedVolunteer(undefined);
      setRemark('');
      setPendingApp(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity?.activityId]);

  const onAssign = async (applicationId: string) => {
    if (!selectedVolunteer) {
      message.warning('请先选择志愿者');
      return;
    }
    try {
      await adminApi.assignVolunteer(applicationId, { volunteerId: selectedVolunteer, remark: remark || undefined });
      message.success(`已分配志愿者给 ${applicationId}`);
      setSelectedVolunteer(undefined);
      setRemark('');
      setPendingApp(null);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? e?.message ?? '分配失败');
    }
  };

  if (!activity) return null;

  return (
    <Modal
      title={`志愿者配置：${activity.title}（${activity.activityId}）`}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>关闭</Button>,
      ]}
      width={920}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="运营/管理员手动分配或更换志愿者。已分过志愿者会覆盖（v1 不校验省份/负载，按团队需要分配）。"
      />
      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#6B7280', fontSize: 13 }}>选择志愿者：</span>
        <Select
          placeholder="选一个志愿者（会作用于待分配的申请行）"
          style={{ minWidth: 220 }}
          value={selectedVolunteer}
          onChange={setSelectedVolunteer}
          options={volunteers.map((v) => ({
            value: v.userId,
            label: `${v.name}（${v.province ?? '无省份'} · ${v.email}）`,
          }))}
          allowClear
        />
        <Input
          placeholder="备注（可选）"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          maxLength={200}
          style={{ width: 200 }}
        />
      </div>
      <Table
        size="small"
        rowKey="applicationId"
        loading={loading}
        dataSource={apps}
        pagination={false}
        locale={{ emptyText: '该活动暂无申请' }}
        columns={[
          { title: '申请号', dataIndex: 'applicationNo', width: 140 },
          { title: '申请人', dataIndex: 'organizerName', width: 110 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (s: string) => {
              const map: Record<string, { label: string; color: string }> = {
                SCREENING: { label: '待审批', color: 'gold' },
                CONFIRMED: { label: '已通过', color: 'green' },
                REJECTED: { label: '已拒绝', color: 'red' },
                WITHDRAWN: { label: '已撤回', color: 'default' },
              };
              const d = map[s] ?? { label: s, color: 'default' };
              return <Tag color={d.color}>{d.label}</Tag>;
            },
          },
          { title: '评分', dataIndex: 'score', width: 70, render: (s: number) => s ?? '—' },
          {
            title: '当前志愿者',
            dataIndex: 'volunteerId',
            width: 150,
            render: (vid: string, row: any) => {
              if (!vid) return <Text type="secondary">未分配</Text>;
              const v = volunteers.find((vv) => vv.userId === vid);
              return (
                <Space size={4}>
                  <Tag color="blue">{v?.name ?? vid}</Tag>
                  {v?.province && <Text type="secondary" style={{ fontSize: 12 }}>· {v.province}</Text>}
                </Space>
              );
            },
          },
          {
            title: '操作',
            width: 160,
            render: (_: any, row: any) => (
              <Space size={4}>
                <Button
                  size="small"
                  type={row.volunteerId ? 'default' : 'primary'}
                  icon={row.volunteerId ? <SwapOutlined /> : <UserAddOutlined />}
                  disabled={!selectedVolunteer || pendingApp === row.applicationId}
                  onClick={() => onAssign(row.applicationId)}
                >
                  {row.volunteerId ? '更换' : '分配'}
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  );
}
