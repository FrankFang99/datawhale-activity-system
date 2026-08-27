/**
 * 全国主流高校数据（v1 简化版 · Frank 2026-08-21 #10）
 *
 * 来源：教育部 2024 年全国普通高等学校名单（v1 简化取 985/211/双一流 + 头部本科 + 主要高职）
 * 数据格式：province → city → district[] → universities[]（含校名 + 校区列表）
 * v2 切片：dw_universities 飞书表 + 运营 CRUD（PRD §4.2.5）
 *
 * Frank #8 关键约束：申请人填的 district 必须和学校所在 district 一致
 *  - 校验：formData.district === university.district
 *  - 例如：清华大学 district = 海淀区 → 申请人必须选 海淀区
 */

export interface Campus {
  name: string;        // 校区名（如 "本部" / "西校区" / "深圳校区"）
  district: string;    // 校区所在区
  address: string;      // 校区详细地址
}

export interface University {
  name: string;         // 学校全名
  shortName?: string;   // 简称
  tier: '985' | '211' | '双一流' | '本科' | '高职';
  city: string;         // 所在市
  province: string;     // 所在省
  district: string;     // Frank #8 主校区所在区
  address: string;      // Frank #8 主校区详细地址
  campuses: Campus[];   // Frank #8 多校区
}

export interface ProvinceData {
  province: string;
  cities: {
    city: string;
    districts: string[];
  }[];
}

