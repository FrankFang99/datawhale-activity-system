/**
 * 图片上传端点（v1.9.28 Vercel 部署改造）
 *
 * v16.8 原始版本：
 * - 接收 multipart/form-data 图片
 * - 存到 backend/uploads/{timestamp}-{filename}（multer diskStorage）
 * - express.static('/uploads/') serving
 * - 返回 URL：http://localhost:4000/uploads/{filename}
 *
 * v1.9.28 Vercel 一体化部署改造：
 * - multer 改 memoryStorage（Vercel Serverless 无持久 fs）
 * - **演示版 mock**：不存真实文件，返回 picsum 占位 URL（v2 改飞书 Drive 真上传）
 * - 5 阶段 submit 时 proofFile 存 URL 字符串（max 5000 字符 OK）
 * - 限制：单文件 1MB（避开 Vercel Function body 4.5MB 限制 + base64 33% 膨胀）
 *
 * v2 计划（详见 HANDOFF.md §10.2）：
 * - 改用飞书 Drive OpenAPI 上传 → 拿 file_token → 存 dw_stage_tasks.proofFile
 * - 单文件可达 1GB（飞书 Drive 限制）
 * - 不走 backend proxy（前端直接调飞书 OpenAPI）
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { authRequired } from '../../middleware/auth';
import { ok, fail, ErrorCode } from '../../utils/response';

const router = Router();

// Vercel Serverless 无持久 fs → memoryStorage（buffer 存内存）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB（避开 Vercel 4.5MB body 限制 + 演示用足够）
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只支持图片文件（jpg/png/gif/webp）'));
    }
    cb(null, true);
  },
});

router.post('/image', authRequired, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, '未收到文件');
  }
  // 演示版 mock：用文件 hash 生成稳定的 picsum URL
  // v2 改用飞书 Drive 上传 → 拿真实 file_token
  const hash = crypto.createHash('md5').update(req.file.buffer).digest('hex').slice(0, 8);
  const url = `https://picsum.photos/seed/${hash}/400/300`;
  return ok(res, {
    url,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    // v1.9.28 标记：演示版 mock，v2 改飞书 Drive
    uploadMode: 'mock-v1-demo' as const,
    note: 'Vercel 部署演示版：返回 picsum 占位图，v2 改飞书 Drive 真上传',
  });
});

export default router;
