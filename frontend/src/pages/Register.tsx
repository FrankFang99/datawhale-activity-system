import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

const { Title, Text } = Typography;

export default function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { email: string; password: string; name: string }) => {
    setLoading(true);
    try {
      // Frank #6: 新注册用户默认普通用户（PARTICIPANT 角色），不是组织者
      // 想成为组织者 → 通过活动详情页"申请成为组织者"走审核流程
      await authApi.register({ ...values });
      message.success('注册成功！请登录');
      navigate('/login');
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
          <Title level={3} style={{ margin: 0 }}>注册</Title>
          <Text type="secondary">加入 Datawhale 高校活动</Text>
        </div>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 16, fontSize: 12 }}>
          💡 注册即为普通用户。想成为参与者请报名活动并当天成功打卡；想成为组织者请去活动详情页申请。
        </Text>
        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            label="姓名"
            name="name"
            rules={[
              { required: true, message: '请输入姓名' },
              { min: 1, max: 20, message: '姓名 1-20 字符' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="您的姓名" />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="your@email.com" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, max: 32, message: '密码 6-32 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="6-32 位字母/数字/特殊字符" />
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
              注册
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary">已有账号？</Text>
          <Link to="/login"> 立即登录</Link>
        </div>
      </Card>
    </div>
  );
}
