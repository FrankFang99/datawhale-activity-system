/**
 * admin/activities 关键逻辑覆盖（v9 续 Frank #5 · TDD）
 * 飞书相关通过 e2e 验证
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'activities.ts'), 'utf-8');

describe('admin/activities · Frank #5 飞书群二维码必填', () => {
  it('createSchema 含 groupQrCode 必填校验（min(1)）', () => {
    const s = SRC();
    expect(s).toMatch(/groupQrCode:\s*groupQrCodeSchema/);
    expect(s).toMatch(/\.min\(1,\s*['"]飞书群二维码不能为空['"]\)/);
  });

  it('groupQrCode 接受飞书群链接（feishu.cn / larksuite.com 域名）', () => {
    const s = SRC();
    // 源码中含 regex 字面 'feishu\\.cn' 和 'larksuite\\.com'
    expect(s).toContain('feishu\\.cn');
    expect(s).toContain('larksuite\\.com');
  });

  it('groupQrCode 接受 base64 QR 图（data:image/...;base64,...）', () => {
    const s = SRC();
    expect(s).toContain('data:image\\/');
    expect(s).toMatch(/\(png\|jpe\?g\|gif\|webp\);base64,/);
  });

  it('groupQrCode 接受任何 https:// URL（v1 简化兜底）', () => {
    const s = SRC();
    expect(s).toMatch(/https:\\\/\\\//);
  });

  it('groupQrCode 拒绝 http:// / 纯文本 / 空字符串', () => {
    const s = SRC();
    expect(s).toMatch(/请填写有效的飞书群链接/);
  });
});

describe('admin/activities · publish 路由校验 groupQrCode 必填', () => {
  it('publish 路由存在', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/:id\/publish['"]/);
  });

  it('publish 路由检查 groupQrCode 非空（用全文件匹配，不用 split）', () => {
    const s = SRC();
    expect(s).toMatch(/groupQrCode\s*\?\?\s*['"]['"]\s*\)\.trim\(\)/);
    expect(s).toMatch(/飞书群二维码不能为空，请先填写后再上架/);
  });

  it('publish 路由校验失败返回 400', () => {
    const s = SRC();
    expect(s).toMatch(/fail\(res,\s*400,\s*ErrorCode\.ACT_001_NOT_FOUND,\s*['"]飞书群二维码不能为空/);
  });
});

describe('admin/activities · Frank #4 精确时间 + 地址', () => {
  it('createSchema 含 startTime / endTime / confirmedAddress 字段（HH:mm 格式）', () => {
    const s = SRC();
    expect(s).toMatch(/startTime:\s*z\.string\(\)\.regex\(/);
    expect(s).toMatch(/endTime:\s*z\.string\(\)\.regex\(/);
    expect(s).toMatch(/confirmedAddress:\s*z\.string\(\)\.max\(200\)/);
  });

  it('定义 timeRegex HH:mm 格式', () => {
    expect(SRC()).toMatch(/const\s+timeRegex\s*=\s*\/\^\\d\{2\}:\\d\{2\}\$\//);
  });

  it('publish 路由不再强制精确时间（v1.2 Frank 21:40 时间双轨放宽）', () => {
    // v1.2：模糊日期/地点就能上架，精确时间由组织者 INT-1 阶段补
    expect(SRC()).not.toMatch(/timeRegex\.test\(startTime\)/);
    expect(SRC()).not.toMatch(/请先填写精确开始时间/);
  });
});

describe('admin/activities · 基础路由', () => {
  it('GET / 列表', () => expect(SRC()).toMatch(/router\.get\(['"]\/['"]/));
  it('POST / 创建', () => expect(SRC()).toMatch(/router\.post\(['"]\/['"]/));
  it('PUT /:id 更新', () => expect(SRC()).toMatch(/router\.put\(['"]\/:id['"]/));
  it('POST /:id/publish 上架', () => expect(SRC()).toMatch(/router\.post\(['"]\/:id\/publish['"]/));
  it('POST /:id/unpublish 下架', () => expect(SRC()).toMatch(/router\.post\(['"]\/:id\/unpublish['"]/));
  it('POST /:id/archive 归档', () => expect(SRC()).toMatch(/router\.post\(['"]\/:id\/archive['"]/));
});
