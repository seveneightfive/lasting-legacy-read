import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Heart, FileText, ChevronRight, FileEdit } from 'lucide-react';
import { TocNode, EditorState, stateKey } from '../../utils/editorState';

interface TableOfContentsProps {
  open: boolean;
  onClose: () => void;
  toc: TocNode[];
  currentState: EditorState;
  onNavigate: (state: EditorState) => void;
}

/**
 * Slide-out left drawer showing the full editable structure of the book.
 * Click any node to jump there. The current node is highlighted.
 */
export default function TableOfContents({
  open, onClose, toc, currentState, onNavigate,
}: TableOfContentsProps) {
  const currentKey = stateKey(currentState);

  const handleNav = (state: EditorState) => {
    onNavigate(state);
    // On mobile auto-close; on desktop leave open (the parent controls open state)
    if (window.innerWidth < 768) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/30 z-30"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed top-0 left-0 bottom-0 w-[300px] bg-white shadow-2xl z-40 flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-avenir text-slate-800 text-sm uppercase tracking-wider">
                Table of Contents
              </h2>
              <button
                onClick={onClose}
                className="p-1 text-slate-500 hover:text-slate-800 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tree */}
            <nav className="flex-1 overflow-y-auto p-3">
              {toc.map((node, i) => {
                if (node.kind === 'book-section') {
                  const isActive = stateKey(node.state) === currentKey;
                  const icon = node.label === 'Cover' ? BookOpen
                            : node.label === 'Dedication' ? Heart
                            : FileText;
                  const Icon = icon;
                  return (
                    <button
                      key={`sec-${i}`}
                      onClick={() => handleNav(node.state)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left
                        font-avenir text-sm transition-colors
                        ${isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <Icon size={14} />
                      {node.label}
                    </button>
                  );
                }

                // Chapter node
                const chapterActive = stateKey(node.state) === currentKey;
                return (
                  <div key={`ch-${node.chapter.id}`} className="mt-3">
                    <button
                      onClick={() => handleNav(node.state)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left
                        font-avenir text-sm font-medium transition-colors
                        ${chapterActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-800 hover:bg-slate-100'
                        }`}
                    >
                      <span className={`text-xs ${chapterActive ? 'text-slate-300' : 'text-slate-400'}`}>
                        {node.chapter.number}.
                      </span>
                      <span className="flex-1 truncate">{node.chapter.title}</span>
                    </button>

                    {node.pages.length > 0 && (
                      <ul className="mt-1 ml-3 border-l border-slate-200">
                        {node.pages.map((p) => {
                          const pageActive = stateKey(p.state) === currentKey;
                          return (
                            <li key={p.page.id}>
                              <button
                                onClick={() => handleNav(p.state)}
                                className={`w-full flex items-center gap-2 pl-3 pr-2 py-1.5 text-left
                                  text-xs font-lora transition-colors rounded-r-lg
                                  ${pageActive
                                    ? 'bg-amber-50 text-amber-900 border-l-2 -ml-px border-amber-500'
                                    : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                              >
                                <FileEdit size={11} className="text-slate-400 shrink-0" />
                                <span className="truncate flex-1">{p.label}</span>
                                {pageActive && <ChevronRight size={11} />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-slate-200">
              <p className="text-xs text-slate-400 font-avenir">
                Click any item to jump there. Changes save automatically.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
