import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const KEYWORDS = new Set([
  'from', 'where', 'select', 'join', 'group', 'order', 'by',
  'limit', 'offset', 'having', 'on', 'as', 'in', 'not', 'and',
  'or', 'is', 'null', 'true', 'false', 'if', 'then', 'else',
  'end', 'case', 'when', 'with', 'asc', 'desc', 'like', 'between',
  'exists', 'distinct', 'union', 'all', 'except', 'intersect',
  'inner', 'left', 'right', 'outer', 'cross', 'full',
  'model', 'def', 'type', 'val', 'test', 'show', 'debug', 'run',
  'import', 'export', 'package',
]);

const FUNCTIONS = new Set([
  'concat', 'count', 'sum', 'avg', 'min', 'max', 'coalesce', 'cast',
  'extract', 'date_trunc', 'substring', 'length', 'upper', 'lower',
  'trim', 'replace', 'split', 'array', 'map',
]);

const wvletLanguage = StreamLanguage.define({
  token(stream) {
    // Whitespace
    if (stream.eatSpace()) return null;
    // Line comments
    if (stream.match(/--.*$/)) return 'comment';
    if (stream.match(/#.*$/)) return 'comment';
    // Strings
    if (stream.match(/"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/'(?:[^'\\]|\\.)*'/)) return 'string';
    // Numbers
    if (stream.match(/\d+(\.\d+)?/)) return 'number';
    // Identifiers & keywords: consume the whole word first, then classify
    if (stream.match(/[a-zA-Z_]\w*/)) {
      const word = stream.current().toLowerCase();
      if (KEYWORDS.has(word)) return 'keyword';
      if (FUNCTIONS.has(word)) return 'variableName.function';
      return null;
    }
    // Operators
    if (stream.match(/[+\-*/<>=!&|^~]+/)) return 'operator';
    // Punctuation
    if (stream.match(/[{}()\[\],;.:]/)) return 'punctuation';
    stream.next();
    return null;
  },
});

export const wvletExtensions = [
  wvletLanguage,
  syntaxHighlighting(HighlightStyle.define([
    { tag: tags.keyword, color: '#c586c0', fontWeight: 'bold' },
    { tag: tags.string, color: '#ce9178' },
    { tag: tags.number, color: '#b5cea8' },
    { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
    { tag: tags.function(tags.name), color: '#dcdcaa' },
    { tag: tags.operator, color: '#d4d4d4' },
  ])),
];
