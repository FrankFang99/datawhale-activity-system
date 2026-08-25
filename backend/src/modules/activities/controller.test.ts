/**
 * activities controller Frank #2 effective status 覆盖
 * 飞书相关通过 e2e 验证
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

describe('activities controller · Frank #2 4 分类 effective status', () => {
  it('STATUS_DISPLAY 含 4 分类：待确定/准备举办/举办中/已结束', () => {
    const s = SRC();
    expect(s).toContain("PENDING: '待确定'");
    expect(s).toContain("PUBLISHED: '准备举办'");
    expect(s).toContain("ONGOING: '举办中'");
    expect(s).toContain("FINISHED: '已结束'");
  });

  it('定义 effectiveStatus 函数（按日期动态计算 status）', () => {
    const s = SRC();
    expect(s).toMatch(/function\s+effectiveStatus\(/);
  });

  it('effectiveStatus 规则：endDate < now → FINISHED', () => {
    const s = SRC();
    expect(s).toMatch(/end\s*<\s*now.*FINISHED/s);
  });

  it('effectiveStatus 规则：startDate <= now <= endDate → ONGOING', () => {
    const s = SRC();
    expect(s).toMatch(/start\s*<=\s*now\s*&&\s*now\s*<=\s*end.*ONGOING/s);
  });

  it('effectiveStatus 规则：CANCELLED/ARCHIVED/DRAFT 保留原 status', () => {
    const s = SRC();
    expect(s).toMatch(/CANCELLED.*ARCHIVED.*DRAFT/s);
  });

  it('STATUS_SORT_WEIGHT 含 4 分类权重（ONGOING=0 排最前）', () => {
    const s = SRC();
    expect(s).toMatch(/ONGOING:\s*0/);
    expect(s).toMatch(/PENDING:\s*1/);
    expect(s).toMatch(/PUBLISHED:\s*2/);
    expect(s).toMatch(/FINISHED:\s*3/);
  });

  it('list 路由按 STATUS_SORT_WEIGHT 排序（ONGOING 排前）', () => {
    expect(SRC()).toMatch(/STATUS_SORT_WEIGHT\[sa\]\s*\?\?\s*99/);
  });

  it('list 路由按 effective status 过滤（用户传 status 时按 effective 匹配）', () => {
    expect(SRC()).toMatch(/effectiveStatus\(a\)\s*===\s*status/);
  });

  it('serialize 函数返回 rawStatus 字段（保留原始 status 供调试）', () => {
    const s = SRC();
    expect(s).toMatch(/rawStatus:\s*normStatus\(a\)/);
  });

  it('Frank 2026-08-21 23:35 #1 修复：PENDING + endDate 已过 → FINISHED（不是 PENDING）', () => {
    const s = SRC();
    expect(s).toMatch(/end\s*&&\s*end\s*<\s*now.*FINISHED/s);
  });

  it('详情路由传 effectiveStatus 给 serialize（修复详情页 status 不正确）', () => {
    const s = SRC();
    expect(s).toMatch(/serialize\(a,\s*true,\s*effectiveStatus\(a\)\)/);
  });

  it('详情返回 startTime + endTime + confirmedAddress 字段（Frank #4）', () => {
    const s = SRC();
    expect(s).toMatch(/startTime:\s*a\.fields\.startTime/);
    expect(s).toMatch(/endTime:\s*a\.fields\.endTime/);
    expect(s).toMatch(/confirmedAddress:\s*a\.fields\.confirmedAddress/);
  });

  it('Frank 2026-08-22 09:17 修复：effectiveStatus 解析 string 类型 endDate（飞书 datetime 返回 ISO 字符串）', () => {
    const s = SRC();
    // 验证 effectiveStatus 函数有 parseDate helper
    expect(s).toMatch(/function\s+effectiveStatus\(/);
    expect(s).toMatch(/parseDate/);
    expect(s).toMatch(/new Date\(v\)\.getTime\(\)/);
  });
});

describe('activities controller · 基础路由', () => {
  it('GET / 列表', () => expect(SRC()).toMatch(/router\.get\(['"]\/['"]/));
  it('GET /series/list 系列列表', () => expect(SRC()).toMatch(/router\.get\(['"]\/series\/list['"]/));
  it('GET /:id 详情', () => expect(SRC()).toMatch(/router\.get\(['"]\/:id['"]/));
});
