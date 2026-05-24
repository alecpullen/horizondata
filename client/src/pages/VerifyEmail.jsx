import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { useToast } from '../components/ui/ToastProvider'
import api, { rawApi } from '../lib/api'
import './VerifyEmail.css'

function VerifyEmail() {
    const [searchParams] = useSearchParams()
    const { showToast } = useToast()

    const token = searchParams.get('token')
    const email = searchParams.get('email') || null
    const mode = token ? 'verify' : 'waiting'

    // verify mode state
    const [verifyStatus, setVerifyStatus] = useState('loading') // 'loading' | 'success' | 'error'
    const [verifyError, setVerifyError] = useState(null) // { message, showResendLink, showLoginLink }

    // waiting mode state
    const [resendCooldown, setResendCooldown] = useState(0)
    const [isResending, setIsResending] = useState(false)

    // Run verification on mount (verify mode only)
    useEffect(() => {
        if (mode !== 'verify') return

        let cancelled = false
        rawApi.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
            .then(() => {
                if (!cancelled) setVerifyStatus('success')
            })
            .catch(err => {
                if (cancelled) return
                const code = err.response?.data?.error
                if (code === 'expired_token') {
                    setVerifyError({
                        message: 'This verification link has expired. Please request a new one.',
                        showResendLink: true,
                        showLoginLink: false,
                    })
                } else if (code === 'already_verified') {
                    setVerifyError({
                        message: 'This email address has already been verified.',
                        showResendLink: false,
                        showLoginLink: true,
                    })
                } else {
                    setVerifyError({
                        message: 'This verification link is invalid or has expired.',
                        showResendLink: true,
                        showLoginLink: false,
                    })
                }
                setVerifyStatus('error')
            })
        return () => { cancelled = true }
    }, [mode, token])

    // Countdown timer for resend button
    useEffect(() => {
        if (resendCooldown <= 0) return
        const timer = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { clearInterval(timer); return 0 }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [resendCooldown])

    const handleResend = async () => {
        if (!email || resendCooldown > 0) return
        setIsResending(true)
        try {
            await api.post('/api/auth/resend-verification', { email })
            setResendCooldown(30)
            showToast({ type: 'success', message: 'Verification email resent!' })
        } catch (err) {
            showToast({ type: 'error', message: 'Resend failed. Please try again.' })
        } finally {
            setIsResending(false)
        }
    }

    // ── verify mode: loading ──────────────────────────────────────────────────
    if (mode === 'verify' && verifyStatus === 'loading') {
        return (
            <AuthShell title="Verifying your email" subtitle="Just a moment..." footer={null}>
                <div className="verify-content">
                    <div className="verify-icon">
                        <span className="verify-spinner" style={{ width: 40, height: 40 }} />
                    </div>
                </div>
            </AuthShell>
        )
    }

    // ── verify mode: success ──────────────────────────────────────────────────
    if (mode === 'verify' && verifyStatus === 'success') {
        return (
            <AuthShell title="Email verified!" subtitle="Your account is ready" footer={null}>
                <div className="verify-content">
                    <div className="verify-icon">
                        <svg viewBox="0 0 52 52" className="checkmark">
                            <circle cx="26" cy="26" r="25" fill="none" className="checkmark__circle" />
                            <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" className="checkmark__check" />
                        </svg>
                    </div>
                    <p className="verify-instructions">
                        You can now sign in with your account.
                    </p>
                    <Link to="/login" className="verify-resend" style={{ textDecoration: 'none', display: 'inline-block' }}>
                        Go to login
                    </Link>
                </div>
            </AuthShell>
        )
    }

    // ── verify mode: error ────────────────────────────────────────────────────
    if (mode === 'verify' && verifyStatus === 'error') {
        return (
            <AuthShell title="Verification failed" subtitle="There was a problem with your verification link." footer={null}>
                <div className="verify-content">
                    <p className="verify-instructions">{verifyError?.message}</p>
                    {verifyError?.showResendLink && (
                        <Link to="/verify-email" className="verify-resend" style={{ textDecoration: 'none', display: 'inline-block' }}>
                            Request new link
                        </Link>
                    )}
                    {verifyError?.showLoginLink && (
                        <Link to="/login" className="verify-resend" style={{ textDecoration: 'none', display: 'inline-block' }}>
                            Go to login
                        </Link>
                    )}
                </div>
            </AuthShell>
        )
    }

    // ── waiting mode ──────────────────────────────────────────────────────────
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
                <div className="verify-icon">
                    <svg viewBox="0 0 64 64" fill="none" stroke="var(--teal)" strokeWidth="2">
                        <rect x="8" y="16" width="48" height="32" rx="4" />
                        <path d="M8 20L32 36L56 20" />
                        <circle cx="32" cy="32" r="4" fill="var(--teal)" stroke="none" />
                    </svg>
                </div>

                <div className="verify-email-box">
                    <span className="verify-email__label">Verification link sent to:</span>
                    <span className="verify-email__address">{email || 'your email'}</span>
                </div>

                <p className="verify-instructions">
                    Click the link in the email to verify your account.
                    If you don't see it, check your spam folder.
                </p>

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


            </div>
        </AuthShell>
    )
}

export default VerifyEmail
