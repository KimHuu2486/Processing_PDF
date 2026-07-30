import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { IconButton } from "./Button";

interface SortableItemProps<T> {
  item: T;
  id: string;
  index: number;
  count: number;
  label: string;
  renderItem: (item: T, index: number) => ReactNode;
  onMove: (from: number, to: number) => void;
  disabled: boolean;
}

function SortableItem<T>({
  item,
  id,
  index,
  count,
  label,
  renderItem,
  onMove,
  disabled,
}: SortableItemProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={cn(
        "relative min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm",
        isDragging && "z-10 border-brand-500 opacity-80 shadow-lg",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-slate-500">
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            variant="ghost"
            className="size-11"
            aria-label={`Di chuyển ${label} về trước`}
            isDisabled={disabled || index === 0}
            onPress={() => onMove(index, index - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            variant="ghost"
            className="size-11"
            aria-label={`Di chuyển ${label} về sau`}
            isDisabled={disabled || index === count - 1}
            onPress={() => onMove(index, index + 1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            variant="ghost"
            className="size-11 cursor-grab touch-none active:cursor-grabbing"
            aria-label={`Kéo để sắp xếp ${label}`}
            isDisabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      {renderItem(item, index)}
    </li>
  );
}

export interface SortableGridProps<T> {
  items: readonly T[];
  getId: (item: T) => string;
  getLabel: (item: T, index: number) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function SortableGrid<T>({
  items,
  getId,
  getLabel,
  onReorder,
  renderItem,
  label = "Danh sách có thể sắp xếp",
  className,
  disabled = false,
}: SortableGridProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const ids = useMemo(() => items.map(getId), [items, getId]);
  const activeIndex =
    activeId === null
      ? -1
      : items.findIndex((item) => getId(item) === String(activeId));
  const activeLabel =
    activeIndex >= 0 ? getLabel(items[activeIndex], activeIndex) : "";

  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= items.length || from === to) {
      return;
    }
    onReorder(arrayMove([...items], from, to));
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (disabled) {
      return;
    }
    setActiveId(active.id);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (disabled || !over || active.id === over.id) {
      return;
    }

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0) {
      onReorder(arrayMove([...items], oldIndex, newIndex));
    }
  };

  const labelForId = (id: UniqueIdentifier) => {
    const index = items.findIndex((item) => getId(item) === String(id));
    return index >= 0 ? getLabel(items[index], index) : "mục";
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Nhấn phím cách để bắt đầu kéo. Dùng phím mũi tên để di chuyển. Nhấn lại phím cách để thả hoặc Escape để hủy.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Đã chọn ${labelForId(active.id)} để sắp xếp.`,
          onDragOver: ({ over }) =>
            over
              ? `Đang ở vị trí của ${labelForId(over.id)}.`
              : "Không ở trên vị trí hợp lệ.",
          onDragEnd: ({ active, over }) =>
            over
              ? `Đã đặt ${labelForId(active.id)} vào vị trí của ${labelForId(over.id)}.`
              : `Không thay đổi vị trí của ${labelForId(active.id)}.`,
          onDragCancel: () =>
            activeLabel
              ? `Đã hủy sắp xếp ${activeLabel}.`
              : "Đã hủy sắp xếp.",
        },
      }}
    >
      <SortableContext items={ids}>
        <ul
          aria-label={label}
          className={cn(
            "grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
            className,
          )}
        >
          {items.map((item, index) => {
            const id = getId(item);
            return (
              <SortableItem
                key={id}
                id={id}
                item={item}
                index={index}
                count={items.length}
                label={getLabel(item, index)}
                renderItem={renderItem}
                onMove={move}
                disabled={disabled}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
