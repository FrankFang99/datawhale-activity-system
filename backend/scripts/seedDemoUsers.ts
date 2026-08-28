/**
 * Seed 7 个 Datawhale 演示账号到 dw_users
 * Frank 28 11:25 反馈：清空业务数据时把 dw_users 也清了（0 records），需要重新 seed 才能登录
 *
 * 用法：cd backend && npx tsx scripts/seedDemoUsers.ts
 */
import { feishuClient } from '../src/services/feishu/client';
import { hashPassword } from '../src/utils/password';
import { config } from '../src/config';

interface DemoUser {
  userId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VOLUNTEER' | 'ORGANIZER' | 'PARTICIPANT' | 'USER';
  city: string;
  school: string;
}

const DEMO_USERS: DemoUser[] = [
  { userId: 'NO.00000022', email: 'frank@datawhale.cn',   name: '方逸之',   role: 'ADMIN',     city: '北京', school: 'Datawhale 总部' },
  { userId: 'NO.00000023', email: 'operator@x.cn',        name: '运营-王芳', role: 'OPERATOR',  city: '北京', school: 'Datawhale 总部' },
  { userId: 'NO.00000024', email: 'volunteer@x.cn',       name: '志愿者-李明', role: 'VOLUNTEER', city: '北京', school: 'Datawhale 总部' },
  { userId: 'NO.00000025', email: 'org-thu@x.cn',         name: '清华站-张涛', role: 'ORGANIZER',  city: '北京', school: '清华大学' },
  { userId: 'NO.00000026', email: 'org-sjtu@x.cn',        name: '上交站-陈静', role: 'ORGANIZER',  city: '上海', school: '上海交通大学' },
  { userId: 'NO.00000027', email: 'org-szu@x.cn',         name: '深大站-林浩', role: 'ORGANIZER',  city: '深圳', school: '深圳大学' },
  { userId: 'NO.00000028', email: 'participant1@x.cn',    name: '参与者-赵琳', role: 'PARTICIPANT', city: '北京', school: '清华大学' },
];

const DEFAULT_PASSWORD = 'datawhale123';

async function main() {
  console.log('=== 重新 seed 7 个演示账号到 dw_users ===\n');
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  console.log(`password "${DEFAULT_PASSWORD}" 哈希生成 OK\n`);

  for (const u of DEMO_USERS) {
    try {
      const id = await feishuClient.createRecord(config.feishu.tables.users, {
        userId: u.userId,
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        province: u.city === '北京' ? '北京市' : (u.city === '上海' ? '上海市' : '广东省'),
        city: u.city,
        school: u.school,
        status: 'ACTIVE',
        creditScore: 100,
        isExternalUser: true,
      });
      console.log(`  ✓ ${u.userId}  ${u.email.padEnd(22)}  ${u.role.padEnd(11)}  record=${id}`);
    } catch (e: any) {
      console.log(`  ✗ ${u.userId}  ${u.email}  FAIL: ${e.message?.slice(0, 100)}`);
    }
  }
  console.log('\n=== seed 完成 ===');
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e);
  process.exit(1);
});
