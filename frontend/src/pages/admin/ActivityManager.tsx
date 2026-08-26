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
import { PlusOutlined, EditOutlined, CheckCircleOutlined, StopOutlined, InboxOutlined, EyeOutlined, UploadOutlined, LoadingOutlined } from '@ant-design/icons';
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
  const [list, setList] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');

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
      // 第一个校验失败的字段：滚动到 + 高亮 + 顶部 toast + 自动 focus 输入框
      const firstError = err?.errorFields?.[0];
      if (firstError) {
        const fname = firstError.name;
        const fmsg = firstError.errors?.[0] ?? '表单校验失败';
        form.scrollToField(fname);
        // 显式调用 message.error 不被 antd 自动消失（duration 0 表示不自动消失，需手动关闭）
        message.error({
          content: `请检查「${labelOf(fname)}」：${fmsg}`,
          duration: 6,
          key: 'form-validate-err',
        });
        // 尝试 focus 字段输入框
        setTimeout(() => {
          try {
            form.getFieldInstance?.(fname)?.focus?.();
          } catch { /* 忽略 */ }
        }, 100);
      } else {
        message.error({ content: '表单校验失败', duration: 6, key: 'form-validate-err' });
      }
      throw err;  // 让 antd Modal 也知道失败，保持 loading
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
      load();
    } catch { /* 拦截器 */ }
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
              width: 280,
              render: (_: any, a: Activity) => (
                <Space size="small" wrap>
                  <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(a)}>编辑</Button>
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
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? `编辑活动：${editing.title}` : '创建活动'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onSubmit}
        okText="保存"
        cancelText="取消"
        width={720}
      >
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
    </div>
  );
}
