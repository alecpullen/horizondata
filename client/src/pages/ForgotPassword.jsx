import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { useToast } from '../components/ui/ToastProvider'
import { validateEmail } from '../utils/validation'
import './ForgotPassword.css'

function ForgotPassword() {
    const { showToast } = useToast()
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSent, setIsSent] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)

    const emailValidation = validateEmail(email)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!emailValidation.isValid) {
            return
        }

        setIsLoading(true)

        // Simulate API call
        await new Promise(r => setTimeout(r, 1000))

        setIsSent(true)
        setResendCooldown(30)
        showToast({
            type: 'success',
            message: 'Reset link sent! Check your email.'
        })

        setIsLoading(false)
    }

    const handleResend = async () => {
        if (resendCooldown > 0) return

        setResendCooldown(30)
        showToast({
            type: 'info',
            message: 'New reset link sent!'
        })
    }

    // Countdown timer for resend button
    useState(() => {
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

    const footer = (
        <>
            Remember your password?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
        </>
    )

    // Success state
    if (isSent) {
        return (
            <AuthShell
                title="Check your email"
                subtitle="We've sent you a link to reset your password"
                footer={footer}
            >
                <div className="forgot-success">
                    <div className="forgot-success__icon">
                        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="var(--teal)" strokeWidth="1.5">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="M2 8l10 6 10-6" />
                            <circle cx="12" cy="13" r="2" fill="var(--teal)" stroke="none" />
                        </svg>
                    </div>

                    <p className="forgot-success__email">
                        We sent an email to <strong>{email}</strong>
                    </p>

                    <p className="forgot-success__hint">
                        Click the link in the email to reset your password.
                        If you don't see it, check your spam folder.
                    </p>

                    <button
                        className="forgot-resend"
                        onClick={handleResend}
                        disabled={resendCooldown > 0}
                    >
                        {resendCooldown > 0
                            ? `Resend email (${resendCooldown}s)`
                            : "Didn't receive it? Resend"
                        }
                    </button>

                    <Link to="/login" className="forgot-back">
                        ← Back to login
                    </Link>
                </div>
            </AuthShell>
        )
    }

    // Input state
    return (
        <AuthShell
            title="Reset password"
            subtitle="Enter your email and we'll send you a reset link"
            footer={footer}
        >
            <form className="forgot-form" onSubmit={handleSubmit}>
                <div className="forgot-field">
                    <label className="forgot-label" htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        className={`forgot-input ${!emailValidation.isValid && email ? 'forgot-input--error' : ''}`}
                        placeholder="you@school.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        autoComplete="email"
                    />
                    {!emailValidation.isValid && email && (
                        <span className="forgot-field__error">{emailValidation.error}</span>
                    )}
                </div>

                <button
                    type="submit"
                    className="forgot-submit"
                    disabled={isLoading || !emailValidation.isValid}
                >
                    {isLoading ? (
                        <span className="forgot-submit__loading">
                            <span className="forgot-spinner" />
                            Sending...
                        </span>
                    ) : (
                        'Send reset link'
                    )}
                </button>
            </form>
        </AuthShell>
    )
}

export default ForgotPassword
