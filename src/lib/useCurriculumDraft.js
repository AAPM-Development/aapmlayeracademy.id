import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Refetching never replaces an open editing buffer. Reload is an explicit user action.
export function useCurriculumDraft(queryKey, load) {
  const query = useQuery({ queryKey, queryFn: load, refetchOnWindowFocus: false });
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const accept = (value) => { setDraft(value); setBaseline(JSON.stringify(value)); setError(null); };
  useEffect(() => { if (query.data && draft === null) accept(query.data); }, [query.data, draft]);
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  useEffect(() => {
    if (!dirty) return;
    const guard = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const run = async (operation) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try { return await operation(); }
    catch (failure) { setError(failure); return null; }
    finally { inFlight.current = false; setBusy(false); }
  };
  const reload = () => run(async () => { const value = await load(); accept(value); return value; });
  return { query, draft, setDraft, accept, dirty, error, busy, run, reload };
}
