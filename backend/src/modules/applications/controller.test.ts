/**
 * applications controller 路由 + 集成覆盖（v9 B.1 完整版 · TDD）
 * 飞书相关（feishuClient.createRecord / listRecords）通过 e2e 验证；
 * 本测试只覆盖 source 层（路由、import、schema 写入、调用顺序）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

describe('applications controller · B.1 完整版 · submit 集成 dispatch', () => {
  it('import detectApplicantRole + getDispatchNotice', () => {
    const s = SRC();
    expect(s).toMatch(/import\s*\{[^}]*detectApplicantRole[^}]*\}\s*from\s*['"]\.\/dispatch['"]/);
    expect(s).toMatch(/getDispatchNotice/);
  });

  it('import sendMessage from messages/controller（发站内消息）', () => {
    const s = SRC();
    expect(s).toMatch(/import\s*\{[^}]*sendMessage[^}]*\}\s*from\s*['"]\.\.\/messages\/controller['"]/);
  });

  it('submit 路由调 detectApplicantRole 判定角色', () => {
    expect(SRC()).toMatch(/detectApplicantRole\s*\(/);
  });

  it('submit 路由写 applicantRole 字段到飞书', () => {
    const s = SRC();
    // 找 createRecord({...}) 块
    const m = s.match(/feishuClient\.createRecord\([^,]+,\s*\{([\s\S]*?)\}\s*\)/);
    expect(m).toBeTruthy();
    expect(m![1]).toMatch(/applicantRole/);
  });

  it('submit 路由调 sendMessage（发站内消息）', () => {
    expect(SRC()).toMatch(/await\s+sendMessage\s*\(/);
  });

  it('submit 路由用 getDispatchNotice 拿文案', () => {
    expect(SRC()).toMatch(/getDispatchNotice\s*\(/);
  });

  it('submit 路由返回 applicantRole 字段', () => {
    expect(SRC()).toMatch(/applicantRole[\s\S]{0,200}activityTitle/);
  });

  it('submit 路由站内消息 link 指向 /applications/:id（v12 · 跳新建的 ApplicationReview 页面，所有角色可看）', () => {
    expect(SRC()).toMatch(/link:\s*`\/applications\/\$\{applicationId\}`/);
  });
});

describe('applications controller · 路由覆盖', () => {
  it('POST /submit', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/submit['"]/);
  });
  it('GET /:id/dispatch', () => {
    expect(SRC()).toMatch(/router\.get\(['"]\/:id\/dispatch['"]/);
  });
  it('GET /mine', () => {
    expect(SRC()).toMatch(/router\.get\(['"]\/mine['"]/);
  });
  it('GET /:id', () => {
    expect(SRC()).toMatch(/router\.get\(['"]\/:id['"]/);
  });
  it('GET /by-activity/:activityId（v10 新增 · 找该活动 CONFIRMED 申请）', () => {
    expect(SRC()).toMatch(/router\.get\(['"]\/by-activity\/:activityId['"]/);
  });
});

describe('applications controller · 鉴权', () => {
  it('所有路由用 authRequired', () => {
    const lines = SRC().split('\n').filter((l) => /router\.(get|post)\(/.test(l));
    for (const line of lines) {
      expect({ line: line.trim(), hasAuth: line.includes('authRequired') }).toEqual({ line: line.trim(), hasAuth: true });
    }
  });

  it('GET /:id 自己/ADMIN/OPERATOR/VOLUNTEER 可看', () => {
    const s = SRC();
    expect(s).toMatch(/a\.fields\.userId\s*!==\s*req\.user!\.userId\s*&&\s*!\[\s*['"]ADMIN['"]\s*,\s*['"]OPERATOR['"]\s*,\s*['"]VOLUNTEER['"]\s*\]\.includes/);
  });
});

describe('applications controller · 状态机集成', () => {
  it('所有申请都进 SCREENING（v4 修订）', () => {
    expect(SRC()).toMatch(/const\s+newStatus\s*=\s*['"]SCREENING['"]/);
  });
});

describe('applications controller · v14 Frank 19:46 反馈 Comment 1 · 详情页返回飞书 base 全字段', () => {
  it('GET /:id 返回 organizerName/Phone/Email（联系信息完整可见，志愿者对接用）', () => {
    const s = SRC();
    // 找 GET /:id handler 内的 return ok(res, {...}) 块
    const getByIdMatch = s.match(/router\.get\(['"]\/:id['"][\s\S]*?return\s+ok\(res,\s*\{([\s\S]*?)\}\s*\)/);
    expect(getByIdMatch).toBeTruthy();
    const body = getByIdMatch![1];
    expect(body).toMatch(/organizerName/);
    expect(body).toMatch(/organizerPhone/);
    expect(body).toMatch(/organizerEmail/);
  });

  it('GET /:id 返回 expectedDate/location/motivation/experience/participantValue（活动规划字段）', () => {
    const s = SRC();
    const getByIdMatch = s.match(/router\.get\(['"]\/:id['"][\s\S]*?return\s+ok\(res,\s*\{([\s\S]*?)\}\s*\)/);
    expect(getByIdMatch).toBeTruthy();
    const body = getByIdMatch![1];
    expect(body).toMatch(/expectedDate/);
    expect(body).toMatch(/location/);
    expect(body).toMatch(/motivation/);
    expect(body).toMatch(/experience/);
    expect(body).toMatch(/participantValue/);
  });

  it('GET /:id 返回 venueStatus/recruitChannel（5 维评分 RC-001/RC-002 来源）', () => {
    const s = SRC();
    const getByIdMatch = s.match(/router\.get\(['"]\/:id['"][\s\S]*?return\s+ok\(res,\s*\{([\s\S]*?)\}\s*\)/);
    expect(getByIdMatch).toBeTruthy();
    const body = getByIdMatch![1];
    expect(body).toMatch(/venueStatus/);
    expect(body).toMatch(/recruitChannel/);
  });

  it('GET /:id 返回 volunteerId/volunteerName（对接志愿者信息）', () => {
    const s = SRC();
    const getByIdMatch = s.match(/router\.get\(['"]\/:id['"][\s\S]*?return\s+ok\(res,\s*\{([\s\S]*?)\}\s*\)/);
    expect(getByIdMatch).toBeTruthy();
    const body = getByIdMatch![1];
    expect(body).toMatch(/volunteerId/);
    expect(body).toMatch(/volunteerName/);
  });

  it('GET /:id 返回 scoreDetails/auditLog/riskFlags（评分明细 + 审核日志 + 风险标记）', () => {
    const s = SRC();
    const getByIdMatch = s.match(/router\.get\(['"]\/:id['"][\s\S]*?return\s+ok\(res,\s*\{([\s\S]*?)\}\s*\)/);
    expect(getByIdMatch).toBeTruthy();
    const body = getByIdMatch![1];
    expect(body).toMatch(/scoreDetails/);
    expect(body).toMatch(/auditLog/);
    expect(body).toMatch(/riskFlags/);
  });

  it('GET /:id 解析 scoreDetails JSON（5 维 reason 文本）', () => {
    const s = SRC();
    expect(s).toMatch(/JSON\.parse\(a\.fields\.scoreDetails\)/);
  });

  it('GET /:id 解析 auditLog JSON（来自 scoreBreakdown.auditLog）', () => {
    const s = SRC();
    expect(s).toMatch(/JSON\.parse\(a\.fields\.scoreBreakdown\)/);
    expect(s).toMatch(/auditLog/);
  });

  it('GET /:id 计算 riskFlags（motivation<30字 或 experience<20字）', () => {
    const s = SRC();
    expect(s).toMatch(/motivationShort/);
    expect(s).toMatch(/experienceShort/);
  });
});

describe('applications controller · v16.7 notify-volunteer-review 权限扩展（Frank 19:41 反馈）', () => {
  it('notify-volunteer-review 路由存在', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/:id\/notify-volunteer-review['"]/);
  });

  it('权限：组织者本人 OR 对接志愿者（volunteerId 匹配）OR ADMIN/OPERATOR', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/:id\/notify-volunteer-review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 1500);
    expect(slice).toMatch(/isOrganizerSelf/);
    expect(slice).toMatch(/isAssignedVolunteer/);
    expect(slice).toMatch(/isAdminOrOperator/);
    // 错误提示改了：原 "仅组织者" → 现 "仅组织者或对接志愿者"
    expect(slice).toMatch(/仅组织者或对接志愿者/);
  });

  it('志愿者触发校验 volunteerId 匹配（避免越权）', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/:id\/notify-volunteer-review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 1500);
    expect(slice).toMatch(/volunteerId === req\.user!\.userId/);
  });
});
