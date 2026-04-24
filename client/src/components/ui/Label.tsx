import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "inline-block font-body text-small font-medium text-neutral",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";