const UNIV_BY_PROVINCE: Record<string, University[]> = {
  '北京': [
    { name: '北京大学', shortName: '北大', tier: '985', city: '北京', province: '北京', district: '海淀区', address: '颐和园路5号', campuses: [{ name: '燕园', district: '海淀区', address: '颐和园路5号' }] },
    { name: '清华大学', shortName: '清华', tier: '985', city: '北京', province: '北京', district: '海淀区', address: '清华园1号', campuses: [{ name: '本部', district: '海淀区', address: '清华园1号' }] },
    { name: '中国人民大学', shortName: '人大', tier: '985', city: '北京', province: '北京', district: '海淀区', address: '中关村大街59号', campuses: [{ name: '中关村', district: '海淀区', address: '中关村大街59号' }] },
    { name: '北京航空航天大学', shortName: '北航', tier: '985', city: '北京', province: '北京', district: '海淀区', address: '学院路37号', campuses: [{ name: '学院路', district: '海淀区', address: '学院路37号' }, { name: '沙河', district: '昌平区', address: '沙河高教园区' }] },
    { name: '北京理工大学', shortName: '北理工', tier: '985', city: '北京', province: '北京', district: '海淀区', address: '中关村南大街5号', campuses: [{ name: '中关村', district: '海淀区', address: '中关村南大街5号' }, { name: '良乡', district: '房山区', address: '良乡高教园区' }] },
    { name: '中国农业大学', shortName: '中农', tier: '985', city: '北京', province: '北京', district: '海淀区', address: '清华东路17号', campuses: [{ name: '东校区', district: '海淀区', address: '清华东路17号' }, { name: '西校区', district: '海淀区', address: '圆明园西路2号' }] },
    { name: '北京师范大学', shortName: '北师大', tier: '985', city: '北京', province: '北京', district: '海淀区', address: '新街口外大街19号', campuses: [{ name: '本部', district: '海淀区', address: '新街口外大街19号' }] },
    { name: '北京邮电大学', shortName: '北邮', tier: '211', city: '北京', province: '北京', district: '海淀区', address: '西土城路10号', campuses: [{ name: '西土城', district: '海淀区', address: '西土城路10号' }, { name: '沙河', district: '昌平区', address: '沙河高教园区' }] },
    { name: '北京航空航天大学（沙河校区）', shortName: '北航沙河', tier: '985', city: '北京', province: '北京', district: '昌平区', address: '沙河高教园区', campuses: [{ name: '沙河校区', district: '昌平区', address: '沙河高教园区' }] },
    { name: '中央财经大学', shortName: '中财', tier: '211', city: '北京', province: '北京', district: '海淀区', address: '学院南路39号', campuses: [{ name: '本部', district: '海淀区', address: '学院南路39号' }, { name: '沙河', district: '昌平区', address: '沙河高教园区' }] },
    { name: '对外经济贸易大学', shortName: '贸大', tier: '211', city: '北京', province: '北京', district: '朝阳区', address: '惠新东街10号', campuses: [{ name: '本部', district: '朝阳区', address: '惠新东街10号' }] },
    { name: '中国传媒大学', shortName: '中传', tier: '211', city: '北京', province: '北京', district: '朝阳区', address: '定福庄东街1号', campuses: [{ name: '定福庄', district: '朝阳区', address: '定福庄东街1号' }] },
    { name: '北京外国语大学', shortName: '北外', tier: '211', city: '北京', province: '北京', district: '海淀区', address: '西三环北路2号', campuses: [{ name: '西三环', district: '海淀区', address: '西三环北路2号' }] },
  ],
  '上海': [
    { name: '复旦大学', shortName: '复旦', tier: '985', city: '上海', province: '上海', district: '杨浦区', address: '邯郸路220号', campuses: [{ name: '邯郸', district: '杨浦区', address: '邯郸路220号' }, { name: '枫林', district: '徐汇区', address: '东安路131号' }, { name: '张江', district: '浦东新区', address: '张江路825号' }] },
    { name: '上海交通大学', shortName: '上交', tier: '985', city: '上海', province: '上海', district: '闵行区', address: '东川路800号', campuses: [{ name: '闵行', district: '闵行区', address: '东川路800号' }, { name: '徐汇', district: '徐汇区', address: '华山路1954号' }] },
    { name: '同济大学', shortName: '同济', tier: '985', city: '上海', province: '上海', district: '杨浦区', address: '四平路1239号', campuses: [{ name: '四平路', district: '杨浦区', address: '四平路1239号' }, { name: '嘉定', district: '嘉定区', address: '曹安公路4800号' }] },
    { name: '华东师范大学', shortName: '华师大', tier: '985', city: '上海', province: '上海', district: '普陀区', address: '中山北路3663号', campuses: [{ name: '中山北路', district: '普陀区', address: '中山北路3663号' }, { name: '闵行', district: '闵行区', address: '东川路500号' }] },
    { name: '华东理工大学', shortName: '华理', tier: '211', city: '上海', province: '上海', district: '徐汇区', address: '梅陇路130号', campuses: [{ name: '徐汇', district: '徐汇区', address: '梅陇路130号' }, { name: '奉贤', district: '奉贤区', address: '海思路999号' }] },
    { name: '上海大学', shortName: '上大', tier: '211', city: '上海', province: '上海', district: '宝山区', address: '上大路99号', campuses: [{ name: '宝山', district: '宝山区', address: '上大路99号' }, { name: '延长', district: '静安区', address: '延长路149号' }, { name: '嘉定', district: '嘉定区', address: '城中路20号' }] },
    { name: '上海财经大学', shortName: '上财', tier: '211', city: '上海', province: '上海', district: '杨浦区', address: '国定路777号', campuses: [{ name: '国定路', district: '杨浦区', address: '国定路777号' }] },
    { name: '上海交通大学医学院', shortName: '交医', tier: '985', city: '上海', province: '上海', district: '黄浦区', address: '重庆南路227号', campuses: [{ name: '重庆南路', district: '黄浦区', address: '重庆南路227号' }] },
  ],
  '广东': [
    { name: '中山大学', shortName: '中大', tier: '985', city: '广州', province: '广东', district: '海珠区', address: '新港西路135号', campuses: [{ name: '南校园', district: '海珠区', address: '新港西路135号' }, { name: '北校园', district: '越秀区', address: '中山二路74号' }, { name: '东校园', district: '番禺区', address: '大学城外环西路28号' }, { name: '深圳校区', district: '光明区', address: '深圳光明' }] },
    { name: '华南理工大学', shortName: '华工', tier: '985', city: '广州', province: '广东', district: '天河区', address: '五山路381号', campuses: [{ name: '五山', district: '天河区', address: '五山路381号' }, { name: '大学城', district: '番禺区', address: '大学城外环东路382号' }, { name: '国际', district: '番禺区', address: '大学城外环西路30号' }] },
    { name: '暨南大学', shortName: '暨大', tier: '211', city: '广州', province: '广东', district: '天河区', address: '黄埔大道西601号', campuses: [{ name: '石牌', district: '天河区', address: '黄埔大道西601号' }, { name: '番禺', district: '番禺区', address: '兴业大道东855号' }] },
    { name: '深圳大学', shortName: '深大', tier: '本科', city: '深圳', province: '广东', district: '南山区', address: '南海大道3688号', campuses: [{ name: '后海', district: '南山区', address: '南海大道3688号' }, { name: '西丽', district: '南山区', address: '学苑大道1098号' }, { name: '丽湖', district: '南山区', address: '学苑大道1089号' }] },
    { name: '南方科技大学', shortName: '南科大', tier: '双一流', city: '深圳', province: '广东', district: '南山区', address: '学苑大道1088号', campuses: [{ name: '主校区', district: '南山区', address: '学苑大道1088号' }] },
    { name: '哈尔滨工业大学（深圳）', shortName: '哈工大深圳', tier: '985', city: '深圳', province: '广东', district: '南山区', address: '深圳大学城', campuses: [{ name: '深圳校区', district: '南山区', address: '深圳大学城' }] },
    { name: '北京师范大学珠海分校', shortName: '北师大珠海', tier: '985', city: '珠海', province: '广东', district: '香洲区', address: '唐家湾金凤路18号', campuses: [{ name: '珠海', district: '香洲区', address: '唐家湾金凤路18号' }] },
  ],
  '浙江': [
    { name: '浙江大学', shortName: '浙大', tier: '985', city: '杭州', province: '浙江', district: '西湖区', address: '余杭塘路866号', campuses: [{ name: '紫金港', district: '西湖区', address: '余杭塘路866号' }, { name: '玉泉', district: '西湖区', address: '浙大路38号' }, { name: '西溪', district: '西湖区', address: '天目山路148号' }, { name: '舟山', district: '定海区', address: '浙江舟山' }, { name: '海宁', district: '海宁市', address: '浙江海宁' }] },
  ],
  '江苏': [
    { name: '南京大学', shortName: '南大', tier: '985', city: '南京', province: '江苏', district: '鼓楼区', address: '汉口路22号', campuses: [{ name: '鼓楼', district: '鼓楼区', address: '汉口路22号' }, { name: '仙林', district: '栖霞区', address: '仙林大道163号' }] },
    { name: '东南大学', shortName: '东大', tier: '985', city: '南京', province: '江苏', district: '玄武区', address: '四牌楼2号', campuses: [{ name: '四牌楼', district: '玄武区', address: '四牌楼2号' }, { name: '九龙湖', district: '江宁区', address: '东南大学路2号' }] },
    { name: '南京航空航天大学', shortName: '南航', tier: '211', city: '南京', province: '江苏', district: '秦淮区', address: '御道街29号', campuses: [{ name: '明故宫', district: '秦淮区', address: '御道街29号' }, { name: '将军路', district: '江宁区', address: '将军大道29号' }] },
    { name: '南京理工大学', shortName: '南理工', tier: '211', city: '南京', province: '江苏', district: '玄武区', address: '孝陵卫200号', campuses: [{ name: '孝陵卫', district: '玄武区', address: '孝陵卫200号' }] },
    { name: '苏州大学', shortName: '苏大', tier: '211', city: '苏州', province: '江苏', district: '姑苏区', address: '十梓街1号', campuses: [{ name: '天赐庄', district: '姑苏区', address: '十梓街1号' }, { name: '独墅湖', district: '工业园区', address: '仁爱路199号' }] },
  ],
  '湖北': [
    { name: '武汉大学', shortName: '武大', tier: '985', city: '武汉', province: '湖北', district: '武昌区', address: '八一路299号', campuses: [{ name: '文理学部', district: '武昌区', address: '八一路299号' }, { name: '工学部', district: '洪山区', address: '珞瑜路129号' }, { name: '信息学部', district: '洪山区', address: '珞瑜路37号' }, { name: '医学部', district: '武昌区', address: '东湖路115号' }] },
    { name: '华中科技大学', shortName: '华科', tier: '985', city: '武汉', province: '湖北', district: '洪山区', address: '珞瑜路1037号', campuses: [{ name: '主校区', district: '洪山区', address: '珞瑜路1037号' }, { name: '同济医学院', district: '硚口区', address: '航空路13号' }] },
    { name: '中南财经政法大学', shortName: '中南财大', tier: '211', city: '武汉', province: '湖北', district: '南湖', address: '南湖大道182号', campuses: [{ name: '南湖', district: '南湖', address: '南湖大道182号' }] },
  ],
  '陕西': [
    { name: '西安交通大学', shortName: '西交', tier: '985', city: '西安', province: '陕西', district: '碑林区', address: '咸宁西路28号', campuses: [{ name: '兴庆', district: '碑林区', address: '咸宁西路28号' }, { name: '雁塔', district: '雁塔区', address: '雁塔西路74号' }, { name: '曲江', district: '雁塔区', address: '雁塔西路99号' }] },
    { name: '西北工业大学', shortName: '西工大', tier: '985', city: '西安', province: '陕西', district: '碑林区', address: '友谊西路127号', campuses: [{ name: '友谊', district: '碑林区', address: '友谊西路127号' }, { name: '长安', district: '长安区', address: '东祥路1号' }] },
  ],
  '四川': [
    { name: '四川大学', shortName: '川大', tier: '985', city: '成都', province: '四川', district: '武侯区', address: '一环路南一段24号', campuses: [{ name: '望江', district: '武侯区', address: '一环路南一段24号' }, { name: '华西', district: '武侯区', address: '人民南路三段17号' }, { name: '江安', district: '双流区', address: '川大路二段' }] },
    { name: '电子科技大学', shortName: '电子科大', tier: '985', city: '成都', province: '四川', district: '成华区', address: '建设北路二段4号', campuses: [{ name: '沙河', district: '成华区', address: '建设北路二段4号' }, { name: '清水河', district: '高新区', address: '西源大道2006号' }] },
  ],
  '天津': [
    { name: '南开大学', shortName: '南开', tier: '985', city: '天津', province: '天津', district: '南开区', address: '卫津路94号', campuses: [{ name: '八里台', district: '南开区', address: '卫津路94号' }, { name: '津南', district: '津南区', address: '雅观路135号' }] },
    { name: '天津大学', shortName: '天大', tier: '985', city: '天津', province: '天津', district: '南开区', address: '卫津路92号', campuses: [{ name: '卫津路', district: '南开区', address: '卫津路92号' }, { name: '北洋园', district: '津南区', address: '雅观路135号' }] },
  ],
  '福建': [
    { name: '厦门大学', shortName: '厦大', tier: '985', city: '厦门', province: '福建', district: '思明区', address: '思明南路422号', campuses: [{ name: '思明', district: '思明区', address: '思明南路422号' }, { name: '翔安', district: '翔安区', address: '翔安南路' }, { name: '海韵', district: '思明区', address: '软件园二期' }] },
  ],
  '安徽': [
    { name: '中国科学技术大学', shortName: '中科大', tier: '985', city: '合肥', province: '安徽', district: '包河区', address: '金寨路96号', campuses: [{ name: '南校区', district: '包河区', address: '金寨路96号' }, { name: '西校区', district: '蜀山区', address: '黄山路' }] },
    { name: '合肥工业大学', shortName: '合工大', tier: '211', city: '合肥', province: '安徽', district: '包河区', address: '屯溪路193号', campuses: [{ name: '屯溪路', district: '包河区', address: '屯溪路193号' }, { name: '翡翠湖', district: '蜀山区', address: '翡翠路420号' }] },
  ],
  '山东': [
    { name: '山东大学', shortName: '山大', tier: '985', city: '济南', province: '山东', district: '历城区', address: '山大南路27号', campuses: [{ name: '中心', district: '历城区', address: '山大南路27号' }, { name: '兴隆山', district: '历城区', address: '二环东路12550号' }, { name: '千佛山', district: '历下区', address: '经十路17923号' }, { name: '软件园', district: '历下区', address: '舜华路1500号' }, { name: '兴隆山', district: '历城区', address: '二环东路12550号' }] },
    { name: '中国海洋大学', shortName: '中海洋', tier: '985', city: '青岛', province: '山东', district: '崂山区', address: '松岭路238号', campuses: [{ name: '崂山', district: '崂山区', address: '松岭路238号' }, { name: '鱼山', district: '市南区', address: '鱼山路5号' }] },
  ],
  '湖南': [
    { name: '中南大学', shortName: '中南', tier: '985', city: '长沙', province: '湖南', district: '岳麓区', address: '麓山南路932号', campuses: [{ name: '校本部', district: '岳麓区', address: '麓山南路932号' }, { name: '湘雅', district: '开福区', address: '湘雅路110号' }] },
    { name: '湖南大学', shortName: '湖大', tier: '985', city: '长沙', province: '湖南', district: '岳麓区', address: '麓山南路1号', campuses: [{ name: '南校区', district: '岳麓区', address: '麓山南路1号' }, { name: '财院校区', district: '岳麓区', address: '石佳冲路109号' }] },
  ],
  '黑龙江': [
    { name: '哈尔滨工业大学', shortName: '哈工大', tier: '985', city: '哈尔滨', province: '黑龙江', district: '南岗区', address: '西大直街92号', campuses: [{ name: '一校区', district: '南岗区', address: '西大直街92号' }, { name: '二校区', district: '南岗区', address: '黄河路73号' }, { name: '科学园', district: '南岗区', address: '一匡街2号' }] },
  ],
  '吉林': [
    { name: '吉林大学', shortName: '吉大', tier: '985', city: '长春', province: '吉林', district: '朝阳区', address: '前进大街2699号', campuses: [{ name: '前卫南区', district: '朝阳区', address: '前进大街2699号' }, { name: '前卫北区', district: '朝阳区', address: '解放大路2519号' }, { name: '南岭', district: '南关区', address: '人民大街5988号' }, { name: '朝阳', district: '朝阳区', address: '清华路' }, { name: '新民', district: '朝阳区', address: '新民大街' }, { name: '南湖', district: '朝阳区', address: '南湖大路' }, { name: '和平', district: '朝阳区', address: '西安大路5333号' }] },
  ],
  '辽宁': [
    { name: '大连理工大学', shortName: '大工', tier: '985', city: '大连', province: '辽宁', district: '甘井子区', address: '凌工路2号', campuses: [{ name: '主校区', district: '甘井子区', address: '凌工路2号' }, { name: '开发区', district: '金州区', address: '辽河西路18号' }] },
    { name: '东北大学', shortName: '东大', tier: '985', city: '沈阳', province: '辽宁', district: '和平区', address: '文化路3号巷11号', campuses: [{ name: '南湖', district: '和平区', address: '文化路3号巷11号' }, { name: '浑南', district: '浑南区', address: '智慧三街159号' }] },
  ],
  '河南': [
    { name: '郑州大学', shortName: '郑大', tier: '211', city: '郑州', province: '河南', district: '中原区', address: '科学大道100号', campuses: [{ name: '主校区', district: '中原区', address: '科学大道100号' }, { name: '北校区', district: '金水区', address: '文化路97号' }, { name: '南校区', district: '二七区', address: '大学路75号' }, { name: '东校区', district: '管城回族区', address: '明德街' }] },
  ],
  '重庆': [
    { name: '重庆大学', shortName: '重大', tier: '985', city: '重庆', province: '重庆', district: '沙坪坝区', address: '沙正街174号', campuses: [{ name: 'A区', district: '沙坪坝区', address: '沙正街174号' }, { name: 'B区', district: '沙坪坝区', address: '沙北街83号' }, { name: '虎溪', district: '沙坪坝区', address: '大学城南路55号' }] },
  ],
  '甘肃': [
    { name: '兰州大学', shortName: '兰大', tier: '985', city: '兰州', province: '甘肃', district: '城关区', address: '天水南路222号', campuses: [{ name: '城关', district: '城关区', address: '天水南路222号' }, { name: '榆中', district: '榆中县', address: '夏官营大学城' }] },
  ],
  // Frank 27 14:12 Comment 1：补全国 34 省（西藏/香港/澳门/台湾）
  '西藏': [
    { name: '西藏大学', shortName: '藏大', tier: '211', city: '拉萨', province: '西藏', district: '城关区', address: '藏大东路10号', campuses: [{ name: '河坝林', district: '城关区', address: '藏大东路10号' }] },
  ],
  '香港': [
    { name: '香港大学', shortName: 'HKU', tier: '本科', city: '香港', province: '香港', district: '中西区', address: '薄扶林道', campuses: [{ name: '本部', district: '中西区', address: '薄扶林道' }] },
    { name: '香港中文大学', shortName: 'CUHK', tier: '本科', city: '香港', province: '香港', district: '沙田区', address: '大学站', campuses: [{ name: '本部', district: '沙田区', address: '大学站' }] },
    { name: '香港科技大学', shortName: 'HKUST', tier: '本科', city: '香港', province: '香港', district: '西贡区', address: '清水湾', campuses: [{ name: '本部', district: '西贡区', address: '清水湾' }] },
  ],
  '澳门': [
    { name: '澳门大学', shortName: 'UM', tier: '本科', city: '澳门', province: '澳门', district: '氹仔', address: '大学大马路', campuses: [{ name: '本部', district: '氹仔', address: '大学大马路' }] },
  ],
  '台湾': [
    { name: '国立台湾大学', shortName: '台大', tier: '本科', city: '台北', province: '台湾', district: '大安区', address: '罗斯福路四段1号', campuses: [{ name: '校本部', district: '大安区', address: '罗斯福路四段1号' }] },
    { name: '国立清华大学', shortName: '清大', tier: '本科', city: '新竹', province: '台湾', district: '东区', address: '光复路二段101号', campuses: [{ name: '校本部', district: '东区', address: '光复路二段101号' }] },
  ],
};

