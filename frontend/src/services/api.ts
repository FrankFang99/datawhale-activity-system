/**
 * API 客户端（axios）
 * 自动加 Authorization 头 + 错误拦截
 */
import axios, { AxiosError } from 'axios';
import { message } from 'antd';
import { authStore } from '../store/auth';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = authStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ code: number; message: string }>) => {
    const code = err.response?.data?.code;
    const msg = err.response?.data?.message ?? err.message;
    if (err.response?.status === 401 && code === 40101) {
      authStore.getState().clearAuth();
      message.warning('登录已过期，请重新登录');
    } else if (msg) {
      message.error(msg);
    }
    return Promise.reject(err);
  }
);

// ===== Auth =====
export const authApi = {
  register: (data: { email: string; password: string; name: string; role?: 'ORGANIZER' }) =>
    api.post<{ code: 0; data: { userId: string; message: string } }>('/auth/register', data).then((r) => r.data.data),
  login: (data: { email: string; password: string }) =>
    api.post<{ code: 0; data: { token: string; expiresIn: number; user: any } }>('/auth/login', data).then((r) => r.data.data),
  me: () => api.get<{ code: 0; data: { user: any } }>('/auth/me').then((r) => r.data.data),
};

// ===== Activities =====
export interface Activity {
  activityId: string;
  title: string;
  description: string;
  coverImage: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string;
  maxParticipants: number;
  daysToStart?: number | null;
  requirements?: string;
  series?: string;  // v4 修订：所属系列
  // v6：飞书群二维码（v1 是 URL，v2 走飞书上传）
  groupQrCode?: string;
}

export const activityApi = {
  list: (params?: { keyword?: string; status?: string; series?: string; page?: number; pageSize?: number }) =>
    api
      .get<{ code: 0; data: { list: Activity[]; total: number; page: number; pageSize: number } }>('/activities', { params })
      .then((r) => r.data.data),
  get: (id: string) =>
    api.get<{ code: 0; data: Activity }>(`/activities/${id}`).then((r) => r.data.data),
};

// ===== Applications =====
export interface ApplicationInput {
  activityId: string;
  organizerName: string;
  organizerPhone: string;
  organizerEmail: string;
  expectedDate: number;
  location: string;
  motivation: string;
  participantValue: string;
  experience?: string;
  venueStatus: '已确定' | '有潜在' | '暂无';
  recruitChannel: string[];
}

export const applicationApi = {
  submit: (data: ApplicationInput) =>
    api
      .post<{ code: 0; data: { applicationId: string; applicationNo: string; status: string; message: string } }>(
        '/applications/submit',
        data
      )
      .then((r) => r.data.data),
  mine: () =>
    api
      .get<{ code: 0; data: { list: any[]; total: number } }>('/applications/mine')
      .then((r) => r.data.data),
  // v10 找该活动当前 CONFIRMED 申请（让志愿者/运营/助教可拿 applicationId 看 3 步进度）
  byActivity: (activityId: string) =>
    api
      .get<{ code: 0; data: { list: Array<{ applicationId: string; applicationNo: string; organizerName: string; organizerId: string }>; total: number } }>(`/applications/by-activity/${activityId}`)
      .then((r) => r.data.data),
  get: (id: string) =>
    api.get<{ code: 0; data: any }>(`/applications/${id}`).then((r) => r.data.data),
  // v13 Frank 14:12 反馈 Comment 6：组织者完成阶段所有子任务 → 通知志愿者审核
  notifyVolunteerReview: (applicationId: string, stage: string) =>
    api
      .post<{ code: 0; data: any }>(`/applications/${applicationId}/notify-volunteer-review`, { stage })
      .then((r) => r.data.data),
};

// ===== Participants（v4 修订 · 参与者报名）=====
export interface Participant {
  recordId: string;
  participantId: string;
  activityId: string;
  status: 'REGISTERED' | 'UNREGISTERED';
  registeredAt?: number;
  cancelledAt?: number;
  remark?: string;
}

