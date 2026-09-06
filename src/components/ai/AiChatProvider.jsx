import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { nativeApi } from "@/api/nativeClient";
import { useFarmData } from "@/lib/useCourseData";
import { useAuth } from "@/lib/AuthContext";
import {
  flattenConversationPages,
  removeConversationFromPages,
  upsertConversationInPages,
} from "@/lib/aiHistoryState";

const AiChatContext = createContext(null);
const HISTORY_PAGE_SIZE = 40;
const ACTIVE_CONVERSATION_STORAGE_KEY = "aapm:appi:active:v1";
const COMPOSER_DRAFT_STORAGE_KEY = "aapm:appi:draft:v1";

function scopedStorageKey(prefix, accountId, scope = "new") {
  if (!accountId) return "";
  return `${prefix}:${encodeURIComponent(String(accountId))}:${encodeURIComponent(String(scope || "new"))}`;
}

function readStorage(key) {
  if (!key || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key, value) {
  if (!key || typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Private browsing and storage quotas must not break the chat journey.
  }
}

const idFor = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function clientMessage(message) {
  return {
    id: message.id ?? idFor(`history-${message.role}`),
    role: message.role,
    content: message.content ?? "",
    provider: message.provider ?? null,
    model: message.model ?? null,
    fallback: Boolean(message.fallback),
    notice: message.notice ?? "",
    streaming: Boolean(message.streaming),
    persisted: message.persisted !== false,
    error: Boolean(message.error),
    image: message.image ?? null,
    createdAt: message.createdAt ?? null,
  };
}

export function AiChatProvider({ children }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: farm = [] } = useFarmData();
  const accountId = user?.id ? String(user.id) : null;
  const conversationQueryKey = useMemo(
    () => ["aiConversations", accountId ?? "anonymous"],
    [accountId],
  );
  const activityQueryKey = useMemo(
    () => ["aiActivity", accountId ?? "anonymous"],
    [accountId],
  );
  const conversationsQuery = useInfiniteQuery({
    queryKey: conversationQueryKey,
    queryFn: ({ pageParam = "" }) =>
      nativeApi.ai.conversations.list({
        cursor: pageParam,
        limit: HISTORY_PAGE_SIZE,
      }),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage?.nextCursor || undefined,
    enabled: Boolean(accountId),
    staleTime: 20_000,
  });
  const activityQuery = useQuery({
    queryKey: activityQueryKey,
    queryFn: () => nativeApi.ai.activity.list(),
    enabled: Boolean(accountId),
    staleTime: 15_000,
  });

  const conversations = useMemo(
    () => flattenConversationPages(conversationsQuery.data),
    [conversationsQuery.data],
  );
  const conversationTotal = Number(
    conversationsQuery.data?.pages?.[0]?.total ?? conversations.length,
  );
  const activity = activityQuery.data ?? [];
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isDraft, setIsDraft] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  const [streamSteps, setStreamSteps] = useState([]);
  const [streamPhase, setStreamPhase] = useState("idle");
  const [historySyncState, setHistorySyncState] = useState("idle");
  const [historyError, setHistoryError] = useState(null);
  const [promptDraft, setPromptDraftState] = useState("");
  const [retryingMessageId, setRetryingMessageId] = useState(null);
  const activeRef = useRef(null);
  const messagesRef = useRef([]);
  const draftRef = useRef(false);
  const phaseTimerRef = useRef(null);
  const restoreAttemptedRef = useRef(null);

  const settleStreamPhase = useCallback((phase, delay = 1100) => {
    window.clearTimeout(phaseTimerRef.current);
    setStreamPhase(phase);
    phaseTimerRef.current = window.setTimeout(
      () => setStreamPhase("idle"),
      delay,
    );
  }, []);

  useEffect(
    () => () => window.clearTimeout(phaseTimerRef.current),
    [],
  );

  useEffect(() => {
    activeRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    draftRef.current = isDraft;
  }, [isDraft]);

  const activeConversationStorageKey = useCallback(
    () => scopedStorageKey(ACTIVE_CONVERSATION_STORAGE_KEY, accountId, "current"),
    [accountId],
  );
  const composerDraftStorageKey = useCallback(
    (conversationId = activeRef.current) =>
      scopedStorageKey(COMPOSER_DRAFT_STORAGE_KEY, accountId, conversationId || "new"),
    [accountId],
  );
  const persistActiveConversation = useCallback(
    (conversationId) => writeStorage(activeConversationStorageKey(), conversationId ? String(conversationId) : ""),
    [activeConversationStorageKey],
  );
  const setPromptDraft = useCallback(
    (value) => {
      const next = typeof value === "string" ? value.slice(0, 3000) : "";
      setPromptDraftState(next);
      writeStorage(composerDraftStorageKey(), next);
    },
    [composerDraftStorageKey],
  );
  const clearPromptDraft = useCallback(
    (conversationId = activeRef.current) => {
      writeStorage(composerDraftStorageKey("new"), "");
      if (conversationId) writeStorage(composerDraftStorageKey(conversationId), "");
      setPromptDraftState("");
    },
    [composerDraftStorageKey],
  );

  // Account data must never be reused when the active session changes.
  useEffect(() => {
    restoreAttemptedRef.current = null;
    activeRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setIsDraft(true);
    setIsLoadingConversation(false);
    setIsStreaming(false);
    setStreamStatus("");
    setStreamSteps([]);
    setStreamPhase("idle");
    setHistorySyncState("idle");
    setHistoryError(null);
    setRetryingMessageId(null);
    setPromptDraftState(readStorage(scopedStorageKey(COMPOSER_DRAFT_STORAGE_KEY, accountId, "new")));
  }, [accountId]);

  const upsertConversation = useCallback(
    (conversation) => {
      if (!conversation?.id || !accountId) return;
      queryClient.setQueryData(conversationQueryKey, (current) =>
        upsertConversationInPages(current, conversation),
      );
    },
    [accountId, conversationQueryKey, queryClient],
  );

  const reconcileConversation = useCallback(
    async (id, { replaceMessages = true, expectedAssistantContent = null } = {}) => {
      if (!id || !accountId) {
        return { ok: false, assistantPersisted: false };
      }
      try {
        const detail = await nativeApi.ai.conversations.detail(id);
        const detailMessages = detail?.messages ?? [];
        const latestMessage = detailMessages.at(-1);
        const assistantPersisted =
          latestMessage?.role === "assistant" &&
          (expectedAssistantContent === null ||
            typeof expectedAssistantContent === "string") &&
          (expectedAssistantContent === null ||
            latestMessage?.content === expectedAssistantContent);
        if (detail?.conversation) upsertConversation(detail.conversation);
        if (replaceMessages && activeRef.current === id) {
          setMessages(
            detailMessages.map((message) =>
              clientMessage({ ...message, persisted: true }),
            ),
          );
          setIsDraft(false);
        }
        return { ok: true, assistantPersisted };
      } catch (error) {
        setHistoryError(error);
        return { ok: false, assistantPersisted: false };
      }
    },
    [accountId, upsertConversation],
  );

  const selectConversation = useCallback(
    async (id) => {
      if (!id || isStreaming) return false;
      const previousId = activeRef.current;
      const previousMessages = messagesRef.current;
      const previousDraft = draftRef.current;
      setHistoryError(null);
      setIsDraft(false);
      setActiveConversationId(id);
      activeRef.current = id;
      setIsLoadingConversation(true);
      try {
        const detail = await nativeApi.ai.conversations.detail(id);
        if (activeRef.current === id) {
          if (detail?.conversation) upsertConversation(detail.conversation);
          setMessages(
            (detail?.messages ?? []).map((message) =>
              clientMessage({ ...message, persisted: true }),
            ),
          );
          persistActiveConversation(id);
          setPromptDraftState(readStorage(composerDraftStorageKey(id)));
          setHistorySyncState("saved");
        }
        return true;
      } catch (error) {
        if (activeRef.current === id) {
          setActiveConversationId(previousId);
          activeRef.current = previousId;
          setMessages(previousMessages);
          setIsDraft(previousDraft);
        }
        setHistoryError(error);
        setHistorySyncState("attention");
        return false;
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [composerDraftStorageKey, isStreaming, persistActiveConversation, upsertConversation],
  );

  const startNewConversation = useCallback(() => {
    if (isStreaming) return;
    activeRef.current = null;
    persistActiveConversation(null);
    setIsDraft(true);
    setActiveConversationId(null);
    setMessages([]);
    setStreamStatus("");
    setStreamSteps([]);
    setStreamPhase("idle");
    setHistorySyncState("idle");
    setHistoryError(null);
    setPromptDraftState(readStorage(composerDraftStorageKey("new")));
  }, [composerDraftStorageKey, isStreaming, persistActiveConversation]);

  const ensureConversation = useCallback(
    async (title) => {
      if (activeRef.current) return { id: activeRef.current };
      const conversation = await nativeApi.ai.conversations.create(title);
      setIsDraft(false);
      setActiveConversationId(conversation.id);
      activeRef.current = conversation.id;
      persistActiveConversation(conversation.id);
      upsertConversation(conversation);
      queryClient.invalidateQueries({ queryKey: conversationQueryKey });
      return conversation;
    },
    [conversationQueryKey, persistActiveConversation, queryClient, upsertConversation],
  );

  useEffect(() => {
    if (
      !accountId ||
      conversationsQuery.isLoading ||
      conversationsQuery.isFetching ||
      restoreAttemptedRef.current === accountId
    ) {
      return;
    }
    restoreAttemptedRef.current = accountId;
    const savedConversationId = readStorage(activeConversationStorageKey());
    if (!savedConversationId) return;
    void selectConversation(savedConversationId).then((restored) => {
      if (!restored) persistActiveConversation(null);
    });
  }, [
    accountId,
    activeConversationStorageKey,
    conversationsQuery.isFetching,
    conversationsQuery.isLoading,
    persistActiveConversation,
    selectConversation,
  ]);

  const send = useCallback(
    async (
      rawMessage,
      {
        includeFarm = true,
        allowWebSearch = false,
        image = null,
        pageContext = "",
      } = {},
    ) => {
      const message = rawMessage.trim();
      if (!message || isStreaming) return;

      let conversation;
      try {
        conversation = await ensureConversation(message);
      } catch (error) {
        setHistoryError(error);
        setHistorySyncState("attention");
        setPromptDraft(message);
        return { ok: false, persisted: false };
      }

      const assistantId = idFor("assistant");
      const userId = idFor("user");
      let pendingText = "";
      let streamedContent = "";
      let deltaFrame = null;
      let persisted = false;
      const updateAssistant = (update) =>
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId ? { ...item, ...update } : item,
          ),
        );
      const flushPendingText = () => {
        if (deltaFrame !== null) {
          window.cancelAnimationFrame(deltaFrame);
          deltaFrame = null;
        }
        if (!pendingText) return;
        const text = pendingText;
        pendingText = "";
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? { ...item, content: `${item.content}${text}` }
              : item,
          ),
        );
      };
      const queueDelta = (text) => {
        streamedContent += text;
        pendingText += text;
        if (deltaFrame === null) {
          deltaFrame = window.requestAnimationFrame(flushPendingText);
        }
      };

      setMessages((current) => [
        ...current,
        clientMessage({
          id: userId,
          role: "user",
          content: message,
          image,
          persisted: false,
        }),
        clientMessage({
          id: assistantId,
          role: "assistant",
          content: "",
          streaming: true,
          persisted: false,
        }),
      ]);
      setIsStreaming(true);
      setHistorySyncState("saving");
      setHistoryError(null);
      window.clearTimeout(phaseTimerRef.current);
      setStreamPhase("thinking");
      const startLabel = "APPI menyiapkan konteks percakapan";
      setStreamStatus(startLabel);
      setStreamSteps([startLabel]);
      const reportStep = (label) => {
        const nextLabel = label || "APPI menyusun jawaban";
        setStreamStatus(nextLabel);
        setStreamSteps((current) =>
          current.at(-1) === nextLabel
            ? current
            : [...current, nextLabel].slice(-4),
        );
      };

      try {
        await nativeApi.ai.conversations.stream({
          id: conversation.id,
          message,
          farmContext: includeFarm && farm.length ? farm.slice(-8) : null,
          includeFarmContext: includeFarm,
          allowWebSearch,
          imageDataUrl: image?.dataUrl ?? null,
          pageContext,
          onEvent: ({ event, data }) => {
            if (event === "status") reportStep(data.label);
            if (event === "delta" && data.text) {
              setStreamPhase("responding");
              queueDelta(data.text);
            }
            if (event === "notice") {
              updateAssistant({ notice: data.text || "", fallback: true });
            }
            if (event === "persistence_error") {
              updateAssistant({
                notice:
                  data.message ||
                  "Jawaban belum tersimpan ke riwayat akun.",
                persisted: false,
              });
              reportStep("Riwayat akun belum tersimpan");
              setHistorySyncState("attention");
            }
            if (event === "persisted") {
              flushPendingText();
              persisted = true;
              updateAssistant({ persisted: true });
              if (data.conversation) upsertConversation(data.conversation);
              setHistorySyncState("saved");
            }
            if (event === "done") {
              flushPendingText();
              if (data.conversation) upsertConversation(data.conversation);
              const didPersist = data.persisted !== false;
              persisted = persisted || didPersist;
              updateAssistant({
                streaming: false,
                persisted,
                provider: data.provider,
                model: data.model,
                fallback: Boolean(data.fallback),
              });
              if (!didPersist) setHistorySyncState("attention");
            }
          },
        });
        flushPendingText();
        const reconciled = await reconcileConversation(conversation.id, {
          // Keep the visible local answer when Phase 3 failed. Replacing it
          // with the DB detail here used to erase the only copy the user
          // could retry.
          replaceMessages: persisted,
          expectedAssistantContent: streamedContent || null,
        });
        const didPersist = reconciled.assistantPersisted || persisted;
        setHistorySyncState(didPersist ? "saved" : "attention");
        if (reconciled.assistantPersisted && !persisted) {
          updateAssistant({ persisted: true, error: false, notice: "", streaming: false });
        }
        if (didPersist) clearPromptDraft(conversation.id);
        settleStreamPhase("complete");
        return { ok: true, persisted: didPersist, conversationId: conversation.id, assistantId };
      } catch (error) {
        flushPendingText();
        const visibleContent = streamedContent || error?.message || "Koneksi ke asisten belum tersedia.";
        updateAssistant({
          streaming: false,
          persisted,
          content: visibleContent,
          notice: streamedContent ? "Jawaban terputus sebelum selesai. Coba kirim ulang." : "",
          error: true,
        });
        const reconciled = await reconcileConversation(conversation.id, {
          replaceMessages: false,
          expectedAssistantContent: streamedContent || null,
        });
        const didPersist = reconciled.assistantPersisted || persisted;
        if (reconciled.assistantPersisted && !persisted) {
          updateAssistant({ persisted: true, error: false, notice: "", streaming: false });
        }
        setHistorySyncState(didPersist ? "saved" : "attention");
        setHistoryError(didPersist ? null : error);
        settleStreamPhase(didPersist ? "complete" : "alert", didPersist ? 1100 : 1500);
        if (didPersist) clearPromptDraft(conversation.id);
        else setPromptDraft(message);
        return { ok: didPersist, persisted: didPersist, conversationId: conversation.id, assistantId };
      } finally {
        if (deltaFrame !== null) window.cancelAnimationFrame(deltaFrame);
        setIsStreaming(false);
        setStreamStatus("");
        setStreamSteps([]);
        queryClient.invalidateQueries({ queryKey: conversationQueryKey });
        queryClient.invalidateQueries({ queryKey: activityQueryKey });
      }
    },
    [
      activityQueryKey,
      clearPromptDraft,
      conversationQueryKey,
      ensureConversation,
      farm,
      isStreaming,
      queryClient,
      reconcileConversation,
      setPromptDraft,
      settleStreamPhase,
      upsertConversation,
    ],
  );

  const retryPersistAssistant = useCallback(
    async (message) => {
      const conversationId = activeRef.current;
      if (
        !accountId ||
        !conversationId ||
        !message?.content ||
        message.persisted ||
        isStreaming ||
        retryingMessageId
      ) {
        return false;
      }
      setRetryingMessageId(message.id);
      setHistoryError(null);
      setHistorySyncState("saving");
      try {
        const result = await nativeApi.ai.conversations.persistAssistant(conversationId, {
          content: message.content,
          provider: message.provider || "",
          model: message.model || "",
          fallback: Boolean(message.fallback),
        });
        if (result?.conversation) upsertConversation(result.conversation);
        const reconciled = await reconcileConversation(conversationId, { replaceMessages: true });
        if (reconciled.ok) {
          clearPromptDraft(conversationId);
          setHistorySyncState("saved");
          return true;
        }
        setHistorySyncState("attention");
        return false;
      } catch (error) {
        setHistoryError(error);
        setHistorySyncState("attention");
        return false;
      } finally {
        setRetryingMessageId(null);
        queryClient.invalidateQueries({ queryKey: conversationQueryKey });
        queryClient.invalidateQueries({ queryKey: activityQueryKey });
      }
    },
    [
      accountId,
      activityQueryKey,
      clearPromptDraft,
      conversationQueryKey,
      isStreaming,
      queryClient,
      reconcileConversation,
      retryingMessageId,
      upsertConversation,
    ],
  );

  const deleteConversation = useCallback(
    async (id) => {
      if (!id || isStreaming) return false;
      await nativeApi.ai.conversations.delete(id);
      queryClient.setQueryData(conversationQueryKey, (current) =>
        removeConversationFromPages(current, id),
      );
      queryClient.invalidateQueries({ queryKey: conversationQueryKey });
      queryClient.invalidateQueries({ queryKey: activityQueryKey });
      if (activeRef.current === id) {
        activeRef.current = null;
        persistActiveConversation(null);
        setActiveConversationId(null);
        setMessages([]);
        setIsDraft(true);
        clearPromptDraft(id);
        setPromptDraftState(readStorage(composerDraftStorageKey("new")));
        setHistorySyncState("idle");
      }
      return true;
    },
    [activityQueryKey, clearPromptDraft, composerDraftStorageKey, conversationQueryKey, isStreaming, persistActiveConversation, queryClient],
  );

  const renameConversation = useCallback(
    async (id, title) => {
      if (!id || isStreaming) return null;
      const conversation = await nativeApi.ai.conversations.update(id, { title });
      upsertConversation(conversation);
      queryClient.invalidateQueries({ queryKey: conversationQueryKey });
      return conversation;
    },
    [conversationQueryKey, isStreaming, queryClient, upsertConversation],
  );

  const refreshHistory = useCallback(async () => {
    setHistoryError(null);
    const [conversationResult, activityResult] = await Promise.all([
      conversationsQuery.refetch(),
      activityQuery.refetch(),
    ]);
    if (conversationResult.error || activityResult.error) {
      setHistoryError(conversationResult.error || activityResult.error);
    }
    return !conversationResult.error && !activityResult.error;
  }, [activityQuery, conversationsQuery]);

  const loadMoreConversations = useCallback(
    () => conversationsQuery.fetchNextPage(),
    [conversationsQuery],
  );

  const value = useMemo(
    () => ({
      conversations,
      conversationTotal,
      conversationsLoading: conversationsQuery.isLoading,
      conversationsRefreshing:
        conversationsQuery.isFetching && !conversationsQuery.isFetchingNextPage,
      conversationsError: conversationsQuery.error ?? null,
      hasMoreConversations: Boolean(conversationsQuery.hasNextPage),
      isLoadingMoreConversations: conversationsQuery.isFetchingNextPage,
      loadMoreConversations,
      refreshHistory,
      historyError,
      historySyncState,
      promptDraft,
      setPromptDraft,
      clearPromptDraft,
      retryPersistAssistant,
      retryingMessageId,
      activity,
      activityLoading: activityQuery.isLoading,
      activeConversationId,
      messages,
      isDraft,
      isLoadingConversation,
      isStreaming,
      streamStatus,
      streamSteps,
      streamPhase,
      selectConversation,
      startNewConversation,
      deleteConversation,
      renameConversation,
      send,
    }),
    [
      activeConversationId,
      activity,
      activityQuery.isLoading,
      conversationTotal,
      conversations,
      conversationsQuery.error,
      conversationsQuery.hasNextPage,
      conversationsQuery.isFetching,
      conversationsQuery.isFetchingNextPage,
      conversationsQuery.isLoading,
      deleteConversation,
      clearPromptDraft,
      historyError,
      historySyncState,
      isDraft,
      isLoadingConversation,
      isStreaming,
      loadMoreConversations,
      messages,
      promptDraft,
      setPromptDraft,
      refreshHistory,
      renameConversation,
      retryPersistAssistant,
      retryingMessageId,
      selectConversation,
      send,
      startNewConversation,
      streamPhase,
      streamStatus,
      streamSteps,
    ],
  );

  return (
    <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
  );
}

export function useAiChat() {
  const context = useContext(AiChatContext);
  if (!context)
    throw new Error("useAiChat harus digunakan di dalam AiChatProvider.");
  return context;
}
