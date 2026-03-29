import { useState, useEffect, useCallback } from 'react';

export interface CatalogQuery {
  id: string;
  name: string;
  category: string;
  sql: string;
  wvlet?: string;
  description?: string;
  complexity?: string;
}

interface CatalogData {
  queries: CatalogQuery[];
}

export function useCatalog() {
  const [queries, setQueries] = useState<CatalogQuery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/catalog.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/job_catalog.json`).then(r => r.json()),
    ])
      .then(([catalogData, jobData]) => {
        const main: CatalogQuery[] = catalogData.queries ?? catalogData;
        const job: CatalogQuery[] = jobData.queries ?? jobData;
        setQueries([...main, ...job]);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load catalog:', err);
        setLoading(false);
      });
  }, []);

  const categories = [...new Set(queries.map(q => q.category))];

  const getByCategory = useCallback((cat: string): CatalogQuery[] =>
    queries.filter(q => q.category === cat),
  [queries]);

  const search = useCallback((term: string): CatalogQuery[] => {
    if (!term.trim()) return queries;
    const lower = term.toLowerCase();
    return queries.filter(q =>
      q.name.toLowerCase().includes(lower) ||
      q.sql.toLowerCase().includes(lower) ||
      (q.description ?? '').toLowerCase().includes(lower)
    );
  }, [queries]);

  const counts = categories.reduce((acc, cat) => {
    acc[cat] = queries.filter(q => q.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  return { queries, loading, categories, getByCategory, search, counts };
}
