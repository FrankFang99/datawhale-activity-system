import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import 'antd/dist/reset.css';
import './styles.css';

// Datawhale 品牌主题（对齐 design.md §10）
const theme = {
  token: {
    colorPrimary: '#3370FF',
    colorInfo: '#3370FF',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    borderRadius: 10,
    fontFamily:
      '"PingFang SC","Microsoft YaHei","Helvetica Neue",Helvetica,Arial,sans-serif',
    colorBgLayout: '#F5F8FF',
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  </React.StrictMode>
);