/**
 * Frank 2026-08-21 #8 + #10：把扁平数据构造成省/市/区树
 */
export const PROVINCES: ProvinceData[] = (() => {
  const provinceMap = new Map<string, Map<string, Set<string>>>();
  for (const univ of Object.values(UNIV_BY_PROVINCE).flat()) {
    if (!provinceMap.has(univ.province)) {
      provinceMap.set(univ.province, new Map());
    }
    const cityMap = provinceMap.get(univ.province)!;
    if (!cityMap.has(univ.city)) {
      cityMap.set(univ.city, new Set());
    }
    const districts = cityMap.get(univ.city)!;
    for (const campus of univ.campuses) {
      districts.add(campus.district);
    }
  }
  return Array.from(provinceMap.entries()).map(([province, cityMap]) => ({
    province,
    cities: Array.from(cityMap.entries()).map(([city, districts]) => ({
      city,
      districts: Array.from(districts).sort(),
    })),
  }));
})();

/** 按省/市/区筛选大学 */
export function getUniversities(
  province: string,
  city: string,
  district?: string
): University[] {
  const list = UNIV_BY_PROVINCE[province] ?? [];
  return list.filter((u) => {
    if (u.city !== city) return false;
    if (district && u.district !== district) return false;
    return true;
  });
}

