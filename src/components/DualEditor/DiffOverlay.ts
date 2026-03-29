import { EditorView, Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

/**
 * 変更行をハイライトするデコレーション
 * addedLines: 追加された行番号 (1-indexed)
 * removedLines: 削除された行番号 (1-indexed)
 */
interface DiffSpec {
  addedLines: Set<number>;
  removedLines: Set<number>;
}

const addedLineDeco = Decoration.line({ class: 'cm-diff-added' });
const removedLineDeco = Decoration.line({ class: 'cm-diff-removed' });

function buildDecorations(view: EditorView, diff: DiffSpec): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 1; i <= view.state.doc.lines; i++) {
    const line = view.state.doc.line(i);
    if (diff.addedLines.has(i)) {
      builder.add(line.from, line.from, addedLineDeco);
    }
    if (diff.removedLines.has(i)) {
      builder.add(line.from, line.from, removedLineDeco);
    }
  }
  return builder.finish();
}

/** DiffOverlayプラグインを作成 */
export function createDiffPlugin(getDiff: () => DiffSpec) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, getDiff());
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, getDiff());
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}

/** Diff用CSSテーマ */
export const diffTheme = EditorView.baseTheme({
  '.cm-diff-added': {
    backgroundColor: 'var(--bg-accent-subtle)',
    borderLeft: '3px solid var(--accent-primary)',
  },
  '.cm-diff-removed': {
    backgroundColor: 'var(--bg-danger-subtle)',
    borderLeft: '3px solid var(--accent-danger)',
    textDecoration: 'line-through',
    opacity: '0.6',
  },
});
