import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const sqlExtensions = [
  sql({ dialect: PostgreSQL }),
  syntaxHighlighting(HighlightStyle.define([
    { tag: tags.keyword, color: '#569cd6', fontWeight: 'bold' },
    { tag: tags.string, color: '#ce9178' },
    { tag: tags.number, color: '#b5cea8' },
    { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
    { tag: tags.operator, color: '#d4d4d4' },
    { tag: tags.function(tags.name), color: '#dcdcaa' },
  ])),
];
