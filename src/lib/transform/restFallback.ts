import type { TransformResult } from './index';

const WVLET_API_BASE = import.meta.env.VITE_WVLET_API_URL ?? 'https://api.wvlet.org';

/**
 * ローカルまたはリモートの wvlet-lang サーバーに REST で問い合わせる。
 */
export async function compileViaREST(sql: string): Promise<TransformResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const resp = await fetch(`${WVLET_API_BASE}/api/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
      signal: controller.signal,
    });

    if (!resp.ok) throw new Error(`REST API error: ${resp.status}`);

    const data = await resp.json();
    return mapRESTResponse(data);
  } finally {
    clearTimeout(timeout);
  }
}

function mapRESTResponse(data: Record<string, unknown>): TransformResult {
  const stages = data.stages as Array<Record<string, unknown>>;
  return {
    stages: stages.map((s, i: number) => ({
      id: i,
      name: s.name as string,
      code: s.code as string,
      language: (i === 0 ? 'sql' : 'wvlet') as 'sql' | 'wvlet',
      metrics: s.metrics as TransformResult['stages'][0]['metrics'],
      logicalPlan: s.plan as TransformResult['stages'][0]['logicalPlan'],
    })),
    success: true,
    transformMethod: 'rest',
  };
}
