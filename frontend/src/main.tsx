import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { themeStore, antdThemeFor } from './store/theme';
import 'antd/dist/reset.css';
import './styles.css';

function App() {
  // 初始从 localStorage 同步读取（避免 zustand persist hydration race）
  const [mode, setModeState] = useState<'light' | 'dark'>(() => {
    try {
      const raw = localStorage.getItem('datawhale-theme');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.state?.mode ?? 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => themeStore.subscribe((s) => setModeState(s.mode)), []);
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return (
    <ConfigProvider locale={zhCN} theme={antdThemeFor(mode)}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
