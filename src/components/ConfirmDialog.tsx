import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmClassName?: string;
  disabled?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  confirmClassName = "bg-blue-600 hover:bg-blue-700",
  disabled = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-96 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-yellow-500 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={disabled}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              if (disabled) return;
              onConfirm();
            }}
            disabled={disabled}
            className={`px-4 py-2 text-white rounded-lg text-sm ${confirmClassName}`}
          >
            {disabled ? "处理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
