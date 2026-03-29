import type { TransformResult } from './index';

/**
 * wvlet-lang の Scala.js ビルドを WebWorker で実行する。
 */
export class WvletWorkerClient {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();

  async initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.worker = new Worker(
          new URL('../../workers/wvlet.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.worker.onmessage = (e) => {
          if (e.data.type === 'ready') {
            resolve(true);
          } else if (e.data.type === 'result') {
            const pending = this.pendingRequests.get(e.data.id);
            if (pending) {
              pending.resolve(e.data.result);
              this.pendingRequests.delete(e.data.id);
            }
          } else if (e.data.type === 'error') {
            const pending = this.pendingRequests.get(e.data.id);
            if (pending) {
              pending.reject(new Error(e.data.error));
              this.pendingRequests.delete(e.data.id);
            }
          }
        };
        setTimeout(() => resolve(false), 5000);
      } catch {
        resolve(false);
      }
    });
  }

  async compile(sql: string): Promise<TransformResult> {
    if (!this.worker) throw new Error('Worker not initialized');
    const id = ++this.messageId;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker!.postMessage({ type: 'compile', id, sql });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
