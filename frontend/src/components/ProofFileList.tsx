/**
 * 凭证链接列表（v1.9.15 Frank 28 18:36 抽组件）
 *
 * 原本在 ActivityDetail.tsx L1187-1244 inline 渲染，Frank 反馈运营/志愿者在审核 Modal
 * 里看不到组织者上传的凭证，于是抽成组件复用：
 * - ActivityDetail 子任务卡片（已用）
 * - reviewOpen Modal（志愿者审核）新增
 * - opReviewOpen Modal（运营复核）新增
 *
 * 两种格式：
 * 1) JSON 分类：{ "活动策划书": "url1\nurl2", "海报": "url3" }
 * 2) 多行 URL：每行 1 个 url
 */
import React from 'react';

export interface ProofFileListProps {
  proofFile?: string | null;
  uploadedAt?: number | string | null;
}

export default function ProofFileList({ proofFile, uploadedAt }: ProofFileListProps) {
  if (!proofFile) return null;

  // 尝试解析 JSON 分类格式
  let categorized: Record<string, string> | null = null;
  try {
    const parsed = JSON.parse(proofFile);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      categorized = parsed as Record<string, string>;
    }
  } catch {
    /* 不是 JSON，按行分隔处理 */
  }

  const uploadedAtText = uploadedAt
    ? new Date(uploadedAt).toLocaleString('zh-CN')
    : null;

  if (categorized) {
    return (
      <div style={{ marginBottom: 12, fontSize: 13, background: '#F9FAFB', padding: '10px 12px', borderRadius: 6 }}>
        <div style={{ color: '#374151', fontWeight: 600, marginBottom: 6 }}>📎 组织者上传的凭证：</div>
        {Object.entries(categorized).map(([cat, urls]) => {
          const lines = String(urls).split('\n').map((s) => s.trim()).filter(Boolean);
          if (lines.length === 0) return null;
          return (
            <div key={cat} style={{ marginLeft: 8, marginBottom: 4 }}>
              <div style={{ color: '#6B7280', marginBottom: 2 }}>{cat}（{lines.length} 项）：</div>
              {lines.map((url, i) => (
                <div key={i} style={{ marginLeft: 12, marginBottom: 1 }}>
                  {i + 1}.{' '}
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {url.length > 60 ? url.slice(0, 60) + '...' : url}
                  </a>
                </div>
              ))}
            </div>
          );
        })}
        {uploadedAtText && (
          <div style={{ color: '#999', marginTop: 4, fontSize: 11 }}>上传时间：{uploadedAtText}</div>
        )}
      </div>
    );
  }

  // 普通多行（每行 1 个 URL）
  const lines = proofFile.split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ marginBottom: 12, fontSize: 13, background: '#F9FAFB', padding: '10px 12px', borderRadius: 6 }}>
      <div style={{ color: '#374151', fontWeight: 600, marginBottom: 6 }}>
        📎 组织者上传的凭证（{lines.length} 项）：
      </div>
      {lines.map((url, i) => (
        <div key={i} style={{ marginLeft: 12, marginBottom: 2 }}>
          {i + 1}.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url.length > 60 ? url.slice(0, 60) + '...' : url}
          </a>
        </div>
      ))}
      {uploadedAtText && (
        <div style={{ color: '#999', marginTop: 4, fontSize: 11 }}>上传时间：{uploadedAtText}</div>
      )}
    </div>
  );
}
