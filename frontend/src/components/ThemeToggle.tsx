/**
 * 主题切换按钮（v1.2 引入）
 *
 * 设计原则：
 * - 不喧宾夺主：圆角胶囊 + 中性灰图标，hover 才显示主色
 * - 跟 design.md §6.1 按钮规范对齐
 */
import { Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { themeStore } from '../store/theme';

export default function ThemeToggle() {
  const mode = themeStore((s) => s.mode);
  const toggle = themeStore((s) => s.toggle);
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? '切换到浅色' : '切换到深色'}>
      <Button
        type="text"
        size="small"
        shape="circle"
        icon={isDark ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggle}
        aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
        className="dw-header__icon"
        style={{
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </Tooltip>
  );
}
