function pageItems(page) {
  return Array.isArray(page?.items) ? page.items : [];
}

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

export function removeConversationFromPages(data, conversationId) {
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
