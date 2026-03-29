// DuckDB-Wasm WebWorker
// Handles initialization, queries, and equivalence checks

import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

type WorkerMessage =
  | { type: 'init' }
  | { type: 'loadData'; tableSQL: string }
  | { type: 'query'; sql: string; id: string }
  | { type: 'equivalenceCheck'; sqlA: string; sqlB: string; id: string };

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init': {
      try {
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        const worker_url = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
        );
        const logger = new duckdb.VoidLogger();
        db = new duckdb.AsyncDuckDB(logger, new Worker(worker_url));
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        conn = await db.connect();
        // TPC-H SF=0.01 データを自動生成
        try {
          await conn.query("INSTALL tpch");
          await conn.query("LOAD tpch");
          await conn.query("CALL dbgen(sf=0.01)");
          self.postMessage({ type: 'init:done', tpchLoaded: true });
        } catch {
          // TPC-H 拡張が利用できない場合はデータなしで続行
          self.postMessage({ type: 'init:done', tpchLoaded: false });
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        self.postMessage({ type: 'error', message });
      }
      break;
    }

    case 'loadData': {
      if (!conn) { self.postMessage({ type: 'error', message: 'not initialized' }); return; }
      try {
        await conn.query(msg.tableSQL);
        self.postMessage({ type: 'loadData:done' });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        self.postMessage({ type: 'error', message });
      }
      break;
    }

    case 'query': {
      if (!conn) { self.postMessage({ type: 'query:error', id: msg.id, message: 'not initialized' }); return; }
      try {
        const result = await conn.query(msg.sql);
        const rows = result.toArray().map((row: Record<string, unknown>) => ({ ...row }));
        const columns = result.schema.fields.map((f: { name: string }) => f.name);
        self.postMessage({ type: 'query:result', id: msg.id, rows, columns });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        self.postMessage({ type: 'query:error', id: msg.id, message });
      }
      break;
    }

    case 'equivalenceCheck': {
      if (!conn) { self.postMessage({ type: 'equivalenceCheck:error', id: msg.id, message: 'not initialized' }); return; }
      try {
        const diffAB = await conn.query(`(${msg.sqlA}) EXCEPT (${msg.sqlB})`);
        const diffBA = await conn.query(`(${msg.sqlB}) EXCEPT (${msg.sqlA})`);
        const equivalent = diffAB.numRows === 0 && diffBA.numRows === 0;
        self.postMessage({
          type: 'equivalenceCheck:result',
          id: msg.id,
          equivalent,
          diffABCount: diffAB.numRows,
          diffBACount: diffBA.numRows,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        self.postMessage({ type: 'equivalenceCheck:error', id: msg.id, message });
      }
      break;
    }
  }
};
