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

const AiChatContext = createContext(null);
const HISTORY_PAGE_SIZE = 40;

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

function pageItems(page) {
  return Array.isArray(page?.items) ? page.items : [];
}

function flattenConversationPages(data) {
  const seen = new Set();
  return (data?.pages ?? [])
    .flatMap((page) => pageItems(page))
    .filter((conversation) => {
      if (!conversation?.id || seen.has(conversation.id)) return false;
      seen.add(conversation.id);
      return true;
    });
}

function upsertConversationInPages(data, conversation) {
  if (!data?.pages?.length || !conversation?.id) return data;
  let existed = false;
  const pages = data.pages.map((page) => ({
    ...page,
    items: pageItems(page).filter((item) => {
      if (item.id !== conversation.id) return true;
      existed = true;
      return false;
    }),
  }));
  const firstPage = pages[0];
  const total = Math.max(
    0,
    Number(firstPage.total ?? flattenConversationPages(data).length) +
      (existed ? 0 : 1),
  );

  pages[0] = {
    ...firstPage,
    total,
    items: [conversation, ...pageItems(firstPage)],
  };
  return { ...data, pages };
}

function removeConversationFromPages(data, conversationId) {
  if (!data?.pages?.length) return data;
  let removed = false;
  const pages = data.pages.map((page) => ({
    ...page,
    items: pageItems(page).filter((item) => {
      if (item.id !== conversationId) return true;
      removed = true;
      return false;
    }),
  }));
  if (removed && pages[0]) {
    pages[0] = {
      ...pages[0],
      total: Math.max(0, Number(pages[0].total ?? 0) - 1),
    };
  }
  return { ...data, pages };
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
  const activeRef = useRef(null);
  const messagesRef = useRef([]);
  const draftRef = useRef(false);
  const phaseTimerRef = useRef(null);

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

  // Account data must never be reused when the active session changes.
  useEffect(() => {
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
          typeof expectedAssistantContent === "string" &&
          latestMessage?.role === "assistant" &&
          latestMessage?.content === expectedAssistantContent;
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
    [isStreaming, upsertConversation],
  );

  const startNewConversation = useCallback(() => {
    if (isStreaming) return;
    activeRef.current = null;
    setIsDraft(true);
    setActiveConversationId(null);
    setMessages([]);
    setStreamStatus("");
    setStreamSteps([]);
    setStreamPhase("idle");
    setHistorySyncState("idle");
    setHistoryError(null);
  }, [isStreaming]);

  const ensureConversation = useCallback(
    async (title) => {
      if (activeRef.current) return { id: activeRef.current };
      const conversation = await nativeApi.ai.conversations.create(title);
      setIsDraft(false);
      setActiveConversationId(conversation.id);
      activeRef.current = conversation.id;
      upsertConversation(conversation);
      queryClient.invalidateQueries({ queryKey: conversationQueryKey });
      return conversation;
    },
    [conversationQueryKey, queryClient, upsertConversation],
  );

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
        return;
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
              updateAssistant({
                streaming: false,
                persisted: didPersist,
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
          replaceMessages: !persisted,
          expectedAssistantContent: streamedContent,
        });
        setHistorySyncState(
          reconciled.assistantPersisted || persisted ? "saved" : "attention",
        );
        settleStreamPhase("complete");
      } catch (error) {
        flushPendingText();
        updateAssistant({
          streaming: false,
          persisted,
          content: error?.message || "Koneksi ke asisten belum tersedia.",
          error: true,
        });
        const reconciled = await reconcileConversation(conversation.id, {
          expectedAssistantContent: streamedContent,
        });
        setHistorySyncState(
          reconciled.assistantPersisted || persisted ? "saved" : "attention",
        );
        setHistoryError(error);
        settleStreamPhase("alert", 1500);
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
      conversationQueryKey,
      ensureConversation,
      farm,
      isStreaming,
      queryClient,
      reconcileConversation,
      settleStreamPhase,
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
        setActiveConversationId(null);
        setMessages([]);
        setIsDraft(true);
        setHistorySyncState("idle");
      }
      return true;
    },
    [activityQueryKey, conversationQueryKey, isStreaming, queryClient],
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
    if (conversationResult.error) setHistoryError(conversationResult.error);
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
      historyError,
      historySyncState,
      isDraft,
      isLoadingConversation,
      isStreaming,
      loadMoreConversations,
      messages,
      refreshHistory,
      renameConversation,
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
