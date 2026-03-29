import { useEffect, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { sqlExtensions } from './extensions/sqlHighlight';
import { wvletExtensions } from './extensions/wvletHighlight';
import { readonlyExtension } from './extensions/readonlyView';

interface Props {
  code: string;
  language: 'sql' | 'wvlet';
  readOnly?: boolean;
  onChange?: (code: string) => void;
  onScroll?: (scrollInfo: { top: number; height: number }) => void;
  scrollRef?: React.MutableRefObject<EditorView | null>;
}

export function CodePane({
  code,
  language,
  readOnly = true,
  onChange,
  onScroll,
  scrollRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const langExt = language === 'sql' ? sqlExtensions : wvletExtensions;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      oneDark,
      ...langExt,
      ...(readOnly ? [readonlyExtension] : []),
      ...(onChange ? [EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      })] : []),
      ...(onScroll ? [EditorView.domEventHandlers({
        scroll(_event: Event, view: EditorView) {
          onScroll({
            top: view.scrollDOM.scrollTop,
            height: view.scrollDOM.scrollHeight,
          });
        },
      })] : []),
    ];

    const state = EditorState.create({ doc: code, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    if (scrollRef) scrollRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  // コードの外部更新
  useEffect(() => {
    if (viewRef.current) {
      const currentDoc = viewRef.current.state.doc.toString();
      if (currentDoc !== code) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentDoc.length,
            insert: code,
          },
        });
      }
    }
  }, [code]);

  return (
    <div ref={containerRef} className="code-pane" />
  );
}
