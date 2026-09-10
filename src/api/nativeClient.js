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

// A 401 from an authenticated endpoint means the browser still has an app
// shell, but the server no longer has a usable session. Broadcast that state
// once at the transport boundary so every surface (including APPI streaming)
// can show the same recovery question instead of leaving a dead screen open.
const sessionExpiryExcludedPaths = new Set([
  "/auth/csrf",
  "/auth/login",
  "/auth/register",
  "/auth/providers",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/logout",
]);

function notifySessionExpired(path, status) {
  if (
    status !== 401 ||
    sessionExpiryExcludedPaths.has(path) ||
    typeof window === "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("aapm:session-expired", { detail: { path } }),
  );
}

async function request(path, options = /** @type {any} */ ({})) {
  const { multipart = false, ...fetchOptions } = options;
  const method = (fetchOptions.method || "GET").toUpperCase();
  const writes = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (!csrfToken && writes && path !== "/auth/csrf") {
    await request("/auth/csrf");
  }

  const headers = {
    Accept: "application/json",
    ...(fetchOptions.body && !multipart
      ? { "Content-Type": "application/json" }
      : {}),
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_ROOT}${path}`, {
    ...fetchOptions,
    ...(method === "GET" ? { cache: "no-store" } : {}),
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
    notifySessionExpired(path, response.status);
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
    notifySessionExpired(path, response.status);
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

function createAbortError() {
  try {
    return new DOMException("Unggahan dibatalkan.", "AbortError");
  } catch {
    const error = new Error("Unggahan dibatalkan.");
    error.name = "AbortError";
    return error;
  }
}

/**
 * Upload a multipart payload while exposing the browser's native progress
 * events. `fetch()` still has no upload-progress API, so media uploads use a
 * small XHR transport; callers keep the same Promise/data contract as
 * `request()` and may pass `{ onProgress, signal }` for visible progress and
 * cancellation.
 */
async function upload(path, formData, options = {}) {
  const { onProgress, signal, headers: extraHeaders = {} } = options || {};
  if (signal?.aborted) throw createAbortError();
  if (!csrfToken) await request("/auth/csrf");
  if (signal?.aborted) throw createAbortError();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener?.("abort", abort);
      xhr.upload?.removeEventListener?.("progress", handleProgress);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const abort = () => {
      xhr.abort();
      finish(reject, createAbortError());
    };
    const handleProgress = (event) => {
      if (settled) return;
      const loaded = Number(event.loaded) || 0;
      const total = event.lengthComputable ? Number(event.total) || 0 : 0;
      const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;
      onProgress?.({ loaded, total, percent });
    };

    xhr.open("POST", `${API_ROOT}${path}`, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    Object.entries(extraHeaders || {}).forEach(([name, value]) => {
      if (value !== undefined && value !== null) xhr.setRequestHeader(name, String(value));
    });
    xhr.upload?.addEventListener?.("progress", handleProgress);
    signal?.addEventListener?.("abort", abort, { once: true });
    onProgress?.({ loaded: 0, total: 0, percent: 0 });

    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.response && typeof xhr.response === "object"
          ? xhr.response
          : JSON.parse(xhr.responseText || "null");
      } catch {
        payload = null;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const error = payload?.error || {};
        notifySessionExpired(path, xhr.status);
        finish(reject, new ApiError(error.message || "Unggahan gagal.", xhr.status, error.code));
        return;
      }

      const data = payload?.data ?? payload;
      if (data?.csrfToken) csrfToken = data.csrfToken;
      onProgress?.({ loaded: Number(xhr.getResponseHeader("Content-Length")) || 0, total: 0, percent: 100 });
      finish(resolve, data);
    };
    xhr.onerror = () => finish(reject, new ApiError("Unggahan gagal karena koneksi.", 0, "network_error"));
    xhr.ontimeout = () => finish(reject, new ApiError("Unggahan terlalu lama dan dihentikan.", 0, "timeout"));
    xhr.onabort = () => finish(reject, createAbortError());

    try {
      xhr.send(formData);
    } catch (error) {
      finish(reject, error);
    }
  });
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
    rewriteEditorial: ({ message }) =>
      request("/admin/ai/rewrite-editorial", json({ message })),
    moduleCompanion: ({ action = "chat", message = "", module = {}, modules = [] } = {}) =>
      request("/admin/ai/module-companion", json({ action, message, module, modules })),
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
      persistAssistant: (id, data) =>
        request(`/ai/conversations/${encodeURIComponent(id)}/messages`, json(data)),
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
      resetProgress: (userId) =>
        request(`/admin/users/${encodeURIComponent(userId)}/progress`, {
          method: "DELETE",
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
      delete: (moduleId, { purgeProgress = false } = {}) =>
        request(
          `/admin/modules/${encodeURIComponent(moduleId)}${purgeProgress ? "?purgeProgress=1" : ""}`,
          { method: "DELETE" },
        ),
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
    media: {
      uploadImage: (file, options) => {
        const formData = new FormData();
        formData.append("file", file, file.name);
        return upload("/admin/media/images", formData, options);
      },
      uploadPresentation: (file, options) => {
        const formData = new FormData();
        formData.append("file", file, file.name);
        return upload("/admin/media/presentations", formData, options);
      },
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
