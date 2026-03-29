import { useState, useCallback, useEffect } from 'react';
import { useDuckDB } from './useDuckDB';
import type { VerificationResult, DataState } from '../types/equivalence';

export function useEquivalence() {
  const duckdb = useDuckDB();
  const [dataState, setDataState] = useState<DataState | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // DuckDB初期化完了+TPC-H生成済みの場合、テーブル情報を自動取得
  useEffect(() => {
    if (!duckdb.ready || !duckdb.tpchLoaded) return;
    (async () => {
      const tables = ['nation', 'region', 'part', 'supplier', 'partsupp', 'customer', 'orders', 'lineitem'];
      const loadedTables: DataState['tables'] = [];
      let totalRows = 0;
      for (const table of tables) {
        try {
          const res = await duckdb.query(`SELECT COUNT(*) as cnt FROM ${table}`);
          const rowCount = Number(res.rows[0]?.cnt ?? 0);
          loadedTables.push({ name: table, rowCount });
          totalRows += rowCount;
        } catch {
          loadedTables.push({ name: table, rowCount: 0 });
        }
      }
      setDataState({
        loaded: loadedTables.some(t => t.rowCount > 0),
        tableCount: loadedTables.filter(t => t.rowCount > 0).length,
        totalRows,
        sizeBytes: 0,
        tables: loadedTables,
      });
    })();
  }, [duckdb.ready, duckdb.tpchLoaded, duckdb]);

  const verify = useCallback(async (originalSQL: string, wvletAsSQL: string) => {
    if (!duckdb.ready) return;
    setIsVerifying(true);
    setResult(null);

    const start = performance.now();
    try {
      const t1Start = performance.now();
      let test1RowCount = 0;
      let test1Error: string | undefined;
      try {
        const r1 = await duckdb.query(`
          SELECT * FROM (${originalSQL.replace(/;\s*$/, '')})
          EXCEPT
          SELECT * FROM (${wvletAsSQL.replace(/;\s*$/, '')})
          LIMIT 11
        `);
        test1RowCount = r1.rows.length;
      } catch (e) {
        test1Error = e instanceof Error ? e.message : String(e);
        test1RowCount = -1;
      }
      const t1Time = performance.now() - t1Start;

      const t2Start = performance.now();
      let test2RowCount = 0;
      let test2Error: string | undefined;
      try {
        const r2 = await duckdb.query(`
          SELECT * FROM (${wvletAsSQL.replace(/;\s*$/, '')})
          EXCEPT
          SELECT * FROM (${originalSQL.replace(/;\s*$/, '')})
          LIMIT 11
        `);
        test2RowCount = r2.rows.length;
      } catch (e) {
        test2Error = e instanceof Error ? e.message : String(e);
        test2RowCount = -1;
      }
      const t2Time = performance.now() - t2Start;

      let status: VerificationResult['status'];
      if (test1Error || test2Error) status = 'error';
      else if (test1RowCount === 0 && test2RowCount === 0) status = 'equivalent';
      else status = 'not-equivalent';

      const totalTimeMs = performance.now() - start;
      setResult({
        status,
        equivalent: status === 'equivalent',
        method: 'EXCEPT',
        executionTimeMs: Math.round(totalTimeMs),
        sqlRowCount: test1RowCount,
        wvletRowCount: test2RowCount,
        error: test1Error || test2Error || undefined,
        test1: { name: 'SQL EXCEPT Wvlet', query: '', rowCount: test1RowCount, timeMs: t1Time, error: test1Error },
        test2: { name: 'Wvlet EXCEPT SQL', query: '', rowCount: test2RowCount, timeMs: t2Time, error: test2Error },
        totalTimeMs,
      });
    } catch (e) {
      const totalTimeMs = performance.now() - start;
      setResult({
        status: 'error',
        equivalent: false,
        method: 'EXCEPT',
        executionTimeMs: Math.round(totalTimeMs),
        error: String(e),
        test1: { name: 'SQL EXCEPT Wvlet', query: '', rowCount: -1, timeMs: 0, error: String(e) },
        test2: { name: 'Wvlet EXCEPT SQL', query: '', rowCount: -1, timeMs: 0, error: String(e) },
        totalTimeMs,
      });
    } finally {
      setIsVerifying(false);
    }
  }, [duckdb, dataState]);

  return {
    dataState,
    result,
    isVerifying,
    verify,
    isDBReady: duckdb.ready,
  };
}
