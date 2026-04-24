import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-surface border border-neutral/10 rounded-card shadow-sm",
        "p-6 font-body text-neutral",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
