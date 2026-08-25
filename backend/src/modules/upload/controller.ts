/**
 * 图片上传端点（v16.8 Frank 9:04 反馈）
 * - 接收 multipart/form-data 图片
 * - 存到 backend/uploads/{timestamp}-{filename}
 * - express.static('/uploads/') serving
 * - 返回 URL：http://localhost:4000/uploads/{filename}
 *
 * 限制：
 * - 单文件最大 5MB
 * - 仅允许 image/* MIME（jpg/png/gif/webp）
 * - v1 简化：本地文件系统（生产环境应改 OSS）
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authRequired } from '../../middleware/auth';
import { ok, fail, ErrorCode } from '../../utils/response';

const router = Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname) || '.png';
    // 避免中文/特殊字符 → 用 timestamp + 随机
    const safeName = `${ts}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
  const url = `/uploads/${req.file.filename}`;
  return ok(res, {
    url,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

export default router;
