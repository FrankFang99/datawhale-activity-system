/**
 * universities module 单元测试（v1.2 Frank 17:37 加 dw_universities 表）
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock 飞书 client 让 controller 不打真飞书
vi.mock('../../services/feishu/client', () => ({
  feishuClient: {
    listRecords: vi.fn(async () => ({
      items: [
        { record_id: 'r1', fields: { univId: 1, name: '清华', shortName: 'TH', tier: ['985'], city: '北京', province: '北京', district: '海淀区', address: 'a' } },
        { record_id: 'r2', fields: { univId: 2, name: '北大', shortName: 'PKU', tier: ['985'], city: '北京', province: '北京', district: '海淀区', address: 'b' } },
      ],
      total: 2,
    })),
    createRecord: vi.fn(async () => 'r_new'),
  },
  LarkRecord: class {},
}));

// 还要 mock config（因为 controller import config）
vi.mock('../../config', () => ({
  config: {
    feishu: { tables: { universities: 'tbl_test' } },
  },
}));

import universitiesRouter from './controller';
import express from 'express';
import request from 'supertest';

const app = express();
app.use(express.json());
app.use('/api/universities', universitiesRouter);
app.use('/api/admin/universities', universitiesRouter);

describe('universities controller', () => {
  it('GET / - 公开列表', async () => {
    const res = await request(app).get('/api/universities');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.list[0].name).toBe('北大');  // 拼音 b < t
  });

  it('GET /count - KPI 用', async () => {
    const res = await request(app).get('/api/universities/count');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
  });

  it('GET /api/universities - 按省份排序', async () => {
    const res = await request(app).get('/api/universities');
    // 两所都是北京，按名字拼音排序：b(北大) < t(清华)
    expect(res.body.data.list[0].name).toBe('北大');
    expect(res.body.data.list[1].name).toBe('清华');
  });
});