export const participantApi = {
  register: (data: { activityId: string; remark?: string }) =>
    api
      .post<{ code: 0; data: { recordId: string; participantId: string; status: string; message: string } }>(
        '/participants/register',
        data
      )
      .then((r) => r.data.data),
  cancel: (recordId: string) =>
    api.post<{ code: 0; data: any }>(`/participants/${recordId}/cancel`, {}).then((r) => r.data.data),
  // Frank 2026-08-21 #6 升级：活动当天打卡 → 自动升级 user role USER → PARTICIPANT
  checkin: (recordId: string) =>
    api.post<{ code: 0; data: { status: 'CHECKED_IN'; userId: string; checkedInAt: number; message: string } }>(
      `/participants/${recordId}/checkin`, {}
    ).then((r) => r.data.data),
  mine: () =>
    api
      .get<{ code: 0; data: { list: Participant[]; total: number } }>('/participants/mine')
      .then((r) => r.data.data),
  count: (activityId: string) =>
    api
      .get<{ code: 0; data: { activityId: string; count: number } }>(`/participants/activity/${activityId}`)
      .then((r) => r.data.data),
};

// ===== Interests（v4 修订 · 站点兴趣登记）=====
export interface InterestInput {
  schoolName: string;
  userName: string;
  email: string;
  phone?: string;
  remark?: string;
}

export const interestApi = {
  create: (data: InterestInput) =>
    api
      .post<{ code: 0; data: { recordId: string; interestId: string; status: string; message: string } }>(
        '/interests',
        data
      )
      .then((r) => r.data.data),
  mine: () =>
    api
      .get<{ code: 0; data: { list: any[]; total: number } }>('/interests/mine')
      .then((r) => r.data.data),
  all: () =>
    api
      .get<{ code: 0; data: { list: any[]; total: number } }>('/interests/admin/all')
      .then((r) => r.data.data),
};

// ===== AI Assistant（切片 6 · PRD §4.1.10）=====
export interface ChatResponse {
  matched: boolean;
  question?: string;
  answer?: string | null;
  faqId?: string;
  category?: string;
  confidence?: number;
  logId?: string;
  fallback?: string;
  message?: string;
  suggest?: string[];
}

export interface HotFAQ {
  id: string;
  question: string;
  category: string;
}

export const aiApi = {
  chat: (question: string) =>
    api
      .post<{ code: 0; data: ChatResponse }>('/ai/chat', { question })
      .then((r) => r.data.data),
  feedback: (logId: string, action: 'UP' | 'DOWN', comment?: string) =>
    api
      .post<{ code: 0; data: { logId: string; feedback: string; updatedAt: number } }>('/ai/feedback', { logId, action, comment })
      .then((r) => r.data.data),
  hotFaqs: () =>
    api
      .get<{ code: 0; data: { list: HotFAQ[] } }>('/ai/hot-faqs')
      .then((r) => r.data.data),
};
export interface Reimbursement {
  reimbursementId: string;
  recordId: string;
  applicationId: string;
  amount: number;
  description: string;
  receipts: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';
  submittedAt?: number;
  reviewedAt?: number;
  reviewerId?: string;
  reviewRemark?: string;
  paidAt?: number;
  paidBy?: string;
  paymentRef?: string;
  organizerId?: string;
  organizerName?: string;
}

