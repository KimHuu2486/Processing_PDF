import { Camera, RotateCw, Trash2 } from "lucide-react";

import { Button, IconButton, SortableGrid } from "../../components";
import type { SelectedImage } from "./imageItems";

type ImageGridEditorProps = {
  items: SelectedImage[];
  onReorder: (items: SelectedImage[]) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onRetake?: (id: string) => void;
  label?: string;
  disabled?: boolean;
};

export function ImageGridEditor({
  items,
  onReorder,
  onRotate,
  onDelete,
  onRetake,
  label = "Các ảnh có thể sắp xếp",
  disabled = false,
}: ImageGridEditorProps) {
  return (
    <SortableGrid
      items={items}
      getId={(item) => item.id}
      getLabel={(item) => item.file.name}
      onReorder={onReorder}
      label={label}
      disabled={disabled}
      renderItem={(item, index) => (
        <div className="space-y-3">
          <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-3">
            <img
              src={item.previewUrl}
              alt={`Ảnh ${index + 1}: ${item.file.name}`}
              loading="lazy"
              decoding="async"
              className="max-h-44 max-w-full object-contain"
              style={{ transform: `rotate(${item.rotation}deg)` }}
            />
          </div>
          <p className="truncate text-sm font-medium text-slate-800">
            {item.file.name}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {onRetake && (
              <Button
                size="sm"
                variant="ghost"
                isDisabled={disabled}
                onPress={() => onRetake(item.id)}
              >
                <Camera className="size-4" aria-hidden="true" />
                Chụp lại
              </Button>
            )}
            <IconButton
              variant="ghost"
              isDisabled={disabled}
              aria-label={`Xoay ${item.file.name} sang phải`}
              onPress={() => onRotate(item.id)}
            >
              <RotateCw className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              variant="ghost"
              isDisabled={disabled}
              className="text-red-700 hover:bg-red-50"
              aria-label={`Xóa ${item.file.name}`}
              onPress={() => onDelete(item.id)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      )}
    />
  );
}
