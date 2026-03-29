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
  create: (data: Partial<import('../store/slices/leadsSlice').Lead>) => api.post('/leads', data),
  update: (id: string, data: Partial<import('../store/slices/leadsSlice').Lead>) => api.put(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

export default api;
