import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { authStore } from '../store/auth';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const data: any = await authApi.login(values);
      authStore.getState().setAuth(data.token, data.user);
      message.success(`欢迎回来，${data.user.name}`);
      // 优先级：URL ?redirect= > 后端 redirect.path（按 role 算） > '/'
      const target = params.get('redirect') || data.redirect?.path || '/';
      navigate(target, { replace: true });
    } catch {
      // 拦截器已弹错误
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '48px auto' }}>
      <Card style={{ borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>登录</Title>
          <Text type="secondary">Datawhale 高校活动智能管理系统</Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="your@email.com" autoComplete="email" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="dw-gradient-btn"
              size="large"
            >
              登录
            </Button>
          </Form.Item>
        </Form>
        <Divider plain style={{ color: '#9CA3AF', fontSize: 12 }}>没有账号？</Divider>
        <div style={{ textAlign: 'center' }}>
          <Link to="/register">立即注册 →</Link>
        </div>
      </Card>
    </div>
  );
}
