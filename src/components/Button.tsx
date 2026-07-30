import { forwardRef, type ReactNode } from "react";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";

import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-brand-600 bg-brand-600 text-white shadow-sm hover:border-brand-700 hover:bg-brand-700 data-[pressed]:border-brand-800 data-[pressed]:bg-brand-800",
  secondary:
    "border-slate-300 bg-white text-slate-800 shadow-sm hover:border-brand-300 hover:bg-brand-50 data-[pressed]:bg-brand-100",
  ghost:
    "border-transparent bg-transparent text-slate-700 hover:bg-slate-100 data-[pressed]:bg-slate-200",
  danger:
    "border-red-700 bg-red-700 text-white shadow-sm hover:border-red-800 hover:bg-red-800 data-[pressed]:bg-red-900",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-11 gap-1.5 px-3 py-1.5 text-sm",
  md: "min-h-11 gap-2 px-4 py-2 text-sm",
  lg: "min-h-12 gap-2 px-5 py-2.5 text-base",
  icon: "size-11 justify-center p-0",
};

export interface ButtonProps extends Omit<AriaButtonProps, "className"> {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      type = "button",
      ...props
    },
    ref,
  ) => (
    <AriaButton
      ref={ref}
      type={type}
      className={({ isDisabled, isFocusVisible }) =>
        cn(
          "inline-flex cursor-pointer items-center justify-center rounded-lg border font-semibold",
          "focus:outline-none",
          isFocusVisible && "ring-2 ring-brand-500 ring-offset-2",
          isDisabled && "cursor-not-allowed opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )
      }
      {...props}
    />
  ),
);

Button.displayName = "Button";

export interface IconButtonProps
  extends Omit<ButtonProps, "children" | "size"> {
  "aria-label": string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, ...props }, ref) => (
    <Button ref={ref} size="icon" {...props}>
      {children}
    </Button>
  ),
);

IconButton.displayName = "IconButton";
