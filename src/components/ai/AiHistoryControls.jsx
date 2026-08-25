import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/primitives";

export const HISTORY_SORT_OPTIONS = [
  { value: "updated", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "title", label: "A–Z" },
];

const conversationDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

const conversationTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

function parseTimestamp(value) {
  if (!value) return 0;
  const direct = new Date(value).getTime();
  if (Number.isFinite(direct)) return direct;

  const normalized = new Date(String(value).replace(" ", "T")).getTime();
  return Number.isFinite(normalized) ? normalized : 0;
}

export function getConversationTimestamp(conversation) {
  return parseTimestamp(
    conversation?.updatedAt ??
      conversation?.updated_at ??
      conversation?.lastMessageAt ??
      conversation?.last_message_at ??
      conversation?.createdAt ??
      conversation?.created_at,
  );
}

export function getConversationTitle(conversation) {
  const title = String(conversation?.title || "").trim();
  return title || "Percakapan baru";
}

export function formatConversationTime(conversation) {
  const timestamp = getConversationTimestamp(conversation);
  if (!timestamp) return "Baru";

  const date = new Date(timestamp);
  const isToday = new Date().toDateString() === date.toDateString();
  return isToday
    ? conversationTimeFormatter.format(date)
    : conversationDateFormatter.format(date);
}

export function filterAndSortConversations(
  conversations = [],
  query = "",
  sort = "updated",
) {
  const keyword = query.trim().toLocaleLowerCase("id-ID");
  const filtered = conversations.filter((conversation) => {
    if (!keyword) return true;
    return `${getConversationTitle(conversation)} ${conversation.lastMessagePreview || ""}`
      .toLocaleLowerCase("id-ID")
      .includes(keyword);
  });

  return filtered
    .map((conversation, index) => ({ conversation, index }))
    .sort(({ conversation: left, index: leftIndex }, { conversation: right, index: rightIndex }) => {
      if (sort === "title") {
        const titleOrder = getConversationTitle(left).localeCompare(
          getConversationTitle(right),
          "id",
          { sensitivity: "base" },
        );
        if (titleOrder !== 0) return titleOrder;
      } else {
        const leftTime = getConversationTimestamp(left);
        const rightTime = getConversationTimestamp(right);
        if (leftTime !== rightTime) {
          return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
        }
      }
      return leftIndex - rightIndex;
    })
    .map(({ conversation }) => conversation);
}

export function AiHistoryToolbar({
  view,
  onViewChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onClearQuery,
  conversationCount = 0,
  activityCount = 0,
  compact = false,
}) {
  return (
    <div className={`min-w-0 max-w-full ${compact ? "space-y-2" : "space-y-2.5"}`}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-2 rounded-lg bg-surface-subtle p-0.5">
            <button
              type="button"
              onClick={() => onViewChange("chats")}
              className={`min-w-0 rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${view === "chats" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={view === "chats"}
            >
              Chat <span className="ml-0.5 tabular-nums opacity-65">{conversationCount}</span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange("activity")}
              className={`min-w-0 rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${view === "activity" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={view === "activity"}
            >
              Aktivitas <span className="ml-0.5 tabular-nums opacity-65">{activityCount}</span>
            </button>
          </div>
        </div>
      </div>

      {view === "chats" ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 transition-colors focus-within:border-brand-orange/55 focus-within:ring-1 focus-within:ring-brand-orange/15">
            <AapmIcon
              name="solar:magnifer-bold-duotone"
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Cari riwayat"
              className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
              aria-label="Cari riwayat percakapan"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClearQuery}
                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Hapus pencarian"
              >
                <AapmIcon name="solar:close-circle-bold" className="h-3.5 w-3.5" />
              </Button>
            )}
          </label>
          <Select value={sort} onValueChange={onSortChange}>
            <SelectTrigger
              aria-label="Urutkan riwayat percakapan"
              className="h-[2.15rem] w-[6.7rem] shrink-0 gap-1 px-2 text-[10px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="min-w-[7.5rem]">
              {HISTORY_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="px-0.5 text-[10px] text-muted-foreground">
          Jejak pertanyaan dan respons APPI di akun ini.
        </p>
      )}
    </div>
  );
}

export function AiConversationRow({
  conversation,
  active = false,
  disabled = false,
  onSelect,
  onDelete,
}) {
  const title = getConversationTitle(conversation);

  return (
    <div
      className={`group relative flex min-w-0 max-w-full items-center overflow-hidden border-b border-border/60 transition-colors last:border-b-0 ${active ? "bg-tint-orange/75" : "hover:bg-surface-default"}`}
    >
      {active && (
        <span
          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-orange"
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        disabled={disabled}
        className="min-w-0 flex-1 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
            {title}
          </span>
          <time className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
            {formatConversationTime(conversation)}
          </time>
        </span>
        <span className="mt-0.5 block truncate text-[10px] leading-4 text-muted-foreground">
          {conversation.lastMessagePreview || "Belum ada pesan"}
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onDelete(conversation)}
        disabled={disabled}
        className="mr-1 h-7 w-7 shrink-0 text-muted-foreground opacity-100 transition-opacity hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={`Hapus percakapan ${title}`}
      >
        <AapmIcon name="solar:trash-bin-trash-bold" className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
