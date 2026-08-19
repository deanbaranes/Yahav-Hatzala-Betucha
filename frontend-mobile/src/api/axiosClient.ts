import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,   // send HttpOnly cookie on every request
});

// ── Request interceptor: attach access token ───────────────────────────────
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: 401 → try refresh → retry once ───────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, not on the refresh/login endpoint itself
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Queue subsequent 401 requests until refresh is done
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is in the HttpOnly cookie — just call the endpoint
        const { data } = await axiosClient.post<{ access_token: string }>('/auth/refresh');
        const newToken = data.access_token;

        localStorage.setItem('token', newToken);
        axiosClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return axiosClient(originalRequest);
      } catch (refreshError: any) {
        processQueue(refreshError, null);
        // Only force logout if the server explicitly rejected the refresh token (401/403/400).
        // If it's a 5xx error or a Network Error (server sleeping), keep the session and let the user try again.
        const status = refreshError.response?.status;
        if (status === 401 || status === 403 || status === 400) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For 429 (rate limit) show a friendly message
    if (error.response?.status === 429) {
      error.message = 'יותר מדי נסיונות. אנא המתן מספר דקות ונסה שנית.';
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
