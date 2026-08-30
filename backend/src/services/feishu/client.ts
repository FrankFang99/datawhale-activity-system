/**
 * 飞书多维表格（Base）客户端
 *
 * v1.9.30 修复 3：改 fetch 直连飞书 OpenAPI，移除 lark-cli 子进程依赖
 *
 * 历史：
 * - v1.9.28 硬编码 lark-cli Windows 路径 → Netlify 502
 * - v1.9.29 改 require.resolve 跨平台
 * - v1.9.30 fix1 改 scripts/run.js 入口（仍依赖 binary spawn）
 * - v1.9.30 fix2（本版）改 fetch + tenant_access_token 缓存，零 subprocess
 *
 * 设计：
 * - 鉴权：tenant_access_token (client_credentials 模式)，in-memory 缓存 2h
 * - API base: https://open.feishu.cn/open-apis
 * - 关键 endpoint:
 *   - list:    GET  /bitable/v1/apps/{baseToken}/tables/{tableId}/records
 *   - get:     GET  /bitable/v1/apps/{baseToken}/tables/{tableId}/records/{recordId}
 *   - create:  POST /bitable/v1/apps/{baseToken}/tables/{tableId}/records
 *   - batch:   POST /bitable/v1/apps/{baseToken}/tables/{tableId}/records/batch_create
 *   - update:  PUT  /bitable/v1/apps/{baseToken}/tables/{tableId}/records/{recordId}
 *   - delete:  DELETE /bitable/v1/apps/{baseToken}/tables/{tableId}/records/{recordId}?ignore_consistency_check=true
 *   - search:  POST /bitable/v1/apps/{baseToken}/tables/{tableId}/records/search
 * - 写权限要求：app 必须在飞书后台被加为 base 协作者（可编辑）。
 *   个人版（Frank 测试用）app 即可，无需企业版 OAuth。
 *
 * CellValue 规约（与原 lark-cli 版一致）：
 * - text: "string"
 * - number: 12.5
 * - select 单选: ["Option Name"]
 * - select 多选: ["A", "B"]
 * - datetime: "2026-08-20" 或 ms timestamp
 * - checkbox: true / false
 * - auto_number / created_at / updated_at / formula: 系统字段，不可写
 */

import { config } from '../../config';

// ===== Tenant Access Token 缓存 =====

interface TokenCache {
  token: string;
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2h（飞书官方 2h TTL）
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 提前 5min 刷新

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

function getAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      'LARK_APP_ID / LARK_APP_SECRET 未设置（dev 看 backend/.env，Netlify 看 Environment variables）'
    );
  }
  return { appId, appSecret };
}

async function fetchTenantAccessToken(): Promise<string> {
  const { appId, appSecret } = getAppCredentials();
  const res = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  if (!res.ok) {
    throw new FeishuApiError(`fetch tenant_access_token HTTP ${res.status}: ${await res.text()}`);
  }
  const json: any = await res.json();
  if (json.code !== 0) {
    throw new FeishuApiError(
      `fetch tenant_access_token failed: code=${json.code} msg=${json.msg}`,
      String(json.code)
    );
  }
  return json.tenant_access_token as string;
}

async function getTenantAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return tokenCache.token;
  }
  const token = await fetchTenantAccessToken();
  tokenCache = {
    token,
    expiresAt: now + TOKEN_TTL_MS,
  };
  return token;
}

// 仅供测试用：重置 token 缓存
export function _resetTokenCacheForTest(): void {
  tokenCache = null;
}

// ===== Trace 日志（dev 模式 debug 用，Netlify 上 silent fail） =====

const TRACE_LOG = 'D:\\Learning\\AI\\Datawhale\\backend\\logs\\feishu.log';
const fsTrace = require('fs');
const pathTrace = require('path');
try { fsTrace.mkdirSync(pathTrace.dirname(TRACE_LOG), { recursive: true }); } catch {}
function traceWrite(label: string, tableId: string, ms: number, extra: string): void {
  const ts = new Date().toISOString();
  try { fsTrace.appendFileSync(TRACE_LOG, `[${ts}] ${label} ${tableId} ${ms}ms ${extra}\n`); } catch {}
}

// ===== 公共类型 =====

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

// ===== 飞书 OpenAPI 统一封装 =====

interface FeishuOpenApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

