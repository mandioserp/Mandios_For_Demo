import axios from 'axios';

export const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://api-prod.mandioserp.com/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

let refreshRequest;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const url = config?.url || '';
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh') &&
      !url.includes('/auth/logout')
    ) {
      config._retried = true;
      try {
        if (!refreshRequest) {
          refreshRequest = axios.post(`${apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
            .finally(() => { refreshRequest = null; });
        }
        await refreshRequest;
        return api(config);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

