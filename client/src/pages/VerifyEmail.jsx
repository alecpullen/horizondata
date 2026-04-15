import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { useToast } from '../components/ui/ToastProvider'
import './VerifyEmail.css'

function VerifyEmail() {
    const [searchParams] = useSearchParams()
    const email = searchParams.get('email') || 'your email'
    const { showToast } = useToast()

    const [resendCooldown, setResendCooldown] = useState(0)
    const [isResending, setIsResending] = useState(false)

    // Countdown timer for resend button
    useEffect(() => {
        if (resendCooldown <= 0) return

        const timer = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [resendCooldown])

    const handleResend = async () => {
        if (resendCooldown > 0) return

        setIsResending(true)

        // Simulate API call
        await new Promise(r => setTimeout(r, 800))

        setResendCooldown(30)
        setIsResending(false)

        showToast({
            type: 'success',
            message: 'Verification email resent!'
        })
    }

    const footer = (
        <>
            Already verified?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
        </>
    )

    return (
        <AuthShell
            title="Verify your email"
            subtitle="One more step to get started"
            footer={footer}
        >
            <div className="verify-content">
                {/* Envelope icon */}
                <div className="verify-icon">
                    <svg viewBox="0 0 64 64" fill="none" stroke="var(--teal)" strokeWidth="2">
                        <rect x="8" y="16" width="48" height="32" rx="4" />
                        <path d="M8 20L32 36L56 20" />
                        <circle cx="32" cy="32" r="4" fill="var(--teal)" stroke="none" />
                    </svg>
                </div>

                {/* Email address display */}
                <div className="verify-email-box">
                    <span className="verify-email__label">Verification link sent to:</span>
                    <span className="verify-email__address">{email}</span>
                </div>

                {/* Instructions */}
                <p className="verify-instructions">
                    Click the link in the email to verify your account.
                    If you don't see it, check your spam folder.
                </p>

                {/* Resend button */}
                <button
                    className="verify-resend"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                >
                    {isResending ? (
                        <>
                            <span className="verify-spinner" />
                            Sending...
                        </>
                    ) : resendCooldown > 0 ? (
                        `Resend email (${resendCooldown}s)`
                    ) : (
                        "Didn't receive it? Resend"
                    )}
                </button>

                {/* Help link */}
                <p className="verify-help">
                    Need help?{' '}
                    <Link to="/contact" className="auth-link">
                        Contact support
                    </Link>
                </p>
            </div>
        </AuthShell>
    )
}

export default VerifyEmail
