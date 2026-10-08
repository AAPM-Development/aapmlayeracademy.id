import React, { useCallback, useEffect, useMemo, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { isConversationArchived } from "@/lib/aiHistoryState";
import {
  Button,
  Checkbox,
  SegmentedControl,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
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

/**
 * Keep selection semantics identical in the desktop sidebar, mobile sheet,
 * and floating APPI history surface. Selection is intentionally local UI
 * state; the mutations themselves remain server-authoritative in the chat
 * provider.
 */
export function useConversationManagement({
  conversations = [],
  query = "",
  sort = "updated",
} = {}) {
  const [scope, setScopeState] = useState("active");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const activeCount = useMemo(
    () => conversations.filter((conversation) => !isConversationArchived(conversation)).length,
    [conversations],
  );
  const archivedCount = useMemo(
    () => conversations.filter((conversation) => isConversationArchived(conversation)).length,
    [conversations],
  );
  const scopedConversations = useMemo(
    () => conversations.filter((conversation) => (
      scope === "archived"
        ? isConversationArchived(conversation)
        : !isConversationArchived(conversation)
    )),
    [conversations, scope],
  );
  const visibleConversations = useMemo(
    () => filterAndSortConversations(scopedConversations, query, sort),
    [query, scopedConversations, sort],
  );
  const visibleIds = useMemo(
    () => visibleConversations.map((conversation) => String(conversation.id)),
    [visibleConversations],
  );
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    const scopedIds = new Set(scopedConversations.map((conversation) => String(conversation.id)));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => scopedIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [scopedConversations]);

  const setScope = useCallback((nextScope) => {
    setScopeState(nextScope === "archived" ? "archived" : "active");
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((current) => {
      if (current) setSelectedIds(new Set());
      return !current;
    });
  }, []);

  const toggleSelected = useCallback((id) => {
    const key = String(id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (visibleIds.every((id) => next.has(id))) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  return {
    scope,
    setScope,
    selectionMode,
    toggleSelectionMode,
    selectedIds,
    selectedConversationIds: [...selectedIds],
    selectedCount: selectedIds.size,
    visibleConversations,
    activeCount,
    archivedCount,
    allVisibleSelected,
    toggleSelected,
    toggleAllVisible,
    clearSelection,
  };
}

export function groupConversationsByPeriod(conversations = []) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const groups = new Map([
    ["Hari ini", []],
    ["Kemarin", []],
    ["7 hari terakhir", []],
    ["Sebelumnya", []],
  ]);

  conversations.forEach((conversation) => {
    const timestamp = getConversationTimestamp(conversation);
    const bucket =
      timestamp >= startOfToday.getTime()
        ? "Hari ini"
        : timestamp >= startOfYesterday.getTime()
          ? "Kemarin"
          : timestamp >= startOfWeek.getTime()
            ? "7 hari terakhir"
            : "Sebelumnya";
    groups.get(bucket).push(conversation);
  });

  return [...groups.entries()]
    .filter(([, items]) => items.length)
    .map(([label, items]) => ({ label, items }));
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
  totalConversationCount = conversationCount,
  activityCount = 0,
  onRefresh,
  isRefreshing = false,
  scope = "active",
  onScopeChange,
  activeCount = 0,
  archivedCount = 0,
  selectionMode = false,
  onToggleSelectionMode,
}) {
  return (
    <div className="min-w-0 max-w-full space-y-2.5">
      <SegmentedControl
        label="Jenis riwayat"
        block
        size="sm"
        value={view}
        onChange={onViewChange}
        options={[
          { value: "chats", label: "Chat", count: totalConversationCount },
          { value: "activity", label: "Aktivitas", count: activityCount },
        ]}
      />

      {view === "chats" ? (
        <>
          <label className="aapm-ai-search-control flex min-h-9 min-w-0 w-full items-center gap-2 px-2.5 py-2 transition-colors">
            <AapmIcon
              name="solar:magnifer-bold-duotone"
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Cari riwayat percakapan"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
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
          <div className="flex min-w-0 items-center gap-1.5">
            {onScopeChange && (
              <SegmentedControl
                label="Status percakapan"
                block
                size="sm"
                className="aapm-history-scope min-w-0 flex-1"
                value={scope}
                onChange={onScopeChange}
                options={[
                  { value: "active", label: "Aktif", count: activeCount },
                  { value: "archived", label: "Arsip", count: archivedCount },
                ]}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 shrink-0 ${selectionMode ? "text-brand-orange" : "text-muted-foreground"} hover:text-foreground`}
                  aria-label="Urutkan dan pilih percakapan"
                  title="Urutkan dan pilih"
                >
                  <AapmIcon name="solar:sort-vertical-bold-duotone" className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Urutkan</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sort} onValueChange={onSortChange}>
                  {HISTORY_SORT_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {(onToggleSelectionMode || onRefresh) && <DropdownMenuSeparator />}
                {onToggleSelectionMode && (
                  <DropdownMenuItem onSelect={onToggleSelectionMode}>
                    <AapmIcon name="solar:checklist-bold-duotone" className="mr-2 h-3.5 w-3.5 text-brand-orange" />
                    {selectionMode ? "Selesai memilih" : "Pilih percakapan"}
                  </DropdownMenuItem>
                )}
                {onRefresh && (
                  <DropdownMenuItem onSelect={onRefresh} disabled={isRefreshing}>
                    <AapmIcon name="solar:refresh-circle-bold-duotone" className="mr-2 h-3.5 w-3.5 text-brand-orange" />
                    Muat ulang riwayat
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <p className="px-0.5 text-xs text-muted-foreground">
          Jejak pertanyaan dan respons APPI di akun ini.
        </p>
      )}
    </div>
  );
}

export function AiHistoryBulkBar({
  scope = "active",
  selectedCount = 0,
  allVisibleSelected = false,
  onToggleAll,
  onArchive,
  onDelete,
  disabled = false,
}) {
  if (!selectedCount && !allVisibleSelected) {
    return (
      <div className="aapm-ai-history-bulkbar flex min-w-0 items-center gap-2 px-2.5 py-2 text-[10px] text-muted-foreground" role="status">
        <AapmIcon name="solar:checklist-bold-duotone" className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
        <span className="min-w-0 truncate">Mode pilih aktif · pilih chat di bawah.</span>
      </div>
    );
  }

  return (
    <div className="aapm-ai-history-bulkbar flex min-w-0 flex-wrap items-center gap-2 px-2.5 py-2" role="toolbar" aria-label="Aksi percakapan terpilih">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-semibold text-foreground">
        <Checkbox
          checked={allVisibleSelected}
          onCheckedChange={onToggleAll}
          disabled={disabled}
          aria-label="Pilih semua percakapan yang terlihat"
          className="h-4 w-4"
        />
        <span className="truncate">{selectedCount} dipilih</span>
      </label>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onArchive}
          disabled={disabled || !selectedCount}
          className="h-7 gap-1 px-2 text-[10px] text-foreground"
        >
          <AapmIcon name={scope === "archived" ? "solar:restart-bold-duotone" : "solar:archive-up-bold-duotone"} className="h-3.5 w-3.5 text-brand-orange" />
          {scope === "archived" ? "Pulihkan" : "Arsipkan"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={disabled || !selectedCount}
          className="h-7 gap-1 px-2 text-[10px] text-danger hover:bg-danger/5 hover:text-danger"
        >
          <AapmIcon name="solar:trash-bin-trash-bold" className="h-3.5 w-3.5" />
          Hapus
        </Button>
      </div>
    </div>
  );
}

export function AiConversationRow({
  conversation,
  active = false,
  disabled = false,
  onSelect,
  onDelete,
  onRename,
  onArchive,
  onToggleSelect,
  selectable = false,
  selected = false,
}) {
  const title = getConversationTitle(conversation);

  return (
    <div
      className="aapm-ai-history-row group relative flex min-w-0 max-w-full items-center overflow-hidden"
      data-active={active}
      data-selected={selected}
    >
      {active && (
        <span
          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-orange"
          aria-hidden="true"
        />
      )}
      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect?.(conversation.id)}
          disabled={disabled}
          aria-label={`${selected ? "Batalkan pilihan" : "Pilih"} percakapan ${title}`}
          className="ml-2 h-4 w-4 shrink-0"
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        disabled={disabled}
        className="min-w-0 flex-1 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange"
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="mr-1 h-7 w-7 shrink-0 text-muted-foreground opacity-100 transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Kelola percakapan ${title}`}
          >
            <AapmIcon name="solar:menu-dots-bold" className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => onRename?.(conversation)}>
            <AapmIcon name="solar:pen-new-square-bold" className="mr-2 h-3.5 w-3.5 text-brand-orange" />
            Ubah judul
          </DropdownMenuItem>
          {onArchive && (
            <DropdownMenuItem onSelect={() => onArchive(conversation, !isConversationArchived(conversation))}>
              <AapmIcon name={isConversationArchived(conversation) ? "solar:restart-bold-duotone" : "solar:archive-up-bold-duotone"} className="mr-2 h-3.5 w-3.5 text-brand-orange" />
              {isConversationArchived(conversation) ? "Pulihkan dari arsip" : "Arsipkan chat"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onDelete(conversation)}
            className="text-danger focus:text-danger"
          >
            <AapmIcon name="solar:trash-bin-trash-bold" className="mr-2 h-3.5 w-3.5" />
            Hapus chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AiConversationHistoryResults({
  conversations = [],
  activeConversationId = null,
  loading = false,
  error = null,
  disabled = false,
  onRetry,
  onSelect,
  onDelete,
  onRename,
  onArchive,
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  emptyMessage = "Belum ada percakapan. Pertanyaan pertama Anda akan tersimpan di sini.",
  noResultsMessage = "Tidak ada percakapan yang cocok.",
  filtered = false,
}) {
  if (loading) {
    return <p className="px-2 py-4 text-xs text-muted-foreground">Memuat riwayat...</p>;
  }

  if (error && !conversations.length) {
    return (
      <div className="aapm-ai-alert mx-1 border border-tint-orange-border bg-tint-orange px-3 py-3 text-xs leading-5 text-tint-orange-foreground">
        <div className="flex items-start gap-2">
          <AapmIcon name="solar:info-circle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">Riwayat belum dapat dimuat.</p>
            <p className="mt-0.5">Data chat tidak dihapus. Coba muat ulang untuk mengambilnya lagi dari akun Anda.</p>
            {onRetry && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="mt-2 h-7 px-0 text-[11px] font-semibold text-brand-orange hover:bg-transparent hover:text-brand-orange/75"
              >
                <AapmIcon name="solar:refresh-circle-bold-duotone" className="mr-1 h-3.5 w-3.5" />
                Muat ulang
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!conversations.length) {
    return <p className="px-2 py-4 text-xs leading-5 text-muted-foreground">{filtered ? noResultsMessage : emptyMessage}</p>;
  }

  const groups = groupConversationsByPeriod(conversations);
  return (
    <div className="min-w-0 max-w-full">
      {error && (
        <div className="aapm-ai-alert mx-1 mb-2 flex min-w-0 items-center justify-between gap-2 border border-tint-orange-border bg-tint-orange px-2.5 py-2 text-[10px] leading-4 text-tint-orange-foreground">
          <span className="min-w-0">Riwayat terbaru belum tersinkron. Data yang sudah tampil tetap aman.</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="shrink-0 font-semibold text-brand-orange hover:text-brand-orange/75">
              Coba lagi
            </button>
          )}
        </div>
      )}
      {groups.map((group) => (
        <section key={group.label} className="min-w-0 max-w-full">
          <p className="px-2 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:pt-1">
            {group.label}
          </p>
          <div className="aapm-ai-history-group">
            {group.items.map((conversation) => (
              <AiConversationRow
                key={conversation.id}
                conversation={conversation}
                active={activeConversationId != null && String(conversation.id) === String(activeConversationId)}
                disabled={disabled}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                onArchive={onArchive}
                selectable={selectable}
                selected={selectedIds.has(String(conversation.id))}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </section>
      ))}
      {hasMore && onLoadMore && (
        <div className="px-2 pb-1 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore || disabled}
            className="h-8 w-full text-[11px]"
          >
            <AapmIcon
              name={isLoadingMore ? "loading" : "solar:history-2-bold-duotone"}
              className={`mr-1.5 h-3.5 w-3.5 text-brand-orange ${isLoadingMore ? "animate-spin" : ""}`}
            />
            {isLoadingMore ? "Memuat riwayat…" : "Muat riwayat sebelumnya"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function AiConversationRenameDialog({
  conversation,
  onOpenChange,
  onRename,
  saving = false,
}) {
  const [title, setTitle] = useState("");
  const open = Boolean(conversation);

  useEffect(() => {
    if (conversation) setTitle(getConversationTitle(conversation));
  }, [conversation]);

  const submit = async (event) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!conversation || !nextTitle || saving) return;
    await onRename(conversation.id, nextTitle);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[28rem] gap-0 overflow-hidden p-0">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-tint-orange text-brand-orange">
                <AapmIcon name="solar:pen-new-square-bold" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-sm">Ubah judul chat</DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-5">
                  Beri nama singkat agar mudah ditemukan di riwayat.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-5 py-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-foreground" htmlFor="appi-conversation-title">
                Judul chat
              </label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{title.length}/180</span>
            </div>
            <Input
              id="appi-conversation-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={180}
              autoFocus
              className="h-10"
              placeholder="Judul percakapan"
            />
          </div>
          <DialogFooter className="border-t border-border/60 bg-surface-subtle/40 px-5 py-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || saving}
              className="bg-brand-orange text-white hover:bg-brand-orange/90"
            >
              {saving && <AapmIcon name="loading" className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
