import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none border-2",
  {
    variants: {
      variant: {
        default:
          "bg-yellow-400 text-black hover:bg-yellow-500",
        destructive:
          "bg-red-500 text-white hover:bg-red-600",
        outline:
          "bg-white text-black hover:bg-slate-100",
        secondary:
          "bg-blue-400 text-black hover:bg-blue-500",
        ghost:
          "hover:bg-accent hover:text-accent-foreground border-transparent shadow-none",
        link: "text-primary underline-offset-4 hover:underline border-none shadow-none",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isUnstyled = variant === "ghost" || variant === "link";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={{
          borderColor: isUnstyled ? undefined : "var(--border-color)",
          boxShadow: isUnstyled ? undefined : "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
          ...style,
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
