import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: { email: string; password: string; name: string }) => api.post('/auth/register', data),
};

export const leadsAPI = {
  getAll: () => api.get('/leads'),
  getById: (id: string) => api.get(`/leads/${id}`),
  create: (data: Partial<import('../store/slices/leadsSlice').Lead>) => api.post('/leads', data),
  update: (id: string, data: Partial<import('../store/slices/leadsSlice').Lead>) => api.put(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
};

export const adminAPI = {
  getUsers: () => api.get('/admin/users'),
};

export const tasksAPI = {
  getAll: (params?: { completed?: boolean }) =>
    api.get('/tasks', { params: params !== undefined ? { completed: params.completed } : undefined }),
  create: (data: { title: string; scheduledAt: string; notes?: string; assignedTo?: string; leadId?: string }) =>
    api.post('/tasks', data),
  complete: (id: string) => api.put(`/tasks/${id}/complete`, {}),
};

export const pushAPI = {
  getVapidPublicKey: () => api.get<{ publicKey: string | null }>('/push/vapid-public-key'),
  subscribe: (subscription: PushSubscriptionJSON) => api.post('/push/subscribe', { subscription }),
  unsubscribe: (endpoint: string) => api.delete('/push/unsubscribe', { data: { endpoint } }),
};

export const usersAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: { phoneNumber?: string; smsOptIn?: boolean; name?: string }) =>
    api.put('/users/me', data),
  getAll: () => api.get('/admin/users'),
};

export default api;
