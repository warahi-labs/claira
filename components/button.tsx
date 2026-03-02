import { ButtonHTMLAttributes } from "react";

const variants = {
  solid: "bg-foreground text-background hover:opacity-90",
  outline: "border border-foreground/20 text-foreground hover:bg-foreground/5",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: keyof typeof variants;
}

export function Button({ children, className, variant = "solid", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all ${variants[variant]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
