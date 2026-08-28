/**
 * 清空 Datawhale 业务数据（保留 dw_users + dw_stage_tasks + 演示用申请）
 * Frank 28 08:16 反馈："申请啥的清空，从头测试，今天要交"
 * Frank 28 13:38 反馈："以后重测不要清空 5 阶段表相应设置"
 *   → 保留 dw_stage_tasks（5 阶段 19 个子任务的 status / reviewStatus / operatorReviewStatus 等进度）
 * Frank 28 15:40 反馈："今天下午刚让你改的，怎么都没了？"
 *   → clearTestData 把所有申请都删了，演示用 78 分 A 级 / 86 分 A 级申请都被清掉
 *   → 修法：保留带 scoreBreakdown 的演示申请（Frank 调评分标准后生成的演示数据）
 *   → 演示数据 = 包含 scoreBreakdown 字段的申请（"真实跑过评分引擎"，重测要保留看效果）
 *
 * 用法：cd backend && npx tsx scripts/clearTestData.ts
 */
import { execFileSync } from 'child_process';

const BASE_TOKEN = 'T3lJbRN7LaqdQqs3AlUchCxLnKb';
const TABLES = {
  activities: 'tblg4WP41rKbilJR',
  applications: 'tblZRjMNbwNCDHwq',
  // Frank 28 13:38：不删 stageTasks（保留 5 阶段 19 个子任务的设置）
  messages: 'tblsfSU3cdkwOWWX',
  // 不删：dw_users（演示账号）、dw_stage_tasks（5 阶段子任务）
  // Frank 28 15:40：不删带 scoreBreakdown 的演示申请（保留"调评分标准后"生成的演示数据）
};

// 保护申请：保留带 scoreBreakdown 字段的（演示用 Frank 调过评分标准后生成的）
// 不保护：只 status 字段的（中间状态申请、用户自测的）
const PROTECT_APPLICATION_IF_HAS_FIELDS = ['scoreBreakdown'];

function runLark(args: string[]): any {
  // lark-cli 在 npx-cli.js 同一目录，tsx 进程 spawn lark-cli 找不到，用绝对路径
  const larkCli = 'C:\\Users\\15088\\.trae-cn\\binaries\\node\\versions\\24.13.0\\lark-cli.cmd';
  const out = execFileSync(larkCli, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, shell: true });
  return JSON.parse(out);
}

function listAll(tableId: string): string[] {
  const r = runLark(['base', '+record-list', '--base-token', BASE_TOKEN, '--table-id', tableId, '--format', 'json']);
  return (r?.data?.record_id_list ?? []) as string[];
}

function listAllWithFields(tableId: string): Array<{ record_id: string; fields: Record<string, any> }> {
  const r = runLark(['base', '+record-list', '--base-token', BASE_TOKEN, '--table-id', tableId, '--format', 'json']);
  const items = (r?.data?.data ?? []) as any[][];
  const fields = (r?.data?.fields ?? []) as string[];
  const recordIds = (r?.data?.record_id_list ?? []) as string[];
  return items.map((row, i) => {
    const obj: Record<string, any> = {};
    fields.forEach((fname, j) => { obj[fname] = row[j]; });
    return { record_id: recordIds[i], fields: obj };
  });
}

function del(tableId: string, recordId: string): boolean {
  const r = runLark(['base', '+record-delete', '--base-token', BASE_TOKEN, '--table-id', tableId, '--record-id', recordId, '--yes', '--format', 'json']);
  return r?.ok === true;
}

async function main() {
  for (const [name, tid] of Object.entries(TABLES)) {
    let ids: string[] = [];
    let skipIds: Set<string> = new Set();

    if (name === 'applications') {
      // 保护演示用申请：带 scoreBreakdown 字段的不删（Frank 28 15:40 反馈保护演示数据）
      const allApps = listAllWithFields(tid);
      ids = allApps.map((a) => a.record_id);
      const protectedApps = allApps.filter((a) =>
        PROTECT_APPLICATION_IF_HAS_FIELDS.some((f) => a.fields[f] != null)
      );
      skipIds = new Set(protectedApps.map((a) => a.record_id));
      console.log(`\n=== ${name} (${tid}) ===`);
      console.log(`  found: ${ids.length} records (${skipIds.size} protected with scoreBreakdown)`);
    } else {
      ids = listAll(tid);
      console.log(`\n=== ${name} (${tid}) ===`);
      console.log(`  found: ${ids.length} records`);
    }

    let ok = 0;
    let skip = 0;
    let fail = 0;
    for (const id of ids) {
      if (skipIds.has(id)) { skip++; continue; }
      if (del(tid, id)) ok++; else fail++;
    }
    console.log(`  deleted: ${ok} ok, ${skip} preserved, ${fail} failed`);
  }
  console.log('\n=== ALL CLEARED (dw_users + dw_stage_tasks + 演示用申请 preserved) ===');
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e);
  process.exit(1);
});
