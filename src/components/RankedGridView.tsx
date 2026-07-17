import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store/store'

function normalizeUrl(url: string): string {
  return url.startsWith('//') ? `https:${url}` : url
}

interface GridCellProps {
  id: string
  thumbnail: string
}

function SortableGridCell({ id, thumbnail }: GridCellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="aspect-square overflow-hidden rounded cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {thumbnail ? (
        <img
          src={normalizeUrl(thumbnail)}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="w-full h-full bg-gray-100" />
      )}
    </div>
  )
}

export default function RankedGridView() {
  const ratings = useStore(s => s.ratings)
  const games = useStore(s => s.games)
  const reorderRankedList = useStore(s => s.reorderRankedList)

  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const [pageOffset, setPageOffset] = useState(0)
  const preloadedUrls = useRef<Set<string>>(new Set())

  const sortedFromStore = Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  const orderedIds = localOrder ?? sortedFromStore

  const safeOffset = Math.min(pageOffset, Math.max(0, orderedIds.length - 1))
  const pageSlice = orderedIds.slice(safeOffset, safeOffset + 200)

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pageSlice.indexOf(active.id as string)
    const newIndex = pageSlice.indexOf(over.id as string)
    const newPage = arrayMove(pageSlice, oldIndex, newIndex)
    const newFullOrder = [
      ...orderedIds.slice(0, safeOffset),
      ...newPage,
      ...orderedIds.slice(safeOffset + pageSlice.length),
    ]
    setLocalOrder(newFullOrder)
    reorderRankedList(newFullOrder)
  }

  function preloadImages(urls: string[]) {
    for (const url of urls) {
      if (!url || preloadedUrls.current.has(url)) continue
      preloadedUrls.current.add(url)
      const img = new Image()
      img.src = normalizeUrl(url)
    }
  }

  useEffect(() => {
    const visible = pageSlice
      .map(id => games[id]?.thumbnail)
      .filter((t): t is string => Boolean(t))
    preloadImages(visible)

    const incoming = orderedIds
      .slice(safeOffset + 200, safeOffset + 400)
      .map(id => games[id]?.thumbnail)
      .filter((t): t is string => Boolean(t))
    preloadImages(incoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeOffset])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setPageOffset(Math.max(0, safeOffset - 100))}
          disabled={safeOffset === 0}
          className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed outline-2 outline-offset-2 outline-blue-600"
        >
          ← Prev 100
        </button>
        <span className="text-sm text-gray-600">
          Rankings {safeOffset + 1}–{Math.min(safeOffset + 200, orderedIds.length)} of {orderedIds.length}
        </span>
        <button
          type="button"
          onClick={() => setPageOffset(Math.min(safeOffset + 100, Math.max(0, orderedIds.length - 1)))}
          disabled={safeOffset + 200 >= orderedIds.length}
          className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed outline-2 outline-offset-2 outline-blue-600"
        >
          Next 100 →
        </button>
      </div>

      {/* Side click zones — click left/right of grid to paginate */}
      {safeOffset > 0 && (
        <div
          className="fixed left-0 top-0 bottom-0 w-24 cursor-pointer z-10 flex items-center justify-center group"
          onClick={() => setPageOffset(Math.max(0, safeOffset - 100))}
        >
          <span className="text-5xl text-gray-300 group-hover:text-gray-500 select-none">‹</span>
        </div>
      )}
      {safeOffset + 200 < orderedIds.length && (
        <div
          className="fixed right-0 top-0 bottom-0 w-24 cursor-pointer z-10 flex items-center justify-center group"
          onClick={() => setPageOffset(Math.min(safeOffset + 100, Math.max(0, orderedIds.length - 1)))}
        >
          <span className="text-5xl text-gray-300 group-hover:text-gray-500 select-none">›</span>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pageSlice} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-10 gap-1">
            {pageSlice.map(id => (
              <SortableGridCell
                key={id}
                id={id}
                thumbnail={games[id]?.thumbnail ?? ''}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
