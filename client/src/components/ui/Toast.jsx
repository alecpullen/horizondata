import { useEffect } from 'react'
import './Toast.css'

const icons = {
    success: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    error: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
        </svg>
    ),
    info: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M12 8h.01" strokeLinecap="round"/>
        </svg>
    )
}

function Toast({ type, message, onClose, id }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id)
        }, 4000)

        return () => clearTimeout(timer)
    }, [id, onClose])

    return (
        <div className={`toast toast--${type}`} role="alert">
            <div className="toast__icon">{icons[type]}</div>
            <div className="toast__message">{message}</div>
            <button
                className="toast__close"
                onClick={() => onClose(id)}
                aria-label="Close notification"
            >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round"/>
                </svg>
            </button>
        </div>
    )
}

export default Toast
