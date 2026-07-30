import {
  FieldError,
  Input,
  Label,
  Text,
  TextField,
} from "react-aria-components";

import { cn } from "../lib/cn";

export interface OutputFileNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

export function OutputFileNameField({
  value,
  onChange,
  error,
  disabled = false,
  label = "Tên tệp kết quả",
  description = "Đuôi .pdf sẽ được thêm tự động nếu còn thiếu.",
  className,
}: OutputFileNameFieldProps) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      isDisabled={disabled}
      isInvalid={Boolean(error)}
      className={cn("flex flex-col gap-2", className)}
    >
      <Label className="text-sm font-semibold text-slate-800">{label}</Label>
      <Input className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-slate-100" />
      <Text slot="description" className="text-pretty text-xs text-slate-500">
        {description}
      </Text>
      {error ? (
        <FieldError className="text-pretty text-sm font-medium text-red-700">
          {error}
        </FieldError>
      ) : null}
    </TextField>
  );
}
