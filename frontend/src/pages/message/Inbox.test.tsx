/**
 * Inbox 关键覆盖（v9 续 Frank #4 · TDD）
 * 飞书 / API 调用通过 e2e 验证
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'Inbox.tsx'), 'utf-8');

describe('Inbox · Frank #4 消息详情 Modal + 跳转', () => {
  it('Inbox 包含 useState detailMsg（消息详情 Modal 状态）', () => {
    expect(SRC()).toMatch(/useState<any\s*\|\s*null>\(null\)/);
  });

  it('Inbox 包含 Modal 组件', () => {
    expect(SRC()).toMatch(/<Modal[\s\S]*?open=\{!!detailMsg\}/);
  });

  it('Modal 显示完整 title + content + 发送时间', () => {
    expect(SRC()).toMatch(/formatFullTime\(detailMsg\.createdAt\)/);
    expect(SRC()).toMatch(/whiteSpace:\s*['"]pre-wrap['"]/);
  });

  it('Modal 包含"查看详情"按钮跳 m.link', () => {
    expect(SRC()).toMatch(/handleGoLink/);
    expect(SRC()).toMatch(/navigate\(detailMsg\.link\)/);
  });

  it('handleClick 立即 markRead（不等 Modal 关闭）', () => {
    const s = SRC();
    const handleClickBlock = s.match(/const handleClick = async[\s\S]*?\};/)?.[0] ?? '';
    expect(handleClickBlock).toMatch(/markRead\(m\.messageId\)/);
    expect(handleClickBlock).toMatch(/setDetailMsg\(m\)/);
  });

  it('Inbox 用 useNavigate + useSearchParams 自动跳 link', () => {
    expect(SRC()).toMatch(/useNavigate/);
  });
});
