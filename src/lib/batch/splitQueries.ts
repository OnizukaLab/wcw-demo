/**
 * セミコロン区切りで複数SQLクエリを分割する。
 * コメント内・文字列リテラル内のセミコロンは無視する。
 */
export function splitQueries(raw: string): string[] {
  const queries: string[] = [];
  let current = '';
  let i = 0;

  while (i < raw.length) {
    // 行コメント --
    if (raw[i] === '-' && raw[i + 1] === '-') {
      while (i < raw.length && raw[i] !== '\n') {
        current += raw[i];
        i++;
      }
      continue;
    }

    // ブロックコメント /* */
    if (raw[i] === '/' && raw[i + 1] === '*') {
      current += raw[i++];
      current += raw[i++];
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) {
        current += raw[i++];
      }
      if (i < raw.length) {
        current += raw[i++]; // *
        current += raw[i++]; // /
      }
      continue;
    }

    // 文字列リテラル '...'
    if (raw[i] === "'") {
      current += raw[i++];
      while (i < raw.length && raw[i] !== "'") {
        if (raw[i] === '\\') {
          current += raw[i++];
        }
        if (i < raw.length) {
          current += raw[i++];
        }
      }
      if (i < raw.length) current += raw[i++]; // closing '
      continue;
    }

    // セミコロン → クエリ区切り
    if (raw[i] === ';') {
      const trimmed = current.trim();
      if (trimmed) queries.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += raw[i];
    i++;
  }

  const trimmed = current.trim();
  if (trimmed) queries.push(trimmed);

  return queries;
}