export const reimbursementApi = {
  submit: (data: { applicationId: string; amount: number; description: string; receipts?: string[] }) =>
    api
      .post<{ code: 0; data: { recordId: string; reimbursementId: string; status: string; message: string } }>(
        '/reimbursements/submit',
        data
      )
      .then((r) => r.data.data),
  mine: () =>
    api
      .get<{ code: 0; data: { list: Reimbursement[]; total: number } }>('/reimbursements/mine')
      .then((r) => r.data.data),
  byApplication: (applicationId: string) =>
    api
      .get<{ code: 0; data: { list: Reimbursement[]; total: number } }>(`/reimbursements/application/${applicationId}`)
      .then((r) => r.data.data),
  pending: () =>
    api
      .get<{ code: 0; data: { list: Reimbursement[]; total: number } }>('/reimbursements/pending')
      .then((r) => r.data.data),
  review: (recordId: string, data: { action: 'APPROVE' | 'REJECT'; reviewRemark?: string }) =>
    api
      .post<{ code: 0; data: any }>(`/reimbursements/${recordId}/review`, data)
      .then((r) => r.data.data),
  pay: (recordId: string, paymentRef: string) =>
    api
      .post<{ code: 0; data: any }>(`/reimbursements/${recordId}/pay`, { paymentRef })
      .then((r) => r.data.data),
};
export interface StageTask {
  taskId: string;
  applicationId: string;
  stage: 'INTENT' | 'RECRUIT' | 'PREPARE' | 'EXECUTE' | 'REVIEW';
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  assigneeId?: string;
  dueDate?: number;
  completedAt?: number;
  proofFile?: string;
  remark?: string;
  submittedAt?: number;
  reviewerId?: string;
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNCERTAIN';  // v16.7：UNCERTAIN 表示志愿者拿不准，请求运营介入
  reviewRemark?: string;
  subTaskName?: string;  // v6：子任务名
  order?: number;        // v6：阶段内顺序
  ownerType?: 'ORGANIZER' | 'VOLUNTEER' | 'OPERATOR';  // v6：负责人类型
  // v10 三步进度（2026-08-22 Frank 14:35 反馈：组织者自核 → 志愿者审核 → 运营复核）
  organizerSubmittedAt?: number;                       // 组织者自核时间
  operatorReviewerId?: string;                         // 运营最终复核人 userId
  operatorReviewedAt?: number;                         // 运营最终复核时间
  operatorReviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNCERTAIN';
  operatorReviewRemark?: string;                       // 运营复核意见
}

// ===== User Profile (v7 · PRD §4.1.9 US-O12) =====
export const userApi = {
  me: () => api.get<{ code: 0; data: { user: any } }>('/users/me').then((r) => r.data.data.user),
  updateMe: (data: { name?: string; phone?: string; school?: string; city?: string; province?: string }) =>
    api.put<{ code: 0; data: { user: any; message: string } }>('/users/me', data).then((r) => r.data.data),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post<{ code: 0; data: { message: string } }>('/users/change-password', { oldPassword, newPassword }).then((r) => r.data.data),
};

// ===== In-app Messages (v7 · PRD §4.1.8 US-O11) =====
export const messageApi = {
  mine: () =>
    api.get<{ code: 0; data: { list: any[]; total: number } }>('/messages/mine').then((r) => r.data.data),
  unreadCount: () =>
    api.get<{ code: 0; data: { count: number } }>('/messages/unread/count').then((r) => r.data.data),
  markRead: (id: string) =>
    api.post<{ code: 0; data: { messageId: string; read: boolean; message: string } }>(`/messages/${id}/read`, {}).then((r) => r.data.data),
  markAllRead: () =>
    api.post<{ code: 0; data: { count: number; message: string } }>('/messages/read-all', {}).then((r) => r.data.data),
  // v8 A.6 通知日志（PRD §4.2.6 US-P9）— admin/operator 看
  adminLog: (params: { userId?: string; type?: string; read?: 'true' | 'false' | 'all'; pageSize?: number; page?: number } = {}) =>
    api.get<{ code: 0; data: { list: any[]; total: number; page: number; pageSize: number } }>('/messages/admin/log', { params }).then((r) => r.data.data),
  adminResend: (id: string) =>
    api.post<{ code: 0; data: { originalMessageId: string; newMessageId: string; userId: string; message: string } }>(`/messages/admin/${id}/resend`, {}).then((r) => r.data.data),
  adminStats: () =>
    api.get<{ code: 0; data: { total: number; unread: number; byType: Record<string, number>; byUser: Record<string, number> } }>('/messages/admin/stats').then((r) => r.data.data),
};

