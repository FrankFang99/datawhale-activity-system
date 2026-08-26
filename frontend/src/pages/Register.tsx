import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import AuthBrand from '../components/AuthBrand';

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
    <AuthBrand
      title="加入 Datawhale"
      subtitle="和全国 200+ 高校同学一起组织 AI 活动"
      hint={
        <>
          💡 注册即为普通用户。想成为<strong>参与者</strong>请报名活动并当天成功打卡；
          想成为<strong>组织者</strong>请去活动详情页申请（需 5 维评分审核）。
        </>
      }
      footer={
        <span style={{ color: '#6B7280', fontSize: 13 }}>
          已有账号？ <Link to="/login" style={{ color: '#3370FF' }}>立即登录 →</Link>
        </span>
      }
    >
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
        <Form.Item style={{ marginBottom: 0 }}>
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
    </AuthBrand>
  );
}
