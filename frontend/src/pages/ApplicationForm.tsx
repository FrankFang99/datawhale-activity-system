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
  Form, Input, Button, Card, Select, Typography, message,
  Divider, Space, Spin, Result, Modal, Alert, Row, Col, Tag,
} from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined, BankOutlined } from '@ant-design/icons';
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
  schoolProvince: string;
  schoolCity: string;
  schoolDistrict: string;
  schoolName: string;
  campus: string;     // 校区名
  // Frank 27 12:50：宽泛时间段（替代精确日期）
  expectedTimeRange: string;
  // Frank 27 12:50：基础信息增加 身份 + 现居地
  applicantIdentity: '在校' | '在职' | '自由职业' | '其他';
  currentCity: string;
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
  const [cities, setCities] = useState<{ city: string; districts: string[] }[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [districtMatchError, setDistrictMatchError] = useState<string>('');

  const watchSchoolProvince = Form.useWatch('schoolProvince', form);
  const watchSchoolCity = Form.useWatch('schoolCity', form);
  const watchSchoolDistrict = Form.useWatch('schoolDistrict', form);
  const watchSchoolName = Form.useWatch('schoolName', form);
  const watchCampus = Form.useWatch('campus', form);

  useEffect(() => {
    if (watchSchoolProvince) {
      const citiesForProvince = PROVINCES.find((p) => p.province === watchSchoolProvince)?.cities ?? [];
      setCities(citiesForProvince);
      // 清空下级
      form.setFieldsValue({ schoolCity: undefined, schoolDistrict: undefined, schoolName: undefined, campus: undefined });
    }
  }, [watchSchoolProvince]);

  useEffect(() => {
    if (watchSchoolCity) {
      const ds = cities.find((c) => c.city === watchSchoolCity)?.districts ?? [];
      setDistricts(ds);
      form.setFieldsValue({ schoolDistrict: undefined, schoolName: undefined, campus: undefined });
    }
  }, [watchSchoolCity]);

  useEffect(() => {
    if (watchSchoolProvince && watchSchoolCity) {
      setUniversities(getUniversities(watchSchoolProvince, watchSchoolCity, watchSchoolDistrict));
      form.setFieldsValue({ schoolName: undefined, campus: undefined });
    }
  }, [watchSchoolDistrict]);

  useEffect(() => {
    if (watchSchoolName) {
      const u = universities.find((x) => x.name === watchSchoolName);
      setCampuses(u?.campuses ?? []);
      form.setFieldsValue({ campus: undefined });
    }
  }, [watchSchoolName]);

  // Frank #8 关键校验：申请人填的 district 必须和学校所在 district 一致
  useEffect(() => {
    if (watchSchoolDistrict && watchSchoolName) {
      const u = universities.find((x) => x.name === watchSchoolName);
      if (u) {
        const result = validateDistrictMatch(
          u.province, u.city, u.district, u.name,
          u.province, u.city, watchSchoolDistrict
        );
        if (!result.ok) {
          setDistrictMatchError(result.reason);
        } else {
          setDistrictMatchError('');
        }
      }
    } else {
      setDistrictMatchError('');
    }
  }, [watchSchoolDistrict, watchSchoolName, universities]);

  const onFinish = async (values: FormValues) => {
    if (!activityId) return;
    if (districtMatchError) {
      message.error('活动地点与学校校区不一致，请修正后再提交');
      return;
    }
    setSubmitting(true);
    try {
      // Frank #8 完整 location 格式：${province}·${city}·${district}·${schoolName}·${campus}·${detailAddress}
      const fullLocation = [
        values.schoolProvince,
        values.schoolCity,
        values.schoolDistrict,
        values.schoolName,
        values.campus || values.schoolName,
      ].filter(Boolean).join('·') + (values.location ? `·${values.location}` : '');
      const data = await applicationApi.submit({
        activityId,
        organizerName: values.organizerName,
        organizerPhone: values.organizerPhone,
        organizerEmail: values.organizerEmail,
        expectedTimeRange: values.expectedTimeRange,
        applicantIdentity: values.applicantIdentity,
        currentCity: values.currentCity,
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

          {/* Frank 27 12:50 Comment 1：基础信息增加现居地（区别于目标学校） */}
          <Form.Item
            label="现居地"
            name="currentCity"
            rules={[{ required: true, message: '请填写现居地' }]}
            extra="您当前所在城市（区别于目标学校）"
          >
            <Input placeholder="如：北京、上海、深圳" maxLength={50} />
          </Form.Item>

          {/* Frank 2026-08-21 #8 + #10：学校 5 级联动 + 区一致性校验 */}
          <Title level={5}>
            <BankOutlined /> 目标学校（Frank #8 必填 #10 下拉选择）
          </Title>
          <Row gutter={12}>
            <Col span={5}>
              <Form.Item
                label="省"
                name="schoolProvince"
                rules={[{ required: true, message: '请选择省' }]}
              >
                <Select
                  showSearch
                  placeholder="选择省"
                  options={PROVINCES.map((p) => ({ value: p.province, label: p.province }))}
                />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item
                label="市"
                name="schoolCity"
                rules={[{ required: true, message: '请选择市' }]}
              >
                <Select
                  showSearch
                  placeholder="选择市"
                  disabled={!watchSchoolProvince}
                  options={cities.map((c) => ({ value: c.city, label: c.city }))}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                label="区"
                name="schoolDistrict"
                rules={[{ required: true, message: '请选择区' }]}
              >
                <Select
                  placeholder="选择区"
                  disabled={!watchSchoolCity}
                  options={districts.map((d) => ({ value: d, label: d }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="学校"
                name="schoolName"
                rules={[{ required: true, message: '请选择学校' }]}
              >
                <Select
                  showSearch
                  placeholder="选择学校"
                  disabled={!watchSchoolCity}
                  options={universities.map((u) => ({
                    value: u.name,
                    label: `${u.name} ${u.tier === '985' ? '🌟' : u.tier === '211' ? '⭐' : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                label="校区"
                name="campus"
                rules={[{ required: false }]}
              >
                <Select
                  placeholder="选校区"
                  disabled={!watchSchoolName}
                  allowClear
                  options={campuses.map((c) => ({
                    value: c.name,
                    label: `${c.name}（${c.district}）`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {districtMatchError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="活动地点与学校校区不一致"
              description={districtMatchError}
            />
          )}

          <Form.Item
            label={
              <span>
                <EnvironmentOutlined /> 详细地址（可选）
              </span>
            }
            name="location"
            rules={[{ max: 100 }]}
            extra="完整活动地点：{省}·{市}·{区}·{学校}·{校区}·{详细地址}，由系统自动拼接"
          >
            <Input placeholder="如：清华大学 FIT 楼 3 层多功能厅" />
          </Form.Item>

          <Form.Item
            label="预期活动时间段（宽泛）"
            name="expectedTimeRange"
            rules={[
              { required: true, message: '请填写预期时间段' },
              { max: 100, message: '不超过 100 字符' },
            ]}
            extra="Frank 27 12:50：填宽泛时间段（如「2026 年 9 月」或「2026 Q3」），具体日期通过成为组织者后在「双方最终确认活动方案」子任务中确定"
          >
            <Input placeholder="如：2026 年 9 月 / 2026 Q3 / 2026 年 10 月 1 日前后" maxLength={100} />
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
