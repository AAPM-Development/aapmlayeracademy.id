const API_ROOT = '/api';
let csrfToken = null;

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload?.error || {};
    throw new ApiError(error.message || 'Permintaan gagal.', response.status, error.code);
  }

  const data = payload?.data ?? payload;
  if (data?.csrfToken) {
    csrfToken = data.csrfToken;
  }
  return data;
}

const json = (body) => ({ method: 'POST', body: JSON.stringify(body) });

export const nativeApi = {
  auth: {
    async csrf() {
      return request('/auth/csrf');
    },
    async providers() {
      return request('/auth/providers');
    },
    async me() {
      const result = await request('/auth/me');
      return result.user;
    },
    async login(email, password) {
      await this.csrf();
      return request('/auth/login', json({ email, password }));
    },
    async register(data) {
      await this.csrf();
      return request('/auth/register', json(data));
    },
    async logout() {
      return request('/auth/logout', json({}));
    },
    async requestPasswordReset(email) {
      await this.csrf();
      return request('/auth/forgot-password', json({ email }));
    },
    async resetPassword(token, newPassword) {
      await this.csrf();
      return request('/auth/reset-password', json({ token, newPassword }));
    },
  },
  courseModules: {
    list: () => request('/modules'),
  },
  quizQuestions: {
    list: (moduleNumber) => request(`/quiz?moduleNumber=${encodeURIComponent(moduleNumber)}`),
  },
  userProgress: {
    list: () => request('/progress'),
    upsert: (moduleNumber, data) => request('/progress', json({ moduleNumber, ...data })),
  },
  certificates: {
    list: () => request('/certificates'),
    create: (data) => request('/certificates', json(data)),
  },
  farmData: {
    list: () => request('/farm-data'),
    create: (data) => request('/farm-data', json(data)),
    update: (id, data) => request('/farm-data', { ...json({ id, ...data }), method: 'PUT' }),
    delete: (id) => request(`/farm-data?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  ai: {
    assistant: ({ message, farmContext }) => request('/ai-assistant', json({ message, farmContext })),
  },
};

export { ApiError };
