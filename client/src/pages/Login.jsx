import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import LoadingSkeleton from '../components/auth/LoadingSkeleton'
import { useToast } from '../components/ui/ToastProvider'
import { validateEmail, validateRequired, AUTH_ERROR_TYPES, getAuthErrorMessage } from '../utils/validation'
import { useMockSession } from '../hooks/useLocalStorage'
import { useRedirectAfterAuth } from '../hooks/useRedirectAfterAuth'
import './Login.css'

// Error types for different auth failure scenarios
const ERROR_VARIANTS = Object.keys(AUTH_ERROR_TYPES)

function Login() {
    const { showToast } = useToast()
    const { login: mockLogin, isAuthenticated, session, checkSession } = useMockSession()
    const { redirect, getRedirectUrl } = useRedirectAfterAuth()

    // Loading state for session check
    const [isCheckingSession, setIsCheckingSession] = useState(true)

    // Form state
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)

    // Validation state
    const [touched, setTouched] = useState({ email: false, password: false })
    const [errors, setErrors] = useState({ email: '', password: '' })

    // UI state
    const [isLoading, setIsLoading] = useState(false)
    const [bannerError, setBannerError] = useState('')
    const [rateLimitEnd, setRateLimitEnd] = useState(null)

    // Success animation state
    const [showSuccess, setShowSuccess] = useState(false)

    // Refs
    const emailInputRef = useRef(null)

    // Check for existing session on mount
    useEffect(() => {
        const checkExistingSession = async () => {
            // Simulate a brief loading delay for UX
            await new Promise(r => setTimeout(r, 600))

            const hasValidSession = checkSession()

            if (hasValidSession) {
                showToast({
                    type: 'info',
                    message: `Welcome back, ${session.email}!`
                })
                // Redirect to saved URL or default
                window.location.href = getRedirectUrl()
                return
            }

            setIsCheckingSession(false)
        }

        checkExistingSession()
    }, [checkSession, session, showToast, getRedirectUrl])

    // Auto-focus email field when form is shown
    useEffect(() => {
        if (!isCheckingSession && !isAuthenticated) {
            emailInputRef.current?.focus()
        }
    }, [isCheckingSession, isAuthenticated])

    // Rate limit countdown
    useEffect(() => {
        if (!rateLimitEnd) return

        const interval = setInterval(() => {
            if (Date.now() >= rateLimitEnd) {
                setRateLimitEnd(null)
                clearInterval(interval)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [rateLimitEnd])

    // Real-time validation
    useEffect(() => {
        const newErrors = {}

        if (touched.email) {
            const emailValidation = validateEmail(email)
            newErrors.email = emailValidation.isValid ? '' : emailValidation.error
        }

        if (touched.password) {
            const pwdValidation = validateRequired(password, 'Password')
            newErrors.password = pwdValidation.isValid ? '' : pwdValidation.error
        }

        setErrors(newErrors)
    }, [email, password, touched])

    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }))
    }

    const getRateLimitCountdown = () => {
        if (!rateLimitEnd) return ''
        const seconds = Math.ceil((rateLimitEnd - Date.now()) / 1000)
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // TODO: AAF (Australian Access Federation) SSO integration
    const handleAAFLogin = () => {
        showToast({
            type: 'info',
            message: 'EDU Login integration coming soon'
        })
        console.log('AAF SSO - integrate with BetterAuth')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setBannerError('')

        // Mark all fields as touched for validation
        setTouched({ email: true, password: true })

        // Validate all fields
        const emailValidation = validateEmail(email)
        const pwdValidation = validateRequired(password, 'Password')

        if (!emailValidation.isValid || !pwdValidation.isValid) {
            return
        }

        // Check rate limiting
        if (rateLimitEnd && Date.now() < rateLimitEnd) {
            return
        }

        setIsLoading(true)

        try {
            // TEMP: Mock login with random error simulation for testing
            // Remove this random error logic when BetterAuth is integrated
            await new Promise(r => setTimeout(r, 800))

            // Simulate occasional errors for testing (30% chance)
            if (Math.random() < 0.3) {
                const randomError = ERROR_VARIANTS[Math.floor(Math.random() * ERROR_VARIANTS.length)]

                if (randomError === 'RATE_LIMITED') {
                    // Set 1 minute rate limit for demo
                    setRateLimitEnd(Date.now() + 60 * 1000)
                }

                setBannerError(randomError)
                showToast({
                    type: 'error',
                    message: getAuthErrorMessage(randomError)
                })
                setIsLoading(false)
                return
            }

            // Simulate successful login
            mockLogin(email, rememberMe)
            setShowSuccess(true)
            showToast({
                type: 'success',
                message: 'Login successful!'
            })

            // Redirect after success animation
            setTimeout(() => {
                redirect()
            }, 1200)

        } catch (err) {
            setBannerError('UNKNOWN')
            showToast({
                type: 'error',
                message: getAuthErrorMessage('UNKNOWN')
            })
            setIsLoading(false)
        }
    }

    // Show loading skeleton while checking session
    if (isCheckingSession) {
        return <LoadingSkeleton />
    }

    // Success animation overlay
    if (showSuccess) {
        return (
            <AuthShell showBackButton={false}>
                <div className="login-success">
                    <div className="login-success__icon">
                        <svg viewBox="0 0 52 52" className="checkmark">
                            <circle cx="26" cy="26" r="25" fill="none" className="checkmark__circle" />
                            <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" className="checkmark__check" />
                        </svg>
                    </div>
                    <h2 className="login-success__title">Welcome back!</h2>
                    <p className="login-success__text">Redirecting you to your dashboard...</p>
                </div>
            </AuthShell>
        )
    }

    const footer = (
        <>
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
                Create one
            </Link>
        </>
    )

    return (
        <AuthShell
            title="Welcome back"
            subtitle="Sign in to access your telescope sessions"
            footer={footer}
        >
            {/* Banner error message */}
            {bannerError && (
                <div className={`login-banner login-banner--${bannerError.toLowerCase()}`}>
                    <div className="login-banner__icon">
                        {bannerError === 'RATE_LIMITED' ? '⏱️' : '⚠️'}
                    </div>
                    <div className="login-banner__content">
                        <p>{getAuthErrorMessage(bannerError)}</p>
                        {bannerError === 'RATE_LIMITED' && (
                            <p className="login-banner__countdown">
                                Try again in {getRateLimitCountdown()}
                            </p>
                        )}
                        {bannerError === 'EMAIL_NOT_VERIFIED' && (
                            <button className="login-banner__action">
                                Resend verification email
                            </button>
                        )}
                        {bannerError === 'NETWORK_ERROR' && (
                            <button
                                className="login-banner__action"
                                onClick={handleSubmit}
                            >
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
                {/* Email field */}
                <div className="login-field">
                    <label htmlFor="email" className="login-label">
                        Email
                    </label>
                    <input
                        id="email"
                        ref={emailInputRef}
                        type="email"
                        className={`login-input ${errors.email && touched.email ? 'login-input--error' : ''}`}
                        placeholder="you@school.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => handleBlur('email')}
                        disabled={isLoading || (rateLimitEnd && Date.now() < rateLimitEnd)}
                        autoComplete="email"
                    />
                    {errors.email && touched.email && (
                        <span className="login-field__error">{errors.email}</span>
                    )}
                </div>

                {/* Password field with visibility toggle */}
                <div className="login-field">
                    <label htmlFor="password" className="login-label">
                        Password
                        <Link to="/forgot-password" className="login-forgot-link">
                            Forgot?
                        </Link>
                    </label>
                    <div className="login-input-wrapper">
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            className={`login-input login-input--with-icon ${errors.password && touched.password ? 'login-input--error' : ''}`}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={() => handleBlur('password')}
                            disabled={isLoading || (rateLimitEnd && Date.now() < rateLimitEnd)}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className="login-input__toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            )}
                        </button>
                    </div>
                    {errors.password && touched.password && (
                        <span className="login-field__error">{errors.password}</span>
                    )}
                </div>

                {/* Remember me checkbox */}
                <div className="login-remember">
                    <label className="login-checkbox">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            disabled={isLoading}
                        />
                        <span className="login-checkmark" />
                        Remember me
                    </label>
                </div>

                {/* Submit button */}
                <button
                    type="submit"
                    className="login-submit"
                    disabled={isLoading || (rateLimitEnd && Date.now() < rateLimitEnd)}
                >
                    {isLoading ? (
                        <span className="login-submit__loading">
                            <span className="login-spinner" />
                            Signing in...
                        </span>
                    ) : (
                        'Sign in'
                    )}
                </button>
            </form>

            {/* SSO divider and button */}
            <div className="login-divider">
                <span>or</span>
            </div>

            <button
                className="login-sso-btn"
                onClick={handleAAFLogin}
                type="button"
                disabled={isLoading}
            >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
                </svg>
                EDU Login
            </button>
        </AuthShell>
    )
}

export default Login
