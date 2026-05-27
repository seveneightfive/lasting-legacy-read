import React, { useState } from 'react';
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
  DragStartEvent,
  DragOverlay,
  useDroppable,
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
  /**
   * Move a page to a different chapter. `toIndex` is the destination index
   * within the target chapter. If omitted, append to the end.
   */
  onMovePageToChapter: (
    pageId: number,
    fromChapterId: number,
    toChapterId: number,
    toIndex: number,
  ) => void | Promise<void>;
}

type ChapterNode = Extract<TocNode, { kind: 'chapter' }>;
type PageNode = ChapterNode['pages'][number];

/**
 * Slide-out left drawer showing the full editable structure of the book.
 * Page rows support drag-to-reorder within a chapter AND drag-across-chapters.
 */
export default function TableOfContents({
  open, onClose, toc, currentState, onNavigate,
  onDeletePage, onReorderPages, onMovePageToChapter,
}: TableOfContentsProps) {
  const currentKey = stateKey(currentState);

  // We need a flat lookup so we can resolve a dragged page id → its chapter & index
  const chapters = toc.filter((n): n is ChapterNode => n.kind === 'chapter');

  const findPageLocation = (pageId: number) => {
    for (const ch of chapters) {
      const idx = ch.pages.findIndex((p) => p.page.id === pageId);
      if (idx !== -1) return { chapter: ch, index: idx, page: ch.pages[idx] };
    }
    return null;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeId, setActiveId] = useState<number | null>(null);
  const activeLocation = activeId != null ? findPageLocation(activeId) : null;

  const handleNav = (state: EditorState) => {
    onNavigate(state);
    if (window.innerWidth < 768) onClose();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activePageId = Number(active.id);
    const from = findPageLocation(activePageId);
    if (!from) return;

    // The `over` target can be either another page (id = page id) or
    // a chapter drop zone (id = `chapter-${chapterId}`).
    const overId = String(over.id);

    let toChapter: ChapterNode | undefined;
    let toIndex: number;

    if (overId.startsWith('chapter-')) {
      const targetChapterId = Number(overId.slice('chapter-'.length));
      toChapter = chapters.find((c) => c.chapter.id === targetChapterId);
      if (!toChapter) return;
      // Append to the end of the target chapter (or stay put if same chapter & last)
      toIndex = toChapter.pages.length;
    } else {
      const overPageId = Number(overId);
      const overLoc = findPageLocation(overPageId);
      if (!overLoc) return;
      toChapter = overLoc.chapter;
      toIndex = overLoc.index;
    }

    const sameChapter = from.chapter.chapter.id === toChapter.chapter.id;

    if (sameChapter) {
      if (from.index === toIndex) return;
      void onReorderPages(from.chapter.chapter.id, from.index, toIndex);
    } else {
      // Cross-chapter move. If we dropped on a page, place at that page's index;
      // dnd-kit semantics: inserting at `toIndex` pushes the existing row down.
      void onMovePageToChapter(
        activePageId,
        from.chapter.chapter.id,
        toChapter.chapter.id,
        toIndex,
      );
    }
  };

  const handleDragCancel = () => setActiveId(null);

  // Flat list of all page ids across all chapters — required so cross-chapter
  // drag works as a single sortable space.
  const allPageIds = chapters.flatMap((c) => c.pages.map((p) => p.page.id));

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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext items={allPageIds} strategy={verticalListSortingStrategy}>
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
                      <ChapterBlock
                        key={`ch-${node.chapter.id}`}
                        node={node}
                        chapterActive={chapterActive}
                        currentKey={currentKey}
                        onNavigate={handleNav}
                        onDeletePage={onDeletePage}
                        isDraggingAcross={activeLocation != null && activeLocation.chapter.chapter.id !== node.chapter.id}
                      />
                    );
                  })}
                </SortableContext>

                <DragOverlay>
                  {activeLocation ? (
                    <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-r-lg bg-white shadow-lg border border-slate-200 text-xs font-lora text-slate-700">
                      <GripVertical size={12} className="text-slate-400" />
                      <FileEdit size={11} className="text-slate-400" />
                      <span className="truncate max-w-[200px]">{activeLocation.page.label}</span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </nav>

            <div className="px-5 py-3 border-t border-slate-200">
              <p className="text-xs text-slate-400 font-avenir">
                Drag <GripVertical size={11} className="inline -mt-0.5" /> to reorder or move between chapters. Click <Trash2 size={11} className="inline -mt-0.5" /> to delete.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── A chapter row + its (droppable) page list ─────────────────────
interface ChapterBlockProps {
  node: ChapterNode;
  chapterActive: boolean;
  currentKey: string;
  onNavigate: (state: EditorState) => void;
  onDeletePage: (pageId: number, chapterId: number) => void | Promise<void>;
  isDraggingAcross: boolean;
}

function ChapterBlock({
  node, chapterActive, currentKey, onNavigate, onDeletePage, isDraggingAcross,
}: ChapterBlockProps) {
  // Make the chapter itself a droppable zone so empty chapters (or the
  // gap below the last page) can receive a page.
  const { setNodeRef, isOver } = useDroppable({ id: `chapter-${node.chapter.id}` });

  return (
    <div className="mt-3">
      <button
        onClick={() => onNavigate(node.state)}
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

      <div
        ref={setNodeRef}
        className={`mt-1 ml-3 border-l rounded-r-md transition-colors
          ${isOver && isDraggingAcross
            ? 'border-amber-400 bg-amber-50/40'
            : 'border-slate-200'}
          ${node.pages.length === 0 && isDraggingAcross ? 'min-h-[28px]' : ''}
        `}
      >
        {node.pages.length === 0 ? (
          isDraggingAcross ? (
            <p className="text-[11px] font-avenir text-slate-400 px-3 py-1.5 italic">
              Drop here to add to this chapter
            </p>
          ) : null
        ) : (
          <ul>
            {node.pages.map((p) => (
              <SortablePageRow
                key={p.page.id}
                page={p}
                chapterId={node.chapter.id}
                isActive={stateKey(p.state) === currentKey}
                onNavigate={onNavigate}
                onDeletePage={onDeletePage}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── A single draggable + deletable page row ───────────────────────
interface SortablePageRowProps {
  page: PageNode;
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
    opacity: isDragging ? 0.4 : 1,
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
        aria-label="Drag to reorder or move between chapters"
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
