import { useRef, useState } from "react";
import { useAiChat } from "@/components/ai/AiChatProvider";
import { hasFinePointer } from "@/lib/utils";

const PHOTO_PROMPT =
  "Tolong analisis foto farm ini. Bedakan observasi visual, hal yang belum pasti, dan data yang perlu saya cek berikutnya.";
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export function findLastAssistantMessageIndex(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") return index;
  }
  return -1;
}

/** What an answer can repeat: a cut answer is sent again, the newest whole one can be remade. */
export function answerPrompts(messages, index) {
  const message = messages[index];
  const question = messages[index - 1]?.content ?? "";
  const cut = message.fallback || message.error || message.stopped || message.interrupted;
  return {
    retryPrompt: cut ? question : "",
    regeneratePrompt: !cut && index === findLastAssistantMessageIndex(messages) ? question : "",
  };
}

/**
 * Asking APPI from the workspace and the quick panel: the photo waiting in the
 * composer and the one send path, so the two surfaces cannot drift apart.
 * `composerField` finds the question field, which takes the focus after a send.
 */
export default function useChatSubmit({ includeFarm, allowWebSearch, pageContext, composerField }) {
  const { promptDraft, isStreaming, isLoadingConversation, send } = useAiChat();
  const [imageAttachment, setImageAttachment] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const imageInputRef = useRef(null);

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setImageLoading(false);
      setAttachmentError("Gunakan foto JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setImageLoading(false);
      setAttachmentError("Ukuran foto maksimal 3 MB.");
      return;
    }
    setImageLoading(true);
    setAttachmentError("");
    const reader = new FileReader();
    reader.onload = () => {
      setImageAttachment({ dataUrl: String(reader.result), name: file.name });
      setImageLoading(false);
      setAttachmentError("");
    };
    reader.onerror = () => {
      setImageLoading(false);
      setAttachmentError("Foto tidak dapat dibaca.");
    };
    reader.readAsDataURL(file);
  };

  const submit = async (text = promptDraft, { retry = false } = {}) => {
    const content = text.trim();
    if ((!content && !imageAttachment) || isStreaming || isLoadingConversation || imageLoading) return;
    // The button pressed goes away with the answer, so the question field takes the focus.
    if (hasFinePointer()) window.requestAnimationFrame(() => composerField()?.focus());
    const result = await send(content || PHOTO_PROMPT, {
      retry,
      includeFarm,
      allowWebSearch,
      image: retry ? null : imageAttachment,
      pageContext,
    });
    if (result?.ok && !retry) {
      setImageAttachment(null);
      setAttachmentError("");
    }
  };

  return {
    submit,
    retryAnswer: (prompt) => submit(prompt, { retry: true }),
    imageInputRef,
    handleImageSelection,
    imageAttachment,
    removeImage: () => setImageAttachment(null),
    imageLoading,
    attachmentError,
  };
}
