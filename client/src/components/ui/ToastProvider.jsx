import { createContext, useContext, useState, useCallback } from 'react'
import Toast from './Toast'
import './Toast.css'

const ToastContext = createContext(null)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const showToast = useCallback(({ type = 'info', message }) => {
        const id = Date.now() + Math.random()
        setToasts(prev => [...prev, { id, type, message }])
        return id
    }, [])

    const hideToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id))
    }, [])

    const value = {
        showToast,
        hideToast,
        toasts
    }

    return (
        <ToastContext.Provider value={value}>
            {children}
            {toasts.length > 0 && (
                <div className="toast-container">
                    {toasts.map(toast => (
                        <Toast
                            key={toast.id}
                            id={toast.id}
                            type={toast.type}
                            message={toast.message}
                            onClose={hideToast}
                        />
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    )
}

export default ToastProvider
