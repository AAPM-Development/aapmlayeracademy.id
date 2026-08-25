const API_ROOT = "/api";
let csrfToken = null;

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const writes = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (!csrfToken && writes && path !== "/auth/csrf") {
    await request("/auth/csrf");
  }

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    credentials: "same-origin",
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
    throw new ApiError(
      error.message || "Permintaan gagal.",
      response.status,
      error.code,
    );
  }

  const data = payload?.data ?? payload;
  if (data?.csrfToken) {
    csrfToken = data.csrfToken;
  }
  return data;
}

async function stream(path, body, onEvent) {
  if (!csrfToken) {
    await request("/auth/csrf");
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const error = payload?.error || {};
    throw new ApiError(
      error.message || "Permintaan streaming gagal.",
      response.status,
      error.code,
    );
  }
  if (!response.body) {
    throw new ApiError(
      "Browser tidak mendukung respons streaming.",
      0,
      "stream_unavailable",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatch = (block) => {
    const lines = block.split("\n");
    const event =
      lines
        .find((line) => line.startsWith("event:"))
        ?.slice(6)
        .trim() || "message";
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) return;
    try {
      onEvent?.({ event, data: JSON.parse(data) });
    } catch {
      /* ignore malformed stream events */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder
      .decode(value || new Uint8Array(), { stream: !done })
      .replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      dispatch(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  if (buffer.trim()) dispatch(buffer);
}

const json = (body) => ({ method: "POST", body: JSON.stringify(body) });

export const nativeApi = {
  auth: {
    async csrf() {
      return request("/auth/csrf");
    },
    async providers() {
      return request("/auth/providers");
    },
    async me() {
      const result = await request("/auth/me");
      return result.user;
    },
    async login(email, password) {
      await this.csrf();
      return request("/auth/login", json({ email, password }));
    },
    async register(data) {
      await this.csrf();
      return request("/auth/register", json(data));
    },
    async logout() {
      return request("/auth/logout", json({}));
    },
    async requestPasswordReset(email) {
      await this.csrf();
      return request("/auth/forgot-password", json({ email }));
    },
    async resetPassword(token, newPassword) {
      await this.csrf();
      return request("/auth/reset-password", json({ token, newPassword }));
    },
  },
  courseModules: {
    list: () => request("/modules"),
  },
  quizQuestions: {
    list: (moduleNumber) =>
      request(`/quiz?moduleNumber=${encodeURIComponent(moduleNumber)}`),
  },
  userProgress: {
    list: () => request("/progress"),
    upsert: (moduleNumber, data) =>
      request("/progress", json({ moduleNumber, ...data })),
  },
  certificates: {
    list: () => request("/certificates"),
    create: (data) => request("/certificates", json(data)),
  },
  profile: {
    get: () => request("/profile"),
    update: (data) =>
      request("/profile", { method: "PUT", body: JSON.stringify(data) }),
    hallOfFame: () => request("/hall-of-fame"),
  },
  aiSettings: {
    get: () => request("/ai-settings"),
    update: (data) =>
      request("/ai-settings", { method: "PUT", body: JSON.stringify(data) }),
  },
  farmData: {
    list: () => request("/farm-data"),
    create: (data) => request("/farm-data", json(data)),
    update: (id, data) =>
      request("/farm-data", { ...json({ id, ...data }), method: "PUT" }),
    delete: (id) =>
      request(`/farm-data?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  ai: {
    assistant: ({ message, farmContext, includeFarmContext = true }) =>
      request("/ai-assistant", json({ message, farmContext, includeFarmContext })),
    stream: ({ message, farmContext, includeFarmContext = true, onEvent }) =>
      stream("/ai-assistant/stream", { message, farmContext, includeFarmContext }, onEvent),
    conversations: {
      list: async ({ cursor = "", limit = 40 } = {}) => {
        const safeLimit = Math.max(10, Math.min(80, Number(limit) || 40));
        const params = new URLSearchParams({
          format: "paged",
          limit: String(safeLimit),
        });
        if (cursor) params.set("cursor", cursor);
        const result = await request(`/ai/conversations?${params.toString()}`);
        // During a rolling cPanel deployment an older API can briefly return
        // the legacy array shape. Normalize it so history remains readable.
        return Array.isArray(result)
          ? { items: result, total: result.length, nextCursor: null }
          : result;
      },
      create: (title = "") => request("/ai/conversations", json({ title })),
      detail: (id) => request(`/ai/conversations/${encodeURIComponent(id)}`),
      update: (id, data) =>
        request(`/ai/conversations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      delete: (id) =>
        request(`/ai/conversations/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
      stream: ({
        id,
        message,
        farmContext,
        allowWebSearch = false,
        imageDataUrl = null,
        pageContext = "",
        includeFarmContext = true,
        onEvent,
      }) =>
        stream(
          `/ai/conversations/${encodeURIComponent(id)}/stream`,
          { message, farmContext, includeFarmContext, allowWebSearch, imageDataUrl, pageContext },
          onEvent,
        ),
    },
    activity: {
      list: () => request("/ai/activity"),
    },
  },
  admin: {
    overview: () => request("/admin/overview"),
    courses: {
      list: () => request("/admin/courses"),
      detail: (courseId) =>
        request(`/admin/courses/${encodeURIComponent(courseId)}`),
    },
    learners: {
      list: (search = "") =>
        request(
          `/admin/learners${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        ),
      detail: (learnerId) =>
        request(`/admin/learners/${encodeURIComponent(learnerId)}`),
    },
    users: {
      list: (search = "") =>
        request(
          `/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        ),
      create: (data) => request("/admin/users", json(data)),
      update: (userId, data) =>
        request(`/admin/users/${encodeURIComponent(userId)}`, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      resetPassword: (userId, password) =>
        request(`/admin/users/${encodeURIComponent(userId)}/password`, {
          method: "PUT",
          body: JSON.stringify({ password }),
        }),
    },
    modules: {
      detail: (moduleId) =>
        request(`/admin/modules/${encodeURIComponent(moduleId)}`),
      create: (data) => request("/admin/modules", json(data)),
      update: (moduleId, data) =>
        request(`/admin/modules/${encodeURIComponent(moduleId)}`, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      delete: (moduleId) =>
        request(`/admin/modules/${encodeURIComponent(moduleId)}`, {
          method: "DELETE",
        }),
      reorder: (items) =>
        request("/admin/modules/reorder", {
          method: "PUT",
          body: JSON.stringify({ items }),
        }),
      questions: (moduleId) =>
        request(`/admin/modules/${encodeURIComponent(moduleId)}/questions`),
      createQuestion: (moduleId, data) =>
        request(`/admin/modules/${encodeURIComponent(moduleId)}/questions`, json(data)),
      updateQuestion: (moduleId, questionId, data) =>
        request(
          `/admin/modules/${encodeURIComponent(moduleId)}/questions/${encodeURIComponent(questionId)}`,
          { method: "PUT", body: JSON.stringify(data) },
        ),
      deleteQuestion: (moduleId, questionId) =>
        request(
          `/admin/modules/${encodeURIComponent(moduleId)}/questions/${encodeURIComponent(questionId)}`,
          { method: "DELETE" },
        ),
    },
    aiSettings: {
      get: () => request("/admin/ai-settings"),
      update: (data) =>
        request("/admin/ai-settings", {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      test: (data = {}) => request("/admin/ai-settings/test", json(data)),
      discoverModels: (data = {}) =>
        request("/admin/ai-settings/models", json(data)),
    },
  },
};

export { ApiError };
