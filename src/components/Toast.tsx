import { useEffect, useRef } from "react";
import { CheckCircle, AlertCircle, XCircle, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "warning" | "error";
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id]);

  const icons = {
    success: <CheckCircle size={16} className="text-green-500" />,
    warning: <AlertCircle size={16} className="text-yellow-500" />,
    error: <XCircle size={16} className="text-red-500" />,
  };

  const bg = {
    success: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    error: "bg-red-50 border-red-200",
  };

  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg ${bg[toast.type]} min-w-64`}>
      {icons[toast.type]}
      <span className="text-sm text-gray-700 flex-1">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>
  );
}