async function feishuFetch<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: any,
  tableId: string = '?'
): Promise<T> {
  const start = Date.now();
  let token: string;
  try {
    token = await getTenantAccessToken();
  } catch (err: any) {
    const ms = Date.now() - start;
    traceWrite('FAIL-AUTH', tableId, ms, err.message?.slice(0, 100));
    throw err;
  }
  const url = `${FEISHU_API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const ms = Date.now() - start;
  if (!res.ok) {
    const text = await res.text();
    traceWrite('FAIL-HTTP', tableId, ms, `${res.status} ${text.slice(0, 100)}`);
    throw new FeishuApiError(`飞书 API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json: FeishuOpenApiResponse<T> = await res.json();
  if (json.code !== 0) {
    traceWrite('FAIL-CODE', tableId, ms, `${json.code} ${json.msg.slice(0, 80)}`);
    throw new FeishuApiError(
      `飞书 API code=${json.code}: ${json.msg}`,
      String(json.code)
    );
  }
  traceWrite('OK', tableId, ms, `${method} ${path.split('?')[0]}`);
  return json.data;
}

// ===== CellValue 转换 =====

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
  return value;
}

// ===== 飞书 records 响应 → LarkRecord 转换 =====

interface FeishuListResponse {
  items: Array<{ record_id: string; fields: Record<string, any> }>;
  total: number;
  has_more: boolean;
  page_token?: string;
}

function recordsFromFeishuItems(items: FeishuListResponse['items']): LarkRecord[] {
  return items.map((it) => ({ record_id: it.record_id, fields: it.fields ?? {} }));
}

// ===== Records CRUD =====

export async function listRecords(
  tableId: string,
  options: { pageSize?: number } = {}
): Promise<{ items: LarkRecord[]; total: number }> {
  const pageSize = options.pageSize ?? 200;
  // 飞书 list 限制 page_size 1-500（与 lark-cli pageSize 1-200 不同，OpenAPI 允许更大）
  const data = await feishuFetch<FeishuListResponse>(
    'GET',
    `/bitable/v1/apps/${config.feishu.baseToken}/tables/${tableId}/records?page_size=${pageSize}`,
    undefined,
    tableId
  );
  const items = recordsFromFeishuItems(data.items ?? []);
  return { items, total: data.total ?? items.length };
}

export async function getRecord(tableId: string, recordId: string): Promise<LarkRecord> {
  const data = await feishuFetch<{ record: { record_id: string; fields: Record<string, any> } }>(
    'GET',
    `/bitable/v1/apps/${config.feishu.baseToken}/tables/${tableId}/records/${recordId}?with_shared_url=false&automatic_fields=false`,
    undefined,
    tableId
  );
  return { record_id: data.record.record_id, fields: data.record.fields ?? {} };
}

export async function createRecord(tableId: string, fields: Record<string, any>): Promise<string> {
  const normalized: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    normalized[k] = normalizeFieldValue(k, v);
  }
  const data = await feishuFetch<{ record: { record_id: string } }>(
    'POST',
    `/bitable/v1/apps/${config.feishu.baseToken}/tables/${tableId}/records?user_id_type=open_id`,
    { fields: normalized },
    tableId
  );
  if (!data.record?.record_id) {
    throw new FeishuApiError(`createRecord 返回无 record_id: ${JSON.stringify(data)}`);
  }
  return data.record.record_id;
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
    return { fields: n };
  });
  const data = await feishuFetch<{ records: Array<{ record_id: string }> }>(
    'POST',
    `/bitable/v1/apps/${config.feishu.baseToken}/tables/${tableId}/records/batch_create?user_id_type=open_id`,
    { records: normalized },
    tableId
  );
  return { recordIds: (data.records ?? []).map((r) => r.record_id) };
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
  await feishuFetch(
    'PUT',
    `/bitable/v1/apps/${config.feishu.baseToken}/tables/${tableId}/records/${recordId}?user_id_type=open_id`,
    { fields: normalized },
    tableId
  );
}

export async function searchRecords(
  tableId: string,
  fieldName: string,
  value: any
): Promise<LarkRecord[]> {
  // 飞书 OpenAPI search 接口要 operator + value 组合（不支持简单 keyword 匹配）
  // 简化：list + 内存过滤（与原 lark-cli fallback 模式一致）
  // lark-cli 1.0.88 +record-search 索引延迟常返空数组；新方案统一走 list + 内存过滤
  const kw = String(value);
  const { items } = await listRecords(tableId, { pageSize: 500 });
  return items.filter((r) => {
    const v = r.fields[fieldName];
    if (Array.isArray(v)) return v.includes(kw);
    if (v === null || v === undefined) return false;
    return String(v) === kw;
  });
}

/**
 * 删 1 条记录
 * @param tableId 表 ID
 * @param recordId 飞书 record_id（recXXX 格式）
 * @returns boolean 是否成功
 */
export async function deleteRecord(tableId: string, recordId: string): Promise<boolean> {
  try {
    await feishuFetch(
      'DELETE',
      `/bitable/v1/apps/${config.feishu.baseToken}/tables/${tableId}/records/${recordId}?ignore_consistency_check=true`,
      undefined,
      tableId
    );
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
