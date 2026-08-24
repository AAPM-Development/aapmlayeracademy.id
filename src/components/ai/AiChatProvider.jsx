import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nativeApi } from '@/api/nativeClient';
import { useFarmData } from '@/lib/useCourseData';

const AiChatContext = createContext(null);
const idFor = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function clientMessage(message) {
  return {
    id: message.id ?? idFor(`history-${message.role}`),
    role: message.role,
    content: message.content ?? '',
    provider: message.provider ?? null,
    model: message.model ?? null,
    fallback: Boolean(message.fallback),
    notice: message.notice ?? '',
    streaming: Boolean(message.streaming),
    createdAt: message.createdAt ?? null,
  };
}

export function AiChatProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: farm = [] } = useFarmData();
  const conversationsQuery = useQuery({
    queryKey: ['aiConversations'],
    queryFn: () => nativeApi.ai.conversations.list(),
    staleTime: 20_000,
  });
  const conversations = conversationsQuery.data ?? [];
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isDraft, setIsDraft] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const activeRef = useRef(null);

  useEffect(() => { activeRef.current = activeConversationId; }, [activeConversationId]);

  const selectConversation = useCallback(async (id) => {
    if (!id || isStreaming) return;
    setIsDraft(false);
    setActiveConversationId(id);
    activeRef.current = id;
    setIsLoadingConversation(true);
    try {
      const detail = await nativeApi.ai.conversations.detail(id);
      if (activeRef.current === id) {
        setMessages((detail.messages ?? []).map(clientMessage));
      }
    } catch {
      if (activeRef.current === id) {
        setMessages([]);
        setIsDraft(true);
        setActiveConversationId(null);
        activeRef.current = null;
      }
    } finally {
      if (activeRef.current === id) setIsLoadingConversation(false);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!isDraft && !activeConversationId && conversations.length > 0) {
      selectConversation(conversations[0].id);
    }
  }, [activeConversationId, conversations, isDraft, selectConversation]);

  const startNewConversation = useCallback(() => {
    if (isStreaming) return;
    setIsDraft(true);
    setActiveConversationId(null);
    setMessages([]);
    setStreamStatus('');
  }, [isStreaming]);

  const ensureConversation = useCallback(async (title) => {
    if (activeConversationId) return { id: activeConversationId };
    const conversation = await nativeApi.ai.conversations.create(title);
    setIsDraft(false);
    setActiveConversationId(conversation.id);
    activeRef.current = conversation.id;
    queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
    return conversation;
  }, [activeConversationId, queryClient]);

  const send = useCallback(async (rawMessage, { includeFarm = true } = {}) => {
    const message = rawMessage.trim();
    if (!message || isStreaming) return;
    const conversation = await ensureConversation(message);
    const assistantId = idFor('assistant');
    const userId = idFor('user');
    setMessages((current) => [...current, clientMessage({ id: userId, role: 'user', content: message }), clientMessage({ id: assistantId, role: 'assistant', content: '', streaming: true })]);
    setIsStreaming(true);
    setStreamStatus('Membaca konteks farm');
    const updateAssistant = (update) => setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, ...update } : item));
    try {
      await nativeApi.ai.conversations.stream({
        id: conversation.id,
        message,
        farmContext: includeFarm && farm.length ? farm.slice(-8) : null,
        onEvent: ({ event, data }) => {
          if (event === 'status') setStreamStatus(data.label || 'Menyusun jawaban');
          if (event === 'delta' && data.text) {
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: `${item.content}${data.text}` } : item));
          }
          if (event === 'notice') updateAssistant({ notice: data.text || '', fallback: true });
          if (event === 'done') updateAssistant({
            streaming: false,
            provider: data.provider,
            model: data.model,
            fallback: Boolean(data.fallback),
          });
        },
      });
      updateAssistant({ streaming: false });
    } catch (error) {
      updateAssistant({ streaming: false, content: error?.message || 'Koneksi ke asisten belum tersedia.', error: true });
    } finally {
      setIsStreaming(false);
      setStreamStatus('');
      queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
    }
  }, [ensureConversation, farm, isStreaming, queryClient]);

  const deleteConversation = useCallback(async (id) => {
    if (!id || isStreaming) return;
    await nativeApi.ai.conversations.delete(id);
    queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
      setIsDraft(true);
    }
  }, [activeConversationId, isStreaming, queryClient]);

  const value = useMemo(() => ({
    conversations,
    conversationsLoading: conversationsQuery.isLoading,
    activeConversationId,
    messages,
    isDraft,
    isLoadingConversation,
    isStreaming,
    streamStatus,
    selectConversation,
    startNewConversation,
    deleteConversation,
    send,
  }), [activeConversationId, conversations, conversationsQuery.isLoading, deleteConversation, isDraft, isLoadingConversation, isStreaming, messages, selectConversation, send, startNewConversation, streamStatus]);

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat() {
  const context = useContext(AiChatContext);
  if (!context) throw new Error('useAiChat harus digunakan di dalam AiChatProvider.');
  return context;
}
