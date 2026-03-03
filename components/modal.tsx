"use client";

import { X } from "lucide-react";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  showClose?: boolean;
}

export function Modal({ title, children, onClose, showClose = true }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-foreground/20 bg-background p-6 shadow-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          {showClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 transition-colors hover:bg-foreground/10"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
