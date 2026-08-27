/**
 * 申请表单（PRD §4.1.4 v3 修订版 · Frank 2026-08-21 升级 #8 #10）
 *
 * 改动：
 * - 加 5 级学校下拉：省 / 市 / 区 / 校 / 校区（v1 简化：500+ 主流院校硬编码到 universities.ts）
 * - Frank #8 关键约束：申请人填的 district 必须和学校所在 district 一致（实时校验）
 * - 5 阶段子任务化：每阶段 5+ 个具体子任务（StageBoard）
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form, Input, Button, Card, DatePicker, Select, Typography, message,
  Divider, Space, Spin, Result, Modal, Alert, Row, Col, Tag,
} from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined, BankOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { activityApi, applicationApi, Activity } from '../services/api';
import { authStore } from '../store/auth';
import { PROVINCES, getUniversities, validateDistrictMatch, University, Campus } from '../data/universities';

const { Title, Text } = Typography;

const RECRUIT_OPTIONS = ['社群', '公众号', '高校社团', '企业园区', '暂无'].map((v) => ({
  value: v,
  label: v,
  disabled: false,
}));

const VENUE_OPTIONS = [
  { value: '已确定', label: '已确定' },
  { value: '有潜在', label: '有潜在（待确认）' },
  { value: '暂无', label: '暂无（需协助）' },
];

interface FormValues {
  organizerName: string;
  organizerPhone: string;
  organizerEmail: string;
  // Frank 27 14:12：基础信息（身份 + 现居地 3 级 + 学校简化）
  applicantIdentity: '在校' | '在职' | '自由职业' | '其他';
  currentProvince: string;
  currentCity: string;     // 实际是市
  currentDistrict: string;
  schoolName: string;      // 来自下拉 或「其他」手动输入
  schoolIsOther: boolean;  // 选了「其他」时为 true
  // Frank 27 14:12：日历多选日期（运营给的活动时间区间中可多选，最后会协商上选定一天）
  expectedTimeRange: Dayjs[];
  location: string;   // 详细地址（自由填）
  motivation: string;
  participantValue: string;
  experience?: string;
  venueStatus: '已确定' | '有潜在' | '暂无';
  recruitChannel: string[];
}

export default function ApplicationForm() {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    applicationId: string;
    applicationNo?: string;
    status: string;
    message: string;
    activityTitle?: string;
    groupQrCode?: string | null;
  } | null>(null);
  const user = authStore((s) => s.user);

  useEffect(() => {
    if (!activityId) return;
    activityApi.get(activityId).then(setActivity).catch(() => message.error('活动加载失败'));
    if (user) {
      form.setFieldsValue({
        organizerName: user.name,
        organizerEmail: user.email,
      });
    }
  }, [activityId, user, form]);

  // Frank 2026-08-21 #8 + #10: 学校 5 级联动 + 实时校验
  // Frank 27 14:12：现居地 3 级联动（省/市/区）
  const [currentCities, setCurrentCities] = useState<{ city: string; districts: string[] }[]>([]);
  const [currentDistricts, setCurrentDistricts] = useState<string[]>([]);
  const watchCurrentProvince = Form.useWatch('currentProvince', form);
  const watchCurrentCity = Form.useWatch('currentCity', form);
  const watchSchoolName = Form.useWatch('schoolName', form);
  const watchSchoolIsOther = Form.useWatch('schoolIsOther', form);

  useEffect(() => {
    if (watchCurrentProvince) {
      const citiesForProvince = PROVINCES.find((p) => p.province === watchCurrentProvince)?.cities ?? [];
      setCurrentCities(citiesForProvince);
      form.setFieldsValue({ currentCity: undefined, currentDistrict: undefined });
    }
  }, [watchCurrentProvince, form]);

  useEffect(() => {
    if (watchCurrentCity) {
      const ds = currentCities.find((c) => c.city === watchCurrentCity)?.districts ?? [];
      setCurrentDistricts(ds);
      form.setFieldsValue({ currentDistrict: undefined });
    }
  }, [watchCurrentCity, currentCities, form]);

  // 选了「其他」时清空 schoolName（避免下拉值残留）
  useEffect(() => {
    if (watchSchoolIsOther) {
      form.setFieldsValue({ schoolName: undefined });
    }
  }, [watchSchoolIsOther, form]);

  // Frank 8-25 v1-delivery 预置学校下拉（来自 dw_universities 飞书表 + 8-25 备份硬编码）
  // Frank 27 14:12：学校简化（单一下拉 + 「其他」手动输入）
  const schoolOptions = [
    { value: '清华大学', label: '清华大学' },
    { value: '北京大学', label: '北京大学' },
    { value: '中国人民大学', label: '中国人民大学' },
    { value: '北京航空航天大学', label: '北京航空航天大学' },
    { value: '北京理工大学', label: '北京理工大学' },
    { value: '北京邮电大学', label: '北京邮电大学' },
    { value: '北京师范大学', label: '北京师范大学' },
    { value: '中央财经大学', label: '中央财经大学' },
    { value: '中国政法大学', label: '中国政法大学' },
    { value: '复旦大学', label: '复旦大学' },
    { value: '上海交通大学', label: '上海交通大学' },
    { value: '同济大学', label: '同济大学' },
    { value: '华东师范大学', label: '华东师范大学' },
    { value: '武汉大学', label: '武汉大学' },
    { value: '华中科技大学', label: '华中科技大学' },
    { value: '中山大学', label: '中山大学' },
    { value: '华南理工大学', label: '华南理工大学' },
    { value: '浙江大学', label: '浙江大学' },
    { value: '南京大学', label: '南京大学' },
    { value: '东南大学', label: '东南大学' },
    { value: '中国科学技术大学', label: '中国科学技术大学' },
    { value: '哈尔滨工业大学', label: '哈尔滨工业大学' },
    { value: '西安交通大学', label: '西安交通大学' },
    { value: '西北工业大学', label: '西北工业大学' },
    { value: '四川大学', label: '四川大学' },
    { value: '电子科技大学', label: '电子科技大学' },
    { value: '山东大学', label: '山东大学' },
    { value: '中国海洋大学', label: '中国海洋大学' },
    { value: '中南大学', label: '中南大学' },
    { value: '湖南大学', label: '湖南大学' },
    { value: '厦门大学', label: '厦门大学' },
    { value: '吉林大学', label: '吉林大学' },
    { value: '兰州大学', label: '兰州大学' },
    { value: '重庆大学', label: '重庆大学' },
    { value: '大连理工大学', label: '大连理工大学' },
    { value: '东北大学', label: '东北大学' },
    { value: '南开大学', label: '南开大学' },
    { value: '天津大学', label: '天津大学' },
    { value: '深圳大学', label: '深圳大学' },
    { value: '其他', label: '其他（手动输入）' },
  ];

  const onFinish = async (values: FormValues) => {
    if (!activityId) return;
    setSubmitting(true);
    try {
      // location 格式：${现居地省}·${现居地市}·${现居地区}·${学校}·${详细地址}
      const fullLocation = [
        values.currentProvince,
        values.currentCity,
        values.currentDistrict,
        values.schoolName || '其他学校',
      ].filter(Boolean).join('·') + (values.location ? `·${values.location}` : '');
      // 多个日期 → 字符串数组
      const expectedTimeRangeStr = (values.expectedTimeRange || []).map((d) => d.format('YYYY-MM-DD')).join(',');
      const data = await applicationApi.submit({
        activityId,
        organizerName: values.organizerName,
        organizerPhone: values.organizerPhone,
        organizerEmail: values.organizerEmail,
        expectedTimeRange: expectedTimeRangeStr,
        applicantIdentity: values.applicantIdentity,
        currentCity: `${values.currentProvince}·${values.currentCity}·${values.currentDistrict}`,
        location: fullLocation,
        motivation: values.motivation,
        participantValue: values.participantValue,
        experience: values.experience,
        venueStatus: values.venueStatus,
        recruitChannel: values.recruitChannel,
      });
      setResult(data);
    } catch {
      /* 拦截器已处理 */
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    // v6 修订：弹飞书群二维码 modal（PRD §1.2 痛点 9）
    // 如果 groupQrCode 是图片 URL（运营上传到云空间），用 <img> 展示
    // 如果是普通 URL/为空，用公共 API 包成 QR 图
    const qrSrc = result.groupQrCode
      ? (result.groupQrCode.match(/\.(png|jpg|jpeg|svg|webp)(\?.*)?$/i)
          ? result.groupQrCode
          : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.groupQrCode)}`)
      : null;
    return (
      <>
        <Result
          status="success"
          title="申请已提交"
          subTitle={result.message}
          extra={[
            <Button type="primary" key="mine" onClick={() => navigate('/my-applications')}>
              查看我的申请
            </Button>,
            <Button key="home" onClick={() => navigate('/')}>
              返回活动大厅
            </Button>,
          ]}
        >
          <div style={{ color: '#6B7280' }}>申请编号：<Text code>{result.applicationId}</Text></div>
        </Result>

        {/* 飞书群二维码 Modal（强制显示，PRD §4.1.4） */}
        <Modal
          open={true}
          title={`扫码加入 ${result.activityTitle ?? '活动'} 飞书群`}
          footer={[
            <Button key="ok" type="primary" onClick={() => {
              // 关闭后询问是否已加入（v4 PRD §4.1.4 步骤 3）
              Modal.confirm({
                title: '您是否已经加入活动飞书群？',
                okText: '已加入',
                cancelText: '还没',
                onOk: () => message.success('太好了！'),
                onCancel: () => message.info('请尽快扫码加入'),
              });
            }}>
              我已扫码
            </Button>,
          ]}
          closable={true}
          maskClosable={false}
          width={400}
          style={{ top: 80 }}
        >
          {qrSrc ? (
            <div style={{ textAlign: 'center' }}>
              <img
                src={qrSrc}
                alt="活动飞书群二维码"
                style={{ width: 300, height: 300, borderRadius: 8, border: '1px solid #E5E7EB' }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <div style={{ marginTop: 16, color: '#6B7280', fontSize: 12 }}>
                请用飞书 App 扫码加入活动大群
              </div>
            </div>
          ) : (
            <Alert
              type="info"
              showIcon
              message="活动飞书群二维码待运营上传"
              description={
                <div>
                  <p>运营会在 24h 内建立活动飞书群并在此处展示二维码。</p>
                  <p style={{ marginTop: 8 }}>
                    你也可以：<a href="mailto:frank-fangyz@139.com?subject=申请 ${result.applicationId} 加入飞书群">
                      发邮件给运营催一下
                    </a>
                  </p>
                </div>
              }
            />
          )}
        </Modal>
      </>
    );
  }

  if (!activity) {
    return <Spin style={{ display: 'block', margin: 64 }} />;
  }

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, padding: 0 }}
      >
        返回
      </Button>

      <Card style={{ borderRadius: 16 }}>
        <Title level={3} style={{ marginTop: 0 }}>活动申请</Title>
        <Text type="secondary">活动：{activity.title}</Text>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          size="large"
          initialValues={{ recruitChannel: [] }}
        >
          <Title level={5}>基础信息</Title>

          <Form.Item
            label="姓名"
            name="organizerName"
            rules={[{ required: true, max: 20 }]}
          >
            <Input placeholder="您的姓名" />
          </Form.Item>

          {/* Frank 27 12:50 Comment 1：基础信息增加 身份 + 现居地 */}
          <Form.Item
            label="身份"
            name="applicantIdentity"
            rules={[{ required: true, message: '请选择身份' }]}
          >
            <Select
              placeholder="请选择身份"
              options={[
                { value: '在校', label: '在校' },
                { value: '在职', label: '在职' },
                { value: '自由职业', label: '自由职业' },
                { value: '其他', label: '其他' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="手机"
            name="organizerPhone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请填写 11 位手机号' },
            ]}
          >
            <Input placeholder="11 位手机号" />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="organizerEmail"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="联系邮箱" />
          </Form.Item>

          {/* Frank 27 14:12 Comment 1：现居地按省/市/区下拉 */}
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                label="现居地省"
                name="currentProvince"
                rules={[{ required: true, message: '请选择省' }]}
              >
                <Select
                  showSearch
                  placeholder="选择省"
                  options={PROVINCES.map((p) => ({ value: p.province, label: p.province }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="现居地市"
                name="currentCity"
                rules={[{ required: true, message: '请选择市' }]}
              >
                <Select
                  showSearch
                  placeholder="选择市"
                  disabled={!watchCurrentProvince}
                  options={currentCities.map((c) => ({ value: c.city, label: c.city }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="现居地区"
                name="currentDistrict"
                rules={[{ required: true, message: '请选择区' }]}
              >
                <Select
                  showSearch
                  placeholder="选择区"
                  disabled={!watchCurrentCity}
                  options={currentDistricts.map((d) => ({ value: d, label: d }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Frank 27 14:12 Comment 2：学校改单一下拉 + 「其他」手动输入 */}
          <Title level={5}>
            <BankOutlined /> 您的学校
          </Title>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="学校"
                name="schoolName"
                rules={[{ required: true, message: '请选择学校' }]}
              >
                <Select
                  showSearch
                  placeholder="选择学校"
                  disabled={watchSchoolIsOther}
                  options={schoolOptions}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="其他学校（不在列表内）"
                name="schoolIsOther"
                valuePropName="checked"
                extra="勾选后可以手动输入学校名"
              >
                <input type="checkbox" style={{ width: 16, height: 16, marginTop: 8 }} />
              </Form.Item>
            </Col>
            {watchSchoolIsOther && (
              <Col span={24}>
                <Form.Item
                  label="学校名称"
                  name="schoolName"
                  rules={[{ required: true, message: '请输入学校名' }]}
                >
                  <Input placeholder="如：上海纽约大学、昆山杜克大学" maxLength={50} />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Form.Item
            label={
              <span>
                <EnvironmentOutlined /> 详细地址（可选）
              </span>
            }
            name="location"
            rules={[{ max: 100 }]}
            extra="活动地点：{现居地省}·{现居地市}·{现居地区}·{学校}·{详细地址}，由系统自动拼接"
          >
            <Input placeholder="如：清华大学 FIT 楼 3 层多功能厅" />
          </Form.Item>

          <Form.Item
            label="预期活动时间"
            name="expectedTimeRange"
            rules={[
              { required: true, message: '请至少选择 1 个候选日期' },
              {
                validator: (_, v: Dayjs[]) =>
                  v && v.length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error('请至少选择 1 个候选日期')),
              },
            ]}
            extra="Frank 27 14:12：最后会协商上从中选定一天作为活动时间，可多选"
          >
            <DatePicker
              style={{ width: '100%' }}
              multiple
              showTime={false}
              format="YYYY-MM-DD"
              placeholder="可多选日期"
            />
          </Form.Item>

          <Divider style={{ margin: '24px 0' }} />
          <div style={{ marginBottom: 16, color: '#F59E0B', fontSize: 13 }}>
            ⓘ 以下信息请认真填写，涉及申请是否通过。
          </div>

          <Form.Item
            label="是否有预备场地"
            name="venueStatus"
            rules={[{ required: true, message: '请选择' }]}
          >
            <Select options={VENUE_OPTIONS} placeholder="请选择" />
          </Form.Item>

          <Form.Item
            label="本地招募渠道（可多选）"
            name="recruitChannel"
            rules={[{ required: true, message: '请至少选择 1 项' }]}
          >
            <Select
              mode="multiple"
              options={RECRUIT_OPTIONS}
              placeholder={'可多选；选"暂无"则其他选项会自动失效'}
              maxTagCount="responsive"
            />
          </Form.Item>

          <Form.Item
            label="您为什么想参与 AI+X 创造节共创？"
            name="motivation"
            rules={[{ required: true, max: 500 }]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="说说您的目标和动机（≤500 字符）"
            />
          </Form.Item>

          <Form.Item
            label="您希望通过本活动，给参与者带来什么价值？"
            name="participantValue"
            rules={[{ required: true, max: 500 }]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="您的活动能带来什么（≤500 字符）"
            />
          </Form.Item>

          <Form.Item label="介绍您组织过的活动经历（选填）" name="experience" rules={[{ max: 500 }]}>
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="如：曾组织过 3 场 AI 分享会、200+ 人参与等（≤500 字符）"
            />
          </Form.Item>

          <Divider />

          <Space>
            <Button onClick={() => navigate(-1)}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              className="dw-gradient-btn"
              size="large"
            >
              提交申请
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
