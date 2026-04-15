import { useEffect, useState } from 'react'
import './SessionTimeoutModal.css'

function SessionTimeoutModal({ isOpen, timeLeft, onExtend, onLogout }) {
    const [displayTime, setDisplayTime] = useState(timeLeft)

    // Update display time when prop changes
    useEffect(() => {
        setDisplayTime(timeLeft)
    }, [timeLeft])

    // Countdown timer
    useEffect(() => {
        if (!isOpen || displayTime <= 0) return

        const timer = setInterval(() => {
            setDisplayTime(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [isOpen, displayTime])

    if (!isOpen) return null

    // Format time as MM:SS
    const minutes = Math.floor(displayTime / 60)
    const seconds = displayTime % 60
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`

    // Calculate progress for visual indicator
    const totalTime = 120 // 2 minutes warning
    const progress = (displayTime / totalTime) * 100

    return (
        <div className="timeout-modal-overlay" role="dialog" aria-modal="true">
            <div className="timeout-modal">
                {/* Icon */}
                <div className="timeout-modal__icon">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--gold)" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                    </svg>
                </div>

                {/* Title */}
                <h2 className="timeout-modal__title">
                    Session expiring soon
                </h2>

                {/* Message */}
                <p className="timeout-modal__message">
                    For security reasons, your session will expire in{' '}
                    <strong className="timeout-modal__time">{formattedTime}</strong>.
                    Would you like to stay logged in?
                </p>

                {/* Progress bar */}
                <div className="timeout-modal__progress">
                    <div
                        className="timeout-modal__progress-bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Actions */}
                <div className="timeout-modal__actions">
                    <button
                        className="timeout-modal__button timeout-modal__button--primary"
                        onClick={onExtend}
                    >
                        Stay logged in
                    </button>
                    <button
                        className="timeout-modal__button timeout-modal__button--secondary"
                        onClick={onLogout}
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SessionTimeoutModal