export const stageApi = {
  list: (applicationId: string) =>
    api
      .get<{ code: 0; data: { list: StageTask[]; total: number } }>(`/applications/${applicationId}/tasks`)
      .then((r) => r.data.data),
  initialize: (applicationId: string) =>
    api
      .post<{ code: 0; data: { applicationId: string; taskIds: string[]; message: string } }>(
        `/applications/${applicationId}/tasks/initialize`,
        {}
      )
      .then((r) => r.data.data),
  submit: (taskId: string, data: { proofFile?: string; remark?: string }) =>
    api
      .post<{ code: 0; data: any }>(`/stages/${taskId}/submit`, data)
      .then((r) => r.data.data),
  // Frank 2026-08-23 09:17 反馈：加 UNCERTAIN（无法判断）action
  review: (taskId: string, data: { action: 'APPROVE' | 'REJECT' | 'UNCERTAIN'; reviewRemark?: string; excellentOrganizer?: 'Y' | 'N' }) =>
    api
      .post<{ code: 0; data: any }>(`/stages/${taskId}/review`, data)
      .then((r) => r.data.data),
  // v10 运营复核（Frank 14:35 反馈：运营可以自己审核）
  operatorReview: (taskId: string, data: { action: 'APPROVE' | 'REJECT'; operatorReviewRemark?: string }) =>
    api
      .post<{ code: 0; data: any }>(`/stages/${taskId}/operator-review`, data)
      .then((r) => r.data.data),
  // v16.7 Frank 16:44 反馈：组织者确认结果（志愿者先完成 + 组织者 confirm）
  // 适用子任务：INT-1 互加好友 / INT-4 飞书日历 / REVIEW 志愿者审核
  organizerConfirm: (taskId: string, data: { action?: 'APPROVE' | 'REJECT'; organizerReviewRemark?: string }) =>
    api
      .post<{ code: 0; data: any }>(`/stages/${taskId}/organizer-confirm`, data)
      .then((r) => r.data.data),
};

// ===== Admin Dashboard（v5 · ADMIN 默认工作台）=====
export interface DashboardKPI {
  applications: {
    total: number;
    byStatus: Record<string, number>;
    pending: number;
    reviewing: number;
    thisMonth: number;
  };
  activities: {
    total: number;
    byStatus: Record<string, number>;
  };
  users: {
    total: number;
    byRole: Record<string, number>;
  };
}

