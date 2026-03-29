import { useEffect, useRef, useState, useCallback } from 'react';

export interface DuckDBHandle {
  ready: boolean;
  tpchLoaded: boolean;
  query: (sql: string) => Promise<{ rows: Record<string, unknown>[]; columns: string[] }>;
  checkEquivalence: (sqlA: string, sqlB: string) => Promise<{
    equivalent: boolean;
    diffABCount: number;
    diffBACount: number;
  }>;
  loadData: (tableSQL: string) => Promise<void>;
}

export function useDuckDB(): DuckDBHandle {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [tpchLoaded, setTpchLoaded] = useState(false);
  const pendingRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map());

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/duckdb.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'init:done') {
        setReady(true);
        setTpchLoaded(!!data.tpchLoaded);
        return;
      }
      if (data.type === 'loadData:done') return;
      const pending = pendingRef.current.get(data.id);
      if (!pending) return;
      pendingRef.current.delete(data.id);
      if (data.type.endsWith(':error')) {
        pending.reject(new Error(data.message));
      } else {
        pending.resolve(data);
      }
    };

    worker.postMessage({ type: 'init' });

    return () => { worker.terminate(); };
  }, []);

  const sendAndWait = useCallback((msg: Record<string, unknown>): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      pendingRef.current.set(id, { resolve, reject });
      workerRef.current?.postMessage({ ...msg, id });
    });
  }, []);

  return {
    ready,
    tpchLoaded,
    query: useCallback(async (sql: string) => {
      const res = await sendAndWait({ type: 'query', sql }) as { rows: Record<string, unknown>[]; columns: string[] };
      return { rows: res.rows, columns: res.columns };
    }, [sendAndWait]),
    checkEquivalence: useCallback(async (sqlA: string, sqlB: string) => {
      const res = await sendAndWait({ type: 'equivalenceCheck', sqlA, sqlB }) as {
        equivalent: boolean; diffABCount: number; diffBACount: number;
      };
      return { equivalent: res.equivalent, diffABCount: res.diffABCount, diffBACount: res.diffBACount };
    }, [sendAndWait]),
    loadData: useCallback(async (tableSQL: string) => {
      return new Promise<void>((resolve) => {
        workerRef.current?.postMessage({ type: 'loadData', tableSQL });
        const handler = (event: MessageEvent) => {
          if (event.data.type === 'loadData:done') {
            workerRef.current?.removeEventListener('message', handler);
            resolve();
          }
        };
        workerRef.current?.addEventListener('message', handler);
      });
    }, []),
  };
}
