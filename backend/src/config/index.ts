import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`环境变量 ${key} 缺失，请检查 .env 文件`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwt: {
    secret: required('JWT_SECRET', 'datawhale-dev-secret-change-me'),
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '86400', 10),
  },
  feishu: {
    baseToken: required('FEISHU_BASE_TOKEN'),
    tables: {
      users: required('FEISHU_TABLE_USERS'),
      activities: required('FEISHU_TABLE_ACTIVITIES'),
      applications: required('FEISHU_TABLE_APPLICATIONS'),
      stageTasks: required('FEISHU_TABLE_STAGE_TASKS'),
      reimbursements: required('FEISHU_TABLE_REIMBURSEMENTS'),
      chatLogs: required('FEISHU_TABLE_CHAT_LOGS'),
      participants: required('FEISHU_TABLE_PARTICIPANTS'),
      interests: required('FEISHU_TABLE_INTERESTS'),
      messages: required('FEISHU_TABLE_MESSAGES'),
      materials: required('FEISHU_TABLE_MATERIALS'),
      // v1.2 Frank 17:08 加 dw_universities 表
      universities: required('FEISHU_TABLE_UNIVERSITIES'),
    },
  },
  notify: {
    testMode: process.env.NOTIFY_TEST_MODE === 'true',
    defaultEmail: process.env.NOTIFY_DEFAULT_EMAIL ?? 'frank-fangyz@139.com',
  },
} as const;
