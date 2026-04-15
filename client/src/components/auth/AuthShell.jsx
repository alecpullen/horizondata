import { useNavigate } from 'react-router-dom'
import AppLogo from '../AppLogo'
import './AuthShell.css'

function AuthShell({ title, subtitle, children, footer, backUrl = '/', showBackButton = true }) {
    const navigate = useNavigate()

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
            </div>
        </div>
    )
}

export default AuthShell
