import { useState, useCallback, useMemo } from 'react';

interface Props {
  onSearch: (term: string) => void;
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function QuerySearch({ onSearch }: Props) {
  const [value, setValue] = useState('');

  const debouncedSearch = useMemo(
    () => debounce((term: string) => onSearch(term), 300),
    [onSearch]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    debouncedSearch(v);
  }, [debouncedSearch]);

  return (
    <div className="query-search">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search queries..."
        aria-label="Search queries"
      />
    </div>
  );
}
