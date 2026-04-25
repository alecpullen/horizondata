import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import AppLogo from '../AppLogo'
import './AuthShell.css'

function AuthShell({ title, subtitle, children, footer, backUrl = '/', showBackButton = true }) {
    const navigate = useNavigate()

    // MSW toggle state - synced with localStorage
    const [mswEnabled, setMswEnabled] = useState(() => {
        const stored = localStorage.getItem('msw-enabled')
        return stored === null ? false : stored === 'true'
    })

    // Persist MSW toggle state and reload to apply changes
    useEffect(() => {
        const prev = localStorage.getItem('msw-enabled')
        const next = mswEnabled.toString()
        if (prev !== null && prev !== next) {
            localStorage.setItem('msw-enabled', next)
            window.location.reload()
        } else {
            localStorage.setItem('msw-enabled', next)
        }
    }, [mswEnabled])

    return (
        <div className="auth-shell">
            {/* Ambient background blobs */}
            <div className="auth-blob auth-blob--1" />
            <div className="auth-blob auth-blob--2" />

            <div className="auth-content">
                {/* Logo */}
                <div className="auth-logo-wrap">
                    <AppLogo />
                </div>

                {/* Main card */}
                <div className="auth-card">
                    {title && <h1 className="auth-title">{title}</h1>}
                    {subtitle && <p className="auth-subtitle">{subtitle}</p>}

                    {children}

                    {footer && <div className="auth-footer">{footer}</div>}
                </div>

                {/* Back button */}
                {showBackButton && (
                    <button
                        className="auth-back"
                        onClick={() => navigate(backUrl)}
                        type="button"
                    >
                        ← Back to home
                    </button>
                )}

                {/* Mock API Toggle */}
                <label className="auth-msw-toggle" title="Toggle mock API">
                    <span className="auth-msw-label">Mock API</span>
                    <input
                        type="checkbox"
                        checked={mswEnabled}
                        onChange={(e) => setMswEnabled(e.target.checked)}
                    />
                    <span className="auth-msw-slider" />
                </label>
            </div>
        </div>
    )
}

export default AuthShell
