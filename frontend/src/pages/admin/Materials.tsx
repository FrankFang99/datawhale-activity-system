/**
 * 物料管理页（v9 · PRD §4.1.6 US-V5 / §4.2.5 US-P8）
 * admin/operator 专用：上传/删除物料
 */
import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, Select, Typography, message, Popconfirm, Upload, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, FileTextOutlined, DownloadOutlined, GlobalOutlined, AppstoreOutlined } from '@ant-design/icons';
import { materialApi, Material } from '../../services/api';

const { Title, Text } = Typography;

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  POSTER:   { label: '海报', color: 'blue' },
  GUIDE:    { label: '指南', color: 'green' },
  TEMPLATE: { label: '模板', color: 'wathet' },
  SLIDES:   { label: 'PPT', color: 'orange' },
  VIDEO:    { label: '视频', color: 'red' },
  OTHER:    { label: '其他', color: 'default' },
};

function formatTime(t?: number) {
  if (!t) return '-';
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatSize(b?: number) {
  if (!b) return '-';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function Materials() {
  const [list, setList] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'GLOBAL' | 'ACTIVITY'>('all');
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter !== 'all') params.scope = filter;
      const data = await materialApi.list(params);
      setList(data.list);
    } catch { /* */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const handleCreate = async () => {
    const v = await form.validateFields();
    try {
      const r = await materialApi.create(v);
      message.success(`已上传：${r.materialId}`);
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch { /* */ }
  };

  const handleDelete = async (m: Material) => {
    try {
      await materialApi.delete(m.materialId);
      message.success('已删除');
      load();
    } catch { /* */ }
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>
        <FileTextOutlined /> 物料管理
      </Title>
      <Text type="secondary">上传/删除海报/指南/PPT 等物料（v9 · PRD §4.1.6 US-V5）</Text>

      <Card style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            value={filter}
            onChange={setFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'GLOBAL', label: '🌐 全局物料' },
              { value: 'ACTIVITY', label: '🎯 活动物料' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>上传物料</Button>
        </Space>

        <Table
          size="small"
          rowKey="materialId"
          loading={loading}
          dataSource={list}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '物料 ID', dataIndex: 'materialId', width: 130 },
            { title: '名称', dataIndex: 'name', width: 220 },
            {
              title: '类型', dataIndex: 'category', width: 90,
              render: (c: string) => <Tag color={CATEGORY_META[c]?.color}>{CATEGORY_META[c]?.label ?? c}</Tag>,
            },
            {
              title: '范围', dataIndex: 'scope', width: 90,
              render: (s: string) => s === 'GLOBAL' ? <Tag color="purple" icon={<GlobalOutlined />}>全局</Tag> : <Tag color="cyan" icon={<AppstoreOutlined />}>活动</Tag>,
            },
            { title: '活动 ID', dataIndex: 'activityId', width: 100, render: (s) => s || '—' },
            { title: '大小', dataIndex: 'fileSize', width: 80, render: formatSize },
            { title: '说明', dataIndex: 'description', ellipsis: true },
            { title: '上传时间', dataIndex: 'uploadedAt', width: 110, render: formatTime },
            {
              title: '操作', width: 180,
              render: (_: any, m: Material) => (
                <Space size="small">
                  <Tooltip title="下载/打开">
                    <Button size="small" type="link" icon={<DownloadOutlined />} href={m.fileUrl} target="_blank">下载</Button>
                  </Tooltip>
                  <Popconfirm title={`删除"${m.name}"？`} onConfirm={() => handleDelete(m)}>
                    <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="上传物料"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="上传"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ scope: 'GLOBAL', category: 'POSTER' }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, max: 200 }]}>
            <Input placeholder="如：AI+X 创造节海报 v2" />
          </Form.Item>
          <Form.Item name="category" label="类型" rules={[{ required: true }]}>
            <Select
              options={Object.entries(CATEGORY_META).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Form.Item>
          <Form.Item name="scope" label="范围" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'GLOBAL', label: '🌐 全局（所有活动可下载）' },
                { value: 'ACTIVITY', label: '🎯 活动（仅指定活动可下载）' },
              ]}
            />
          </Form.Item>
          <Form.Item name="activityId" label="活动 ID（scope=ACTIVITY 时必填）">
            <Input placeholder="如：NO.001" />
          </Form.Item>
          <Form.Item name="fileUrl" label="文件 URL" rules={[{ required: true }]} extra="v1 简化：先上传到飞书云空间/网盘后粘贴 URL；v2 接入飞书文件 API">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="fileSize" label="文件大小（字节）">
            <Input type="number" placeholder="可选" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
