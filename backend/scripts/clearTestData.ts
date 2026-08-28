/**
 * 清空 Datawhale 业务数据（保留 dw_users + dw_messages + dw_stage_tasks）
 * Frank 28 08:16 反馈："申请啥的清空，从头测试，今天要交"
 * Frank 28 13:38 反馈："以后重测不要清空 5 阶段表相应设置"
 *   → 保留 dw_stage_tasks（5 阶段 19 个子任务的 status / reviewStatus / operatorReviewStatus 等进度）
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
};

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

function del(tableId: string, recordId: string): boolean {
  const r = runLark(['base', '+record-delete', '--base-token', BASE_TOKEN, '--table-id', tableId, '--record-id', recordId, '--yes', '--format', 'json']);
  return r?.ok === true;
}

async function main() {
  for (const [name, tid] of Object.entries(TABLES)) {
    const ids = listAll(tid);
    console.log(`\n=== ${name} (${tid}) ===`);
    console.log(`  found: ${ids.length} records`);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      if (del(tid, id)) ok++; else fail++;
    }
    console.log(`  deleted: ${ok} ok, ${fail} failed`);
  }
  console.log('\n=== ALL CLEARED (dw_users preserved) ===');
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e);
  process.exit(1);
});
