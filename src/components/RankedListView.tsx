import { useState } from 'react'
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
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store/store'

interface RowProps {
  id: string
  rank: number
  name: string
  year: number | undefined
  rating: string
  onMarkUnplayed: (id: string) => void
}

function SortableRow({ id, rank, name, year, rating, onMarkUnplayed }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-3 bg-white"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing select-none px-1 shrink-0"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      <span className="w-8 text-right text-sm font-mono text-gray-400 shrink-0">#{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        {year ? <p className="text-xs text-gray-400">{year}</p> : null}
      </div>
      <span className="text-sm font-mono text-gray-500 shrink-0">{rating}</span>
      <button
        type="button"
        onClick={() => onMarkUnplayed(id)}
        title="Mark as unplayed"
        className="w-6 h-6 flex items-center justify-center bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-xs font-bold rounded shrink-0"
      >
        ✕
      </button>
    </li>
  )
}

export default function RankedListView() {
  const ratings = useStore(s => s.ratings)
  const games = useStore(s => s.games)
  const backToComparison = useStore(s => s.backToComparison)
  const reorderRankedList = useStore(s => s.reorderRankedList)
  const markUnplayed = useStore(s => s.markUnplayed)

  const [localOrder, setLocalOrder] = useState<string[] | null>(null)

  const sortedFromStore = Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  const orderedIds = localOrder ?? sortedFromStore

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedIds.indexOf(active.id as string)
    const newIndex = orderedIds.indexOf(over.id as string)
    const next = arrayMove(orderedIds, oldIndex, newIndex)
    setLocalOrder(next)
    reorderRankedList(next)
  }

  function handleMarkUnplayed(id: string) {
    setLocalOrder(null)
    markUnplayed(id)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Rankings ({orderedIds.length} games)</h1>
        <button
          type="button"
          onClick={backToComparison}
          className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          ← Back
        </button>
      </header>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <ol className="divide-y divide-gray-100">
            {orderedIds.map((id, idx) => {
              const game = games[id]
              const ratingInt = ratings[id] ?? 0
              return (
                <SortableRow
                  key={id}
                  id={id}
                  rank={idx + 1}
                  name={game?.name ?? id}
                  year={game?.yearPublished}
                  rating={(ratingInt / 100).toFixed(2)}
                  onMarkUnplayed={handleMarkUnplayed}
                />
              )
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  )
}