export const adminApi = {
  kpi: () => api.get<{ code: 0; data: DashboardKPI }>('/admin/dashboard/kpi').then((r) => r.data.data),
  grade: () => api.get<{ code: 0; data: { byGrade: Record<string, number> } }>('/admin/dashboard/grade').then((r) => r.data.data),
  pendingApps: () =>
    api.get<{ code: 0; data: { list: any[]; total: number } }>('/admin/applications/pending').then((r) => r.data.data),
  reviewPending: () =>
    api.get<{ code: 0; data: { list: any[]; total: number } }>('/admin/applications/review-pending').then((r) => r.data.data),
  getApp: (id: string) => api.get<{ code: 0; data: any }>(`/admin/applications/${id}`).then((r) => r.data.data),
  auditLog: (id: string) => api.get<{ code: 0; data: { auditLog: any[] } }>(`/admin/applications/${id}/audit-log`).then((r) => r.data.data),
  draftReview: (id: string) =>
    api.post<{ code: 0; data: { applicationId: string; grade: string; score: number; draft: string; basis: string; editable: boolean } }>(`/admin/applications/${id}/draft-review`, {}).then((r) => r.data.data),
  assignVolunteer: (id: string, data: { volunteerId: string; remark?: string }) =>
    api.post<{ code: 0; data: any }>(`/admin/applications/${id}/assign`, data).then((r) => r.data.data),
  listVolunteers: () =>
    api.get<{ code: 0; data: { list: Array<{ userId: string; email: string; name: string; province?: string }>; total: number } }>('/admin/applications/volunteers').then((r) => r.data.data),
  // 活动管理
  listActivities: () => api.get<{ code: 0; data: { list: any[]; total: number } }>('/admin/activities').then((r) => r.data.data),
  createActivity: (data: any) => api.post<{ code: 0; data: any }>('/admin/activities', data).then((r) => r.data.data),
  updateActivity: (id: string, data: any) => api.put<{ code: 0; data: any }>(`/admin/activities/${id}`, data).then((r) => r.data.data),
  publishActivity: (id: string) => api.post<{ code: 0; data: any }>(`/admin/activities/${id}/publish`, {}).then((r) => r.data.data),
  unpublishActivity: (id: string) => api.post<{ code: 0; data: any }>(`/admin/activities/${id}/unpublish`, {}).then((r) => r.data.data),
  archiveActivity: (id: string) => api.post<{ code: 0; data: any }>(`/admin/activities/${id}/archive`, {}).then((r) => r.data.data),
};

// ===== Volunteer Workbench（v5 · VOLUNTEER 默认工作台）=====
export interface WorkbenchItem {
  applicationId: string;
  applicationNo: string;
  activityId: string;
  organizerName: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  score?: number;
  grade?: string;
  submittedAt?: number;
  volunteerId?: string;
}

export const volunteerApi = {
  workbench: () =>
    api.get<{ code: 0; data: { list: WorkbenchItem[]; total: number } }>('/volunteer/workbench').then((r) => r.data.data),
  summary: () =>
    api
      .get<{
        code: 0;
        data: { total: number; byStatus: Record<string, number>; pending: number; reviewing: number; completed: number };
      }>('/volunteer/workbench/summary')
      .then((r) => r.data.data),
};

// ===== Upload（v16.8 Frank 9:04 反馈：图片上传）=====
export const uploadApi = {
  image: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    // 不走 axios 默认 JSON 解析 → 走 multipart/form-data
    return api
      .post<{ code: 0; data: { url: string; filename: string; size: number; mimetype: string } }>('/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      .then((r) => r.data.data);
  },
};

export default api;


// ===== Materials (v9 · PRD §4.1.6 US-V5) =====
export interface Material {
  recordId: string;
  materialId: string;
  name: string;
  category: 'POSTER' | 'GUIDE' | 'TEMPLATE' | 'SLIDES' | 'VIDEO' | 'OTHER';
  scope: 'GLOBAL' | 'ACTIVITY';
  activityId: string;
  fileUrl: string;
  fileSize: number;
  description: string;
  uploadedBy: string;
  uploadedAt: number;
}

export const materialApi = {
  list: (params: { scope?: 'GLOBAL' | 'ACTIVITY'; activityId?: string; category?: string } = {}) =>
    api.get<{ code: 0; data: { list: Material[]; total: number } }>('/materials', { params }).then((r) => r.data.data),
  byActivity: (activityId: string) =>
    api.get<{ code: 0; data: { list: Material[]; total: number } }>(`/materials/activities/${activityId}/materials`).then((r) => r.data.data),
  get: (id: string) =>
    api.get<{ code: 0; data: { material: Material } }>(`/materials/${id}`).then((r) => r.data.data),
  create: (data: { name: string; category: Material['category']; scope?: 'GLOBAL' | 'ACTIVITY'; activityId?: string; fileUrl: string; fileSize?: number; description?: string }) =>
    api.post<{ code: 0; data: { materialId: string; message: string } }>('/materials', data).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete<{ code: 0; data: { materialId: string; message: string } }>(`/materials/${id}`).then((r) => r.data.data),
};
