import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, id, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && id ? `${id}-error` : undefined}
        className={cn(
          "w-full rounded-card border bg-surface px-3 py-2",
          "font-body text-body text-neutral placeholder:text-neutral/40",
          "border-neutral/20 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
          error && "border-accent focus:ring-accent/40 focus:border-accent",
          className,
        )}
        {...props}
      />
      {error && id && (
        <p id={`${id}-error`} className="font-body text-small text-accent">
          {error}
        </p>
      )}
    </div>
  ),
);
Input.displayName = "Input";
