import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Heart, FileText, ChevronRight, FileEdit, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  UniqueIdentifier,
  useDroppable,
} from '@dnd-kit/core';
import {
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
  onMovePageToChapter: (
    pageId: number,
    fromChapterId: number,
    toChapterId: number,
    toIndex: number,
  ) => void | Promise<void>;
}

type ChapterNode = Extract<TocNode, { kind: 'chapter' }>;
type PageNode = ChapterNode['pages'][number];

const CHAPTER_DROP_PREFIX = 'chapter-';
const chapterDropId = (id: number) => `${CHAPTER_DROP_PREFIX}${id}`;
const isChapterDropId = (id: UniqueIdentifier) => String(id).startsWith(CHAPTER_DROP_PREFIX);
const parseChapterDropId = (id: UniqueIdentifier) => Number(String(id).slice(CHAPTER_DROP_PREFIX.length));

export default function TableOfContents({
  open, onClose, toc, currentState, onNavigate,
  onDeletePage, onReorderPages, onMovePageToChapter,
}: TableOfContentsProps) {
  const currentKey = stateKey(currentState);
  const chapters = useMemo(
    () => toc.filter((n): n is ChapterNode => n.kind === 'chapter'),
    [toc],
  );

  const pageChapterMap = useMemo(() => {
    const m = new Map<number, number>();
    chapters.forEach((ch) => ch.pages.forEach((p) => m.set(p.page.id, ch.chapter.id)));
    return m;
  }, [chapters]);

  const findChapter = (chapterId: number) =>
    chapters.find((c) => c.chapter.id === chapterId);

  const findPageLocation = (pageId: number) => {
    const chapterId = pageChapterMap.get(pageId);
    if (chapterId == null) return null;
    const chapter = findChapter(chapterId);
    if (!chapter) return null;
    const index = chapter.pages.findIndex((p) => p.page.id === pageId);
    if (index < 0) return null;
    return { chapter, index, page: chapter.pages[index] };
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeId, setActiveId] = useState<number | null>(null);
  const [overChapterId, setOverChapterId] = useState<number | null>(null);

  const activeLocation = activeId != null ? findPageLocation(activeId) : null;

  const handleNav = (state: EditorState) => {
    onNavigate(state);
    if (window.innerWidth < 768) onClose();
  };

  // Pointer-first collision detection — required for reliable cross-chapter
  // detection. closestCenter tends to snap back to the source list's pages.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) return pointerHits;
    return rectIntersection(args);
  };

  const resolveOverChapterId = (overId: UniqueIdentifier | null | undefined): number | null => {
    if (overId == null) return null;
    if (isChapterDropId(overId)) return parseChapterDropId(overId);
    const chId = pageChapterMap.get(Number(overId));
    return chId ?? null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverChapterId(resolveOverChapterId(event.over?.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverChapterId(null);
    if (!over) return;

    const activePageId = Number(active.id);
    const from = findPageLocation(activePageId);
    if (!from) return;

    let toChapter: ChapterNode | undefined;
    let toIndex: number;

    if (isChapterDropId(over.id)) {
      const targetChapterId = parseChapterDropId(over.id);
      toChapter = findChapter(targetChapterId);
      if (!toChapter) return;
      // Dropped on the chapter container itself → append to end
      // (excluding the dragged page if it was already in this chapter).
      toIndex = toChapter.pages.filter((p) => p.page.id !== activePageId).length;
    } else {
      const overPageId = Number(over.id);
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
      void onMovePageToChapter(
        activePageId,
        from.chapter.chapter.id,
        toChapter.chapter.id,
        toIndex,
      );
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverChapterId(null);
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
              <DndContext
                sensors={sensors}
                collisionDetection={collisionDetection}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
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
                  const isDraggingPage = activeLocation != null;
                  const isOtherChapter = isDraggingPage
                    && activeLocation!.chapter.chapter.id !== node.chapter.id;

                  return (
                    <ChapterBlock
                      key={`ch-${node.chapter.id}`}
                      node={node}
                      chapterActive={chapterActive}
                      currentKey={currentKey}
                      onNavigate={handleNav}
                      onDeletePage={onDeletePage}
                      highlightAsTarget={isOtherChapter && overChapterId === node.chapter.id}
                      showEmptyHint={isOtherChapter}
                    />
                  );
                })}

                <DragOverlay>
                  {activeLocation ? (
                    <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md bg-white shadow-lg border border-slate-200 text-xs font-lora text-slate-700">
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

// ── Chapter block: header + droppable list with its own SortableContext ─────
interface ChapterBlockProps {
  node: ChapterNode;
  chapterActive: boolean;
  currentKey: string;
  onNavigate: (state: EditorState) => void;
  onDeletePage: (pageId: number, chapterId: number) => void | Promise<void>;
  highlightAsTarget: boolean;
  showEmptyHint: boolean;
}

function ChapterBlock({
  node, chapterActive, currentKey, onNavigate, onDeletePage,
  highlightAsTarget, showEmptyHint,
}: ChapterBlockProps) {
  const pageIds = useMemo(() => node.pages.map((p) => p.page.id), [node.pages]);

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

      <SortableContext
        id={chapterDropId(node.chapter.id)}
        items={pageIds}
        strategy={verticalListSortingStrategy}
      >
        <DroppableChapterArea
          chapterId={node.chapter.id}
          highlight={highlightAsTarget}
          isEmpty={node.pages.length === 0}
          showEmptyHint={showEmptyHint}
        >
          {node.pages.length > 0 && (
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
        </DroppableChapterArea>
      </SortableContext>
    </div>
  );
}

interface DroppableChapterAreaProps {
  chapterId: number;
  highlight: boolean;
  isEmpty: boolean;
  showEmptyHint: boolean;
  children: React.ReactNode;
}

function DroppableChapterArea({
  chapterId, highlight, isEmpty, showEmptyHint, children,
}: DroppableChapterAreaProps) {
  const { setNodeRef } = useDroppable({ id: chapterDropId(chapterId) });

  return (
    <div
      ref={setNodeRef}
      className={`mt-1 ml-3 border-l rounded-r-md transition-colors
        ${highlight ? 'border-amber-400 bg-amber-50/60' : 'border-slate-200'}
        ${isEmpty && showEmptyHint ? 'min-h-[34px]' : ''}
      `}
    >
      {isEmpty && showEmptyHint && (
        <p className="text-[11px] font-avenir text-slate-400 px-3 py-2 italic">
          Drop here
        </p>
      )}
      {children}
    </div>
  );
}

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
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder or move between chapters"
      >
        <GripVertical size={12} />
      </button>

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
