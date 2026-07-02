import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getRepos = () => api.get('/repos').then((r) => r.data);

export const getRepoPRs = (repoId, params = {}) =>
  api.get(`/repos/${repoId}/prs`, { params }).then((r) => r.data);

export const getPRDetail = (prId) => api.get(`/prs/${prId}`).then((r) => r.data);

export const getRepoAnalytics = (repoId) =>
  api.get(`/repos/${repoId}/analytics`).then((r) => r.data);

export default api;
