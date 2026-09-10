function pageItems(page) {
  return Array.isArray(page?.items) ? page.items : [];
}

export function isConversationArchived(conversation) {
  return Boolean(
    conversation?.archivedAt ||
      conversation?.archived_at ||
      conversation?.archived === true,
  );
}

const archived = isConversationArchived;

export function flattenConversationPages(data) {
  const seen = new Set();
  return (data?.pages ?? [])
    .flatMap((page) => pageItems(page))
    .filter((conversation) => {
      if (!conversation?.id || seen.has(conversation.id)) return false;
      seen.add(conversation.id);
      return true;
    });
}

export function upsertConversationInPages(data, conversation) {
  if (!data?.pages?.length || !conversation?.id) return data;
  let existed = false;
  let previousConversation = null;
  const pages = data.pages.map((page) => ({
    ...page,
    items: pageItems(page).filter((item) => {
      if (String(item.id) !== String(conversation.id)) return true;
      existed = true;
      previousConversation = item;
      return false;
    }),
  }));
  const firstPage = pages[0];
  const total = Math.max(
    0,
    Number(firstPage.total ?? flattenConversationPages(data).length) +
      (existed ? 0 : 1),
  );
  const currentArchived = archived(conversation);
  const previousArchived = previousConversation ? archived(previousConversation) : null;
  const loadedItems = flattenConversationPages(data);
  const baseActive = Number(firstPage.activeTotal ?? loadedItems.filter((item) => !archived(item)).length);
  const baseArchived = Number(firstPage.archivedTotal ?? loadedItems.filter((item) => archived(item)).length);
  const activeDelta = !existed
    ? (currentArchived ? 0 : 1)
    : previousArchived === currentArchived
      ? 0
      : currentArchived
        ? -1
        : 1;
  const archivedDelta = !existed
    ? (currentArchived ? 1 : 0)
    : previousArchived === currentArchived
      ? 0
      : currentArchived
        ? 1
        : -1;

  pages[0] = {
    ...firstPage,
    total,
    activeTotal: Math.max(0, baseActive + activeDelta),
    archivedTotal: Math.max(0, baseArchived + archivedDelta),
    items: [conversation, ...pageItems(firstPage)],
  };
  return { ...data, pages };
}

export function removeConversationFromPages(data, conversationId) {
  if (!data?.pages?.length) return data;
  let removed = false;
  const pages = data.pages.map((page) => ({
    ...page,
    items: pageItems(page).filter((item) => {
      if (String(item.id) !== String(conversationId)) return true;
      removed = true;
      return false;
    }),
  }));
  if (removed && pages[0]) {
    const removedConversation = flattenConversationPages(data).find(
      (item) => String(item.id) === String(conversationId),
    );
    const wasArchived = archived(removedConversation);
    const firstPage = pages[0];
    const loadedItems = flattenConversationPages(data);
    const baseActive = Number(firstPage.activeTotal ?? loadedItems.filter((item) => !archived(item)).length);
    const baseArchived = Number(firstPage.archivedTotal ?? loadedItems.filter((item) => archived(item)).length);
    pages[0] = {
      ...pages[0],
      total: Math.max(0, Number(pages[0].total ?? 0) - 1),
      activeTotal: Math.max(0, baseActive - (wasArchived ? 0 : 1)),
      archivedTotal: Math.max(0, baseArchived - (wasArchived ? 1 : 0)),
    };
  }
  return { ...data, pages };
}
