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
  "/auth/verify-email",
  "/auth/resend-verification",
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

async function stream(path, body, onEvent, { signal } = /** @type {{ signal?: AbortSignal }} */ ({})) {
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
    signal,
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
  let completed = false;
  const dispatch = (block) => {
    const lines = block.split(/\r?\n/);
    const event =
      lines
        .find((line) => line.startsWith("event:"))
        ?.slice(6)
        .trim() || "message";
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) return;
    let parsed;
    try { parsed = JSON.parse(data); }
    catch { throw new ApiError("Respons APPI tidak dapat dibaca. Coba kirim ulang.", 0, "invalid_stream"); }
    if (event === "error") {
      throw new ApiError(parsed.message || "APPI belum dapat menjawab. Coba lagi.", 0, parsed.code || "stream_error");
    }
    // Let callback failures propagate; swallowing them leaves the UI stuck in a false success state.
    onEvent?.({ event, data: parsed });
    if (event === "done") completed = true;
  };

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      // Keep CRLF intact until a complete event arrives. CR and LF can be in separate chunks.
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let boundary = /\r?\n\r?\n/.exec(buffer);
      while (boundary && !completed) {
        dispatch(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
        boundary = /\r?\n\r?\n/.exec(buffer);
      }
      if (done) {
        if (buffer.trim() && !completed) dispatch(buffer);
        break;
      }
    }
    if (!completed) throw new ApiError("Koneksi APPI terputus sebelum jawaban selesai. Coba kirim ulang.", 0, "stream_interrupted");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
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

/** Idempotency key for one learner action: 8–80 characters from [A-Za-z0-9_-]. */
export function newRequestKey() {
  const id = globalThis.crypto?.randomUUID?.();
  return id || `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

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
    async verifyEmail(token) {
      return request("/auth/verify-email", json({ token }));
    },
    async resendVerification(payload = {}) {
      return request("/auth/resend-verification", json(payload));
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
  // Academic results are decided on the server. Learners start, answer and
  // submit assessments and record learning activity; they never write
  // completion, scores, or certificates.
  assessments: {
    start: (data) => request("/assessments/attempts", json(data)),
    get: (attemptId) => request(`/assessments/attempts/${encodeURIComponent(attemptId)}`),
    answer: (attemptId, data) => request(`/assessments/attempts/${encodeURIComponent(attemptId)}/answers`, json(data)),
    submit: (attemptId, data) => request(`/assessments/attempts/${encodeURIComponent(attemptId)}/submit`, json(data)),
    finalEligibility: () => request("/assessments/final-eligibility"),
  },
  learning: {
    acknowledge: (moduleNumber) => request(`/modules/${encodeURIComponent(moduleNumber)}/acknowledge`, json({})),
    practice: (moduleNumber, data) => request(`/modules/${encodeURIComponent(moduleNumber)}/practice`, json(data)),
    studyTime: (moduleNumber, data) => request(`/modules/${encodeURIComponent(moduleNumber)}/study-time`, json(data)),
  },
  userProgress: {
    list: () => request("/progress"),
  },
  certificates: {
    list: () => request("/certificates"),
    detail: (id) => request(`/certificates/${encodeURIComponent(id)}`),
    claim: (tierNumber, requestKey) => request("/certificates/claims", json({ tierNumber, requestKey })),
    eligibility: () => request("/certification/eligibility"),
  },
  publicCertificates: {
    verify: (publicId) => request(`/public/certificates/verify/${encodeURIComponent(publicId)}`),
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
    stream: ({ message, farmContext, includeFarmContext = true, onEvent, signal }) =>
      stream("/ai-assistant/stream", { message, farmContext, includeFarmContext }, onEvent, { signal }),
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
        signal,
      }) =>
        stream(
          `/ai/conversations/${encodeURIComponent(id)}/stream`,
          { message, farmContext, includeFarmContext, allowWebSearch, imageDataUrl, pageContext },
          onEvent,
          { signal },
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
          body: JSON.stringify({ confirm: true }),
        }),
    },
    certificates: {
      list: (query = {}) => request(`/admin/certificates?${new URLSearchParams(query).toString()}`),
      detail: (publicId) => request(`/admin/certificates/${encodeURIComponent(publicId)}`),
      revoke: (publicId, body) => request(`/admin/certificates/${encodeURIComponent(publicId)}/revoke`, json({ ...body, confirm: true })),
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
      renameChapter: (levelNumber, levelName) =>
        request(`/admin/chapters/${encodeURIComponent(levelNumber)}`, {
          method: "PUT",
          body: JSON.stringify({ levelName }),
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
