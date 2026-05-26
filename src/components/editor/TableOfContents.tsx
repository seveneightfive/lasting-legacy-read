import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Heart, FileText, ChevronRight, FileEdit, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TocNode, EditorState, stateKey } from '../../utils/editorState';

interface TableOfContentsProps {
  open: boolean;
  onClose: () => void;
  toc: TocNode[];
  currentState: EditorState;
  onNavigate: (state: EditorState) => void;
  onDeletePage: (pageId: number, chapterId: number) => void | Promise<void>;
  onReorderPages: (chapterId: number, fromIndex: number, toIndex: number) => void | Promise<void>;
}

/**
 * Slide-out left drawer showing the full editable structure of the book.
 * Page rows support drag-to-reorder (within their chapter) and per-row delete.
 */
export default function TableOfContents({
  open, onClose, toc, currentState, onNavigate,
  onDeletePage, onReorderPages,
}: TableOfContentsProps) {
  const currentKey = stateKey(currentState);

  const handleNav = (state: EditorState) => {
    onNavigate(state);
    if (window.innerWidth < 768) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/30 z-30"
          />

          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed top-0 left-0 bottom-0 w-[300px] bg-white shadow-2xl z-40 flex flex-col"
          >
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

            <nav className="flex-1 overflow-y-auto p-3">
              {toc.map((node, i) => {
                if (node.kind === 'book-section') {
                  const isActive = stateKey(node.state) === currentKey;
                  const Icon = node.label === 'Cover' ? BookOpen
                            : node.label === 'Dedication' ? Heart
                            : FileText;
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
                      <SortablePageList
                        chapterId={node.chapter.id}
                        pages={node.pages}
                        currentKey={currentKey}
                        onNavigate={handleNav}
                        onDeletePage={onDeletePage}
                        onReorderPages={onReorderPages}
                      />
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="px-5 py-3 border-t border-slate-200">
              <p className="text-xs text-slate-400 font-avenir">
                Drag <GripVertical size={11} className="inline -mt-0.5" /> to reorder. Click <Trash2 size={11} className="inline -mt-0.5" /> to delete.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Sortable page list (one per chapter) ──────────────────────────
interface SortablePageListProps {
  chapterId: number;
  pages: TocNode extends { kind: 'chapter' } ? TocNode['pages'] : never;
  currentKey: string;
  onNavigate: (state: EditorState) => void;
  onDeletePage: (pageId: number, chapterId: number) => void | Promise<void>;
  onReorderPages: (chapterId: number, fromIndex: number, toIndex: number) => void | Promise<void>;
}

function SortablePageList({
  chapterId, pages, currentKey, onNavigate, onDeletePage, onReorderPages,
}: SortablePageListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = pages.map((p) => p.page.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void onReorderPages(chapterId, oldIndex, newIndex);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="mt-1 ml-3 border-l border-slate-200">
          {pages.map((p) => (
            <SortablePageRow
              key={p.page.id}
              page={p}
              chapterId={chapterId}
              isActive={stateKey(p.state) === currentKey}
              onNavigate={onNavigate}
              onDeletePage={onDeletePage}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// ── A single draggable + deletable page row ───────────────────────
interface SortablePageRowProps {
  page: SortablePageListProps['pages'][number];
  chapterId: number;
  isActive: boolean;
  onNavigate: (state: EditorState) => void;
  onDeletePage: (pageId: number, chapterId: number) => void | Promise<void>;
}

function SortablePageRow({
  page, chapterId, isActive, onNavigate, onDeletePage,
}: SortablePageRowProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: page.page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center pr-1 rounded-r-lg
        ${isActive ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>

      {/* Click-to-navigate label */}
      <button
        onClick={() => onNavigate(page.state)}
        className={`flex-1 flex items-center gap-2 pl-1 pr-2 py-1.5 text-left
          text-xs font-lora transition-colors
          ${isActive
            ? 'text-amber-900 border-l-2 -ml-px border-amber-500'
            : 'text-slate-600'
          }`}
      >
        <FileEdit size={11} className="text-slate-400 shrink-0" />
        <span className="truncate flex-1">{page.label}</span>
        {isActive && <ChevronRight size={11} />}
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void onDeletePage(page.page.id, chapterId);
        }}
        className="p-1 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        aria-label="Delete page"
        title="Delete page"
      >
        <Trash2 size={12} />
      </button>
    </li>
  );
}