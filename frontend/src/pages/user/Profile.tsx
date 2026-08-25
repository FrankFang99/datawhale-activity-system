/**
 * 个人中心（v7 · PRD §4.1.9 US-O12）
 * 5 角色都能进：编辑昵称/手机/学校/城市/省份 + 修改密码
 */
import { useEffect, useState } from 'react';
import {
  Card, Form, Input, Button, message, Spin, Typography, Tabs, Space, Divider, Tag,
} from 'antd';
import { UserOutlined, LockOutlined, SaveOutlined } from '@ant-design/icons';
import { userApi } from '../../services/api';
import { authStore } from '../../store/auth';

const { Title, Text } = Typography;

const ROLE_LABEL: Record<string, { label: string; color: string; tip: string }> = {
  USER:        { label: '普通用户', color: 'default', tip: '注册即默认。报名活动并当天成功打卡后升级为「参与者」' },
  PARTICIPANT:  { label: '参与者', color: 'cyan',     tip: '已报名并当天成功打卡的活动参与者' },
  ORGANIZER:   { label: '组织者', color: 'green',    tip: '申请组织者并通过审批 + 志愿者确认意向' },
  ASSISTANT:   { label: '助教', color: 'purple',    tip: '同校多申请者时自动派生为助教' },
  VOLUNTEER:   { label: '志愿者', color: 'blue',     tip: '由运营手动创建（v1 测试模式 Frank 一人多角色）' },
  OPERATOR:    { label: '运营', color: 'orange',    tip: '由 admin 手动创建' },
  ADMIN:       { label: '管理员', color: 'red',      tip: 'Datawhale 总部管理员' },
};

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const currentUser = authStore((s) => s.user);

  const load = async () => {
    setLoading(true);
    try {
      const u = await userApi.me();
      setUser(u);
      profileForm.setFieldsValue({
        name: u.name,
        phone: u.phone ?? '',
        school: u.school ?? '',
        city: u.city ?? '',
        province: u.province ?? '',
      });
    } catch {
      /* 拦截器已处理 */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleSaveProfile = async (values: any) => {
    try {
      const r = await userApi.updateMe(values);
      setUser(r.user);
      // v16.4 Frank 13:26 Comment 1 反馈：个人中心改名后 header 也要自动更新
      // Layout 组件用的是 authStore 里的 user，需要同步更新全局 store
      authStore.getState().setAuth(authStore.getState().token!, r.user);
      message.success(r.message);
    } catch { /* 拦截器 */ }
  };

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    try {
      const r = await userApi.changePassword(values.oldPassword, values.newPassword);
      message.success(r.message);
      pwForm.resetFields();
      // 改密后要求重新登录
      setTimeout(() => {
        authStore.getState().clearAuth();
        window.location.href = '/login';
      }, 1500);
    } catch { /* 拦截器 */ }
  };

  if (loading && !user) return <Spin style={{ display: 'block', margin: 64 }} />;

  const roleInfo = currentUser ? ROLE_LABEL[currentUser.role] : null;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>个人中心</Title>
      <Text type="secondary">管理你的账号信息、修改密码</Text>

      <Card style={{ marginTop: 16 }}>
        <Space size="middle">
          <UserOutlined style={{ fontSize: 48, color: '#3370FF' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>{user?.name ?? '...'}</Title>
            <Space size="small" style={{ marginTop: 4 }}>
              {roleInfo && (
                <Tag color={roleInfo.color} title={roleInfo.tip}>{roleInfo.label}</Tag>
              )}
              <Text type="secondary">{user?.email}</Text>
            </Space>
            <div style={{ marginTop: 4, fontSize: 12, color: '#9CA3AF' }}>用户 ID：{user?.userId}</div>
            {/* Frank 2026-08-21 #6 升级：显示角色升级路径说明 */}
            <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
              💡 {roleInfo?.tip ?? '请联系运营了解角色说明'}
            </div>
          </div>
        </Space>
      </Card>

      {/* Frank 2026-08-21 #6 升级：角色升级路径图 */}
      <Card size="small" style={{ marginTop: 16, background: '#F0F7FF' }} title="🪜 角色升级路径">
        <Space direction="vertical" size={4} style={{ fontSize: 13 }}>
          <div>
            <Tag color="default">普通用户</Tag>（注册即默认）→
            <Tag color="cyan">参与者</Tag>（<b>报名活动 + 活动当天成功打卡</b>）→
            <Tag color="green">组织者</Tag>（<b>申请组织者 + 审核通过</b>）
          </div>
          <div style={{ color: '#6B7280', fontSize: 12 }}>
            报名只是成为"参与者候选"，必须活动当天成功打卡才是真正的参与者。
            想成为组织者？去活动详情页点"申请成为组织者"。
          </div>
        </Space>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="profile"
          items={[
            {
              key: 'profile',
              label: <span><UserOutlined /> 基本资料</span>,
              children: (
                <Form
                  form={profileForm}
                  layout="vertical"
                  onFinish={handleSaveProfile}
                  style={{ maxWidth: 480 }}
                >
                  <Form.Item name="name" label="姓名" rules={[{ required: true, max: 20 }]}>
                    <Input placeholder="请输入姓名" />
                  </Form.Item>
                  <Form.Item name="phone" label="手机号" rules={[{ pattern: /^1\d{10}$/, message: '请填写 11 位手机号' }]}>
                    <Input placeholder="11 位手机号" />
                  </Form.Item>
                  <Form.Item name="school" label="学校">
                    <Input placeholder="如：清华大学" maxLength={50} />
                  </Form.Item>
                  <Form.Item name="city" label="城市">
                    <Input placeholder="如：北京" maxLength={20} />
                  </Form.Item>
                  <Form.Item name="province" label="省份">
                    <Input placeholder="如：北京" maxLength={20} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                      保存修改
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'password',
              label: <span><LockOutlined /> 修改密码</span>,
              children: (
                <Form
                  form={pwForm}
                  layout="vertical"
                  onFinish={handleChangePassword}
                  style={{ maxWidth: 480 }}
                >
                  <Form.Item
                    name="oldPassword"
                    label="旧密码"
                    rules={[{ required: true, min: 6, message: '请输入旧密码' }]}
                  >
                    <Input.Password placeholder="6-32 位" />
                  </Form.Item>
                  <Form.Item
                    name="newPassword"
                    label="新密码"
                    rules={[
                      { required: true, min: 6, max: 32, message: '新密码 6-32 位' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('oldPassword') !== value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('新密码不能与旧密码相同'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="6-32 位" />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true, message: '请确认新密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="再次输入新密码" />
                  </Form.Item>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    ⚠️ 修改密码后需重新登录
                  </Text>
                  <Form.Item style={{ marginTop: 12 }}>
                    <Button type="primary" danger htmlType="submit" icon={<LockOutlined />}>
                      修改密码
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
