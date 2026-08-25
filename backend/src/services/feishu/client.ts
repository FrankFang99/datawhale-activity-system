/**
 * 飞书多维表格（Base）客户端
 *
 * 切片 1 策略：通过 lark-cli 子进程调个人版飞书 API。
 * lark-cli 1.0.88 命令约定：
 * - 写：`+record-upsert`（无 --record-id 即 create），参数 `--json {"field": value}` 直接是字段 map
 * - 批量写：`+record-batch-create`，参数 `--json {"create_records":[...]}` 数组
 * - 读：`+record-list`（返回 data.data 2D 数组 + fields[] + record_id_list[]）+ `--format json`
 * - 搜索：`+record-search --keyword <kw> --search-field <fieldName> --format json`
 *
 * 关键 CellValue 规约：
 * - text: "string"
 * - number: 12.5
 * - select 单选: ["Option Name"]
 * - select 多选: ["A", "B"]
 * - datetime: "2026-08-20" 或 ms timestamp?
 * - checkbox: true / false
 * - auto_number / created_at / updated_at / formula: 系统字段，不可写
 *
 * 注意：v1 数据量小 OK；v2 优化可改直连 HTTP。
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../../config';

const execFileAsync = promisify(execFile);

const LARK_NODE = process.env.LARK_NODE_PATH || 'C:\\Users\\15088\\.trae-cn\\binaries\\node\\versions\\24.13.0\\node.exe';
const LARK_RUN_JS = process.env.LARK_RUN_JS_PATH || 'C:\\Users\\15088\\.trae-cn\\binaries\\node\\versions\\24.13.0\\node_modules\\@larksuite\\cli\\scripts\\run.js';

export interface LarkResult<T = any> {
  ok: boolean;
  identity?: string;
  data?: T;
  error?: { code?: string; message: string };
}

export interface LarkRecord {
  record_id: string;
  fields: Record<string, any>;
}

export class FeishuApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function runLark<T = any>(args: string[]): Promise<T> {
  try {
    const { stdout } = await execFileAsync(LARK_NODE, [LARK_RUN_JS, ...args], {
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      timeout: 60000,  // lark-cli 1.0.88 偶尔 hang，60s 兜底
      env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
    });
    let result: LarkResult<T>;
    try {
      result = JSON.parse(stdout);
    } catch {
      throw new FeishuApiError(`lark-cli 返回非 JSON：${stdout.slice(0, 200)}`);
    }
    if (!result.ok) {
      throw new FeishuApiError(
        result.error?.message ?? 'unknown lark-cli error',
        result.error?.code
      );
    }
    return result.data as T;
  } catch (err: any) {
    if (err instanceof FeishuApiError) throw err;
    throw new FeishuApiError(`lark-cli call failed: ${err.message ?? err}`);
  }
}

// ===== CellValue 转换 =====
// 飞书 select 字段必须是数组 ["Option"] 形式；text 是字符串；datetime 需要 RFC3339 字符串
const SELECT_FIELDS = [
  'status', 'role', 'venueStatus', 'grade', 'stage', 'reviewStatus',
];
const MULTI_SELECT_FIELDS = [
  'recruitChannel',
];
const DATETIME_FIELDS = [
  'expectedDate', 'submittedAt', 'assignedAt', 'lastLoginAt',
  'dueDate', 'completedAt',
];

export function normalizeFieldValue(fieldName: string, value: any): any {
  if (value === null || value === undefined) return value;
  // datetime 字段：number (ms) → RFC3339 string
  if (DATETIME_FIELDS.includes(fieldName)) {
    let d: Date | null = null;
    if (typeof value === 'number' && value > 0) {
      d = new Date(value);
    } else if (typeof value === 'string' && value.length > 0) {
      // 飞书 datetime 返回 ISO 字符串或数字字符串
      // 防止"字符串 + 数字"被 JS 拼接成怪物
      const asNum = Number(value);
      d = !isNaN(asNum) && asNum > 0 ? new Date(asNum) : new Date(value);
      if (isNaN(d.getTime())) d = null;
    }
    if (d) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      const ms = String(d.getMilliseconds()).padStart(3, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}+08:00`;
    }
  }
  // select 单选字段：string → 数组
  if (SELECT_FIELDS.includes(fieldName) && typeof value === 'string') {
    return [value];
  }
  if (SELECT_FIELDS.includes(fieldName) && Array.isArray(value)) {
    return value;
  }
  // multi-select：保证是数组
  if (MULTI_SELECT_FIELDS.includes(fieldName)) {
    return Array.isArray(value) ? value : [value];
  }
  // text/email/phone: 字符串 OK
  // number: 数字 OK
  // checkbox: 布尔 OK
  return value;
}

// ===== Records =====

export async function listRecords(
  tableId: string,
  options: { pageSize?: number } = {}
): Promise<{ items: LarkRecord[]; total: number }> {
  const args = [
    'base', '+record-list',
    '--base-token', config.feishu.baseToken,
    '--table-id', tableId,
    '--as', 'user',
    '--format', 'json',
  ];
  if (options.pageSize) args.push('--limit', String(options.pageSize));
  const data = await runLark<{
    data?: any[][];
    fields?: string[];
    record_id_list?: string[];
  }>(args);

  // lark-cli 1.0.88 +format json 返回：
  // data.data: 2D 数组 [[val1, val2, ...], ...]
  // data.fields: ["activityId", "coverImage", ...]
  // data.record_id_list: ["rec_xxx", ...]
  if (data.data && Array.isArray(data.data) && data.fields && data.record_id_list) {
    const records: LarkRecord[] = data.data.map((row, i) => {
      const fields: Record<string, any> = {};
      data.fields!.forEach((fname, j) => {
        fields[fname] = row[j];
      });
      return { record_id: data.record_id_list![i] ?? `rec_${i}`, fields };
    });
    return { items: records, total: records.length };
  }
  return { items: [], total: 0 };
}

export async function getRecord(tableId: string, recordId: string): Promise<LarkRecord> {
  const data = await runLark<{ record: LarkRecord }>([
    'base', '+record-get',
    '--base-token', config.feishu.baseToken,
    '--table-id', tableId,
    '--record-id', recordId,
    '--as', 'user',
    '--format', 'json',
  ]);
  return data.record;
}

export async function createRecord(tableId: string, fields: Record<string, any>): Promise<string> {
  // 用 +record-upsert（无 --record-id 即 create）
  // 字段值归一化
  const normalized: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    normalized[k] = normalizeFieldValue(k, v);
  }
  const data = await runLark<{
    created?: boolean;
    record?: { record_id_list?: string[]; record_id?: string };
    record_id_list?: string[];
  }>([
    'base', '+record-upsert',
    '--base-token', config.feishu.baseToken,
    '--table-id', tableId,
    '--json', JSON.stringify(normalized),
    '--as', 'user',
    '--format', 'json',
  ]);
  // 1.0.88 返回：data.record.record_id_list[0] 或 data.record_id_list[0]
  const id =
    data.record?.record_id_list?.[0] ??
    data.record?.record_id ??
    data.record_id_list?.[0] ??
    (data as any).record_id;
  if (!id) {
    throw new FeishuApiError(`createRecord 返回无 record_id: ${JSON.stringify(data)}`);
  }
  return id;
}

export async function batchCreateRecords(
  tableId: string,
  records: Array<Record<string, any>>
): Promise<{ recordIds: string[] }> {
  const normalized = records.map((fields) => {
    const n: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      n[k] = normalizeFieldValue(k, v);
    }
    return n;
  });
  const data = await runLark<{ record_id_list: string[] }>([
    'base', '+record-batch-create',
    '--base-token', config.feishu.baseToken,
    '--table-id', tableId,
    '--json', JSON.stringify({ create_records: normalized }),
    '--as', 'user',
    '--format', 'json',
  ]);
  return { recordIds: data.record_id_list ?? [] };
}

export async function updateRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, any>
): Promise<void> {
  const normalized: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    normalized[k] = normalizeFieldValue(k, v);
  }
  await runLark([
    'base', '+record-upsert',
    '--base-token', config.feishu.baseToken,
    '--table-id', tableId,
    '--record-id', recordId,
    '--json', JSON.stringify(normalized),
    '--as', 'user',
    '--format', 'json',
  ]);
}

export async function searchRecords(
  tableId: string,
  fieldName: string,
  value: any
): Promise<LarkRecord[]> {
  // 用 +record-search：keyword + search-field
  // 飞书 keyword 是字符串，所以 value 必须是 string
  const kw = String(value);
  try {
    const data = await runLark<{
      data?: any[][];
      fields?: string[];
      record_id_list?: string[];
    }>([
      'base', '+record-search',
      '--base-token', config.feishu.baseToken,
      '--table-id', tableId,
      '--keyword', kw,
      '--search-field', fieldName,
      '--format', 'json',
    ]);
    if (data.data && data.fields && data.record_id_list) {
      return data.data.map((row, i) => {
        const fields: Record<string, any> = {};
        data.fields!.forEach((fname, j) => {
          fields[fname] = row[j];
        });
        return { record_id: data.record_id_list![i] ?? `rec_${i}`, fields };
      });
    }
    return [];
  } catch {
    // search 失败时 fallback list + 内存过滤
    const { items } = await listRecords(tableId, { pageSize: 200 });
    return items.filter((r) => {
      const v = r.fields[fieldName];
      if (Array.isArray(v)) return v.includes(kw);
      return String(v) === kw;
    });
  }
}

/**
 * 删 1 条记录（v12 数据迁移用）
 * @param tableId 表 ID
 * @param recordId 飞书 record_id（recvsXXX）
 * @returns boolean 是否成功
 */
export async function deleteRecord(tableId: string, recordId: string): Promise<boolean> {
  try {
    await runLark<any>([
      'base', '+record-delete',
      '--base-token', config.feishu.baseToken,
      '--table-id', tableId,
      '--record-id', recordId,
      '--yes',  // 跳过确认
      '--as', 'user',
    ]);
    return true;
  } catch (e) {
    console.error('[deleteRecord] failed', { tableId, recordId, e });
    return false;
  }
}

export const feishuClient = {
  listRecords,
  getRecord,
  createRecord,
  batchCreateRecords,
  updateRecord,
  searchRecords,
  deleteRecord,
};
