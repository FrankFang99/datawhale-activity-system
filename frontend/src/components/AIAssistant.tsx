/**
 * AI 智能助手浮窗（切片 6 · PRD §4.1.10）
 *
 * 行为：
 * - 右下角悬浮按钮，点击展开对话窗口
 * - 用户提问 → 后端匹配 FAQ → 返回答案
 * - 答案支持 👍/👎 反馈
 * - 未匹配时显示"试试这些问题"快捷入口（Top 5 FAQ）
 * - 关闭后下次自动恢复（localStorage 存对话历史）
 */
import { useEffect, useState, useRef } from 'react';
import {
  FloatButton, Card, Input, Button, Space, Tag, Spin, Empty, Typography, Divider, message,
} from 'antd';
import {
  RobotOutlined, CloseOutlined, SendOutlined, LikeOutlined, DislikeOutlined,
  BulbOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { aiApi, ChatResponse, HotFAQ } from '../services/api';

const { Text, Paragraph } = Typography;

interface Message {
  role: 'user' | 'ai';
  content: string;
  data?: ChatResponse;
  feedbackGiven?: 'UP' | 'DOWN';
}

const STORAGE_KEY = 'datawhale-ai-history';

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hotFaqs, setHotFaqs] = useState<HotFAQ[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (open && hotFaqs.length === 0) {
      aiApi.hotFaqs().then((d) => setHotFaqs(d.list)).catch(() => {});
    }
  }, [open, hotFaqs.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const persist = (m: Message[]) => {
    setMessages(m);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m.slice(-20)));  // 只存最近 20 条
  };

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setInput('');
    persist([...messages, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const d = await aiApi.chat(question);
      persist([...messages, { role: 'user', content: question }, { role: 'ai', content: d.answer || d.message || '未匹配', data: d }]);
    } catch (e: any) {
      persist([...messages, { role: 'user', content: question }, { role: 'ai', content: '抱歉，出错了：' + (e?.message || '网络错误') }]);
    } finally {
      setLoading(false);
    }
  };

  const onFeedback = async (idx: number, action: 'UP' | 'DOWN') => {
    const m = messages[idx];
    if (!m?.data?.logId || m.feedbackGiven) return;
    try {
      await aiApi.feedback(m.data.logId, action);
      const updated = [...messages];
      updated[idx] = { ...updated[idx], feedbackGiven: action };
      persist(updated);
      message.success(action === 'UP' ? '感谢您的反馈！' : '已记录，会持续优化 FAQ');
    } catch {
      message.error('反馈提交失败');
    }
  };

  const clearHistory = () => {
    persist([]);
    message.success('对话已清空');
  };

  return (
    <>
      <FloatButton
        icon={open ? <CloseOutlined /> : <RobotOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24, width: 56, height: 56 }}
        onClick={() => setOpen((v) => !v)}
        tooltip={open ? '关闭助手' : 'AI 助手'}
      />

      {open && (
        <Card
          style={{
            position: 'fixed',
            right: 24,
            bottom: 96,
            width: 400,
            height: 600,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            borderRadius: 16,
            overflow: 'hidden',
          }}
          bodyStyle={{ display: 'flex', flexDirection: 'column', padding: 0, height: '100%' }}
        >
          {/* 头部 */}
          <div style={{
            background: 'linear-gradient(135deg, #3370FF 0%, #62D4C8 100%)',
            color: '#fff',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Space>
              <RobotOutlined style={{ fontSize: 20 }} />
              <strong>Datawhale AI 助手</strong>
            </Space>
            <Space>
              <Button type="text" size="small" style={{ color: '#fff' }} onClick={clearHistory}>
                清空
              </Button>
              <Button type="text" size="small" icon={<CloseOutlined />} style={{ color: '#fff' }} onClick={() => setOpen(false)} />
            </Space>
          </div>

          {/* 消息列表 */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#F5F8FF' }}>
            {messages.length === 0 ? (
              <div style={{ padding: 8 }}>
                <Paragraph type="secondary" style={{ fontSize: 13 }}>
                  👋 你好！我是 Datawhale 高校活动智能助手。<br />
                  我能帮你解答：经费报销 / 物料海报 / 嘉宾申请 / 权限开通 / 5 阶段任务 等问题。
                </Paragraph>
                <Divider style={{ margin: '12px 0' }}><Text type="secondary" style={{ fontSize: 12 }}>试试这些问题</Text></Divider>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {hotFaqs.map((f) => (
                    <Button
                      key={f.id}
                      size="small"
                      block
                      style={{ textAlign: 'left', height: 'auto', whiteSpace: 'normal' }}
                      onClick={() => ask(f.question)}
                    >
                      <BulbOutlined style={{ color: '#3370FF', marginRight: 4 }} />
                      {f.question}
                    </Button>
                  ))}
                </Space>
              </div>
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%',
                      background: m.role === 'user' ? '#3370FF' : '#fff',
                      color: m.role === 'user' ? '#fff' : '#1A1A2E',
                      padding: '8px 12px',
                      borderRadius: 12,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}>
                      {m.role === 'user' ? (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                      ) : (
                        <div>
                          {m.data?.matched ? (
                            <div>
                              {m.data.faqId && m.data.faqId !== 'GREETING' && (
                                <Tag color="blue" style={{ marginBottom: 6 }}>{m.data.category}</Tag>
                              )}
                              {m.data.faqId === 'GREETING' && (
                                <Tag color="purple" style={{ marginBottom: 6 }}>问候</Tag>
                              )}
                              {m.data.confidence !== undefined && m.data.faqId !== 'GREETING' && (
                                <Tag color="default" style={{ marginBottom: 6, fontSize: 11 }}>
                                  置信度 {(m.data.confidence * 100).toFixed(0)}%
                                </Tag>
                              )}
                              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
                                {m.data.answer}
                              </div>
                              {m.data.faqId && m.data.faqId !== 'GREETING' && !m.feedbackGiven && m.data.logId && (
                                <div style={{ marginTop: 8, borderTop: '1px solid #E5E7EB', paddingTop: 6 }}>
                                  <Text type="secondary" style={{ fontSize: 11, marginRight: 8 }}>这个回答有用吗？</Text>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<LikeOutlined />}
                                    onClick={() => onFeedback(i, 'UP')}
                                    style={{ color: '#10B981' }}
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<DislikeOutlined />}
                                    onClick={() => onFeedback(i, 'DOWN')}
                                    style={{ color: '#EF4444' }}
                                  />
                                </div>
                              )}
                              {m.feedbackGiven && (
                                <div style={{ marginTop: 6 }}>
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {m.feedbackGiven === 'UP' ? '👍 已点赞' : '👎 已记录'}
                                  </Text>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <Text type="secondary">😅 {m.data?.message || '未匹配'}</Text>
                              {m.data?.suggest && (
                                <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 13 }}>
                                  {m.data.suggest.map((s, k) => (
                                    <li key={k} style={{ color: '#6B7280' }}>{s}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          {!m.data && <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 12 }}>
                      <Spin size="small" /> <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>思考中...</Text>
                    </div>
                  </div>
                )}
              </Space>
            )}
          </div>

          {/* 输入区 */}
          <div style={{ borderTop: '1px solid #E5E7EB', padding: 8, background: '#fff' }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={() => ask(input)}
                placeholder="问点什么吧... (Enter 发送)"
                disabled={loading}
                size="large"
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => ask(input)}
                disabled={loading || !input.trim()}
                size="large"
                className="dw-gradient-btn"
              >
                发送
              </Button>
            </Space.Compact>
          </div>
        </Card>
      )}
    </>
  );
}