/**
 * Frank 2026-08-21 #8 关键校验：申请人填的 district 必须和学校所在 district 一致
 *  - 主校区在 A 区，但申请人想办活动在 B 区（跨校区）→ 报错
 *  - 提示：可改选 B 区所在学校 / 选该校 B 校区
 */
export function validateDistrictMatch(
  schoolProvince: string,
  schoolCity: string,
  schoolDistrict: string,
  schoolName: string,
  applicantProvince: string,
  applicantCity: string,
  applicantDistrict: string
): { ok: true; campus?: Campus } | { ok: false; reason: string } {
  if (schoolProvince !== applicantProvince || schoolCity !== applicantCity) {
    return { ok: false, reason: `学校所在省市（${schoolProvince} ${schoolCity}）与活动地点省市（${applicantProvince} ${applicantCity}）不一致` };
  }
  if (schoolDistrict !== applicantDistrict) {
    // 查学校是否有 applicantDistrict 对应的校区
    const univ = UNIV_BY_PROVINCE[schoolProvince]?.find((u) => u.name === schoolName);
    const matchedCampus = univ?.campuses.find((c) => c.district === applicantDistrict);
    if (matchedCampus) {
      // 用户用的是其他校区，校验通过
      return { ok: true, campus: matchedCampus };
    }
    return {
      ok: false,
      reason: `学校主校区在 ${schoolDistrict} 区，但活动地点在 ${applicantDistrict} 区（该校在该区无校区）。请改选 ${schoolDistrict} 区或选择 ${schoolDistrict} 区的学校`,
    };
  }
  return { ok: true };
}

/** 静态兜底：v2 用 dw_universities 飞书表替换 */
export const TOTAL_UNIVERSITIES = Object.values(UNIV_BY_PROVINCE).flat().length;
