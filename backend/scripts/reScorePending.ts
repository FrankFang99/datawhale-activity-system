/**
 * 重新评分所有 SCREENING 申请（Frank 28 12:30 反馈：换标准后要重打分数）
 *
 * 用法：cd backend && npx tsx scripts/reScorePending.ts
 */
import { feishuClient, LarkRecord } from '../src/services/feishu/client';
import { config } from '../src/config';
import { scoreApplication } from '../src/modules/score/engine';

interface ApplicationRecord extends LarkRecord {
  fields: {
    applicationId?: string;
    activityId?: string;
    venueStatus?: string;
    recruitChannel?: string[];
    experience?: string;
    motivation?: string;
    participantValue?: string;
    expectedTimeRange?: string;
    expectedDate?: number | null;
  };
}

interface ActivityRecord extends LarkRecord {
  fields: {
    activityId?: string;
    startDate?: number;
    endDate?: number;
  };
}

async function main() {
  console.log('=== 重新评分 SCREENING 申请 ===\n');
  // 1. 拉所有申请 + 所有活动
  const { items: allApps } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
  const { items: allActs } = await feishuClient.listRecords(config.feishu.tables.activities, { pageSize: 200 });
  const apps = allApps as ApplicationRecord[];
  const acts = allActs as ActivityRecord[];

  // 2. 筛选 SCREENING 申请
  const screening = apps.filter((a) => normStatus(a.fields.applicationId, a) === 'SCREENING');
  console.log(`找到 ${screening.length} 条 SCREENING 申请\n`);

  let success = 0;
  let fail = 0;
  for (const app of screening) {
    const appId = app.fields.applicationId ?? app.record_id;
    const activityId = app.fields.activityId;
    if (!activityId) {
      console.log(`  ✗ ${appId} 无 activityId，跳过`);
      fail++;
      continue;
    }
    const act = acts.find((a) => a.fields.activityId === activityId);

    // 组装 score engine input
    const expectedTimeRange = app.fields.expectedTimeRange ?? '';
    const expectedTimeRangeDateCount = expectedTimeRange
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean).length;

    try {
      const breakdown = scoreApplication({
        venueStatus: app.fields.venueStatus,
        recruitChannel: app.fields.recruitChannel,
        experience: app.fields.experience,
        motivation: app.fields.motivation,
        participantValue: app.fields.participantValue,
        expectedTimeRange,
        expectedTimeRangeDateCount,
        expectedDate: app.fields.expectedDate ?? null,
        activityStartDate: act?.fields.startDate ?? Date.now(),
        activityEndDate: act?.fields.endDate ?? Date.now() + 30 * 24 * 3600 * 1000,
      });

      // updateRecord 写新 scoreBreakdown + score + grade
      await feishuClient.updateRecord(config.feishu.tables.applications, app.record_id, {
        score: breakdown.total,
        grade: breakdown.grade,
        scoreBreakdown: JSON.stringify(breakdown),
      });
      const r004 = breakdown.RC004;
      const r006 = breakdown.RC006;
      console.log(`  ✓ ${appId}  ${breakdown.total}(${breakdown.grade})  RC004=${r004.score}/${r004.max}  RC006=${r006.score}/${r006.max}`);
      success++;
    } catch (e: any) {
      console.log(`  ✗ ${appId} FAIL: ${e.message?.slice(0, 100)}`);
      fail++;
    }
  }

  console.log(`\n=== 完成：${success} ok, ${fail} failed ===`);
}

function normStatus(_id: string, _app: any): string {
  const s = _app.fields?.status;
  if (Array.isArray(s)) return String(s[0] ?? '');
  return String(s ?? '');
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e);
  process.exit(1);
});
