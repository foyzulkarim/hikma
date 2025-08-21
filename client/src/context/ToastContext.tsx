import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast as ToastType } from '../types';
import { Toast } from '../components/ui/Toast';
import { generateId } from '../utils/helpers';

interface ToastContextType {
  showToast: (toast: Omit<ToastType, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const showToast = useCallback((toast: Omit<ToastType, 'id'>) => {
    const id = generateId();
    setToasts((prevToasts) => [...prevToasts, { id, ...toast }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-4">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

