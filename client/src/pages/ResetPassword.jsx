import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { useToast } from '../components/ui/ToastProvider'
import { validatePassword, doPasswordsMatch } from '../utils/validation'
import './ResetPassword.css'

function ResetPassword() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') // Ignored for now, used later with BetterAuth
    const { showToast } = useToast()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [touched, setTouched] = useState({ password: false, confirmPassword: false })

    const passwordValidation = validatePassword(password)
    const confirmValidation = doPasswordsMatch(password, confirmPassword)

    const handleSubmit = async (e) => {
        e.preventDefault()

        setTouched({ password: true, confirmPassword: true })

        if (!passwordValidation.isValid || !confirmValidation.isValid) {
            return
        }

        setIsLoading(true)

        // Simulate API call
        await new Promise(r => setTimeout(r, 1000))

        setIsSuccess(true)
        showToast({
            type: 'success',
            message: 'Password reset successfully!'
        })

        setIsLoading(false)
    }

    // Success state
    if (isSuccess) {
        return (
            <AuthShell
                title="Password reset!"
                subtitle="Your password has been successfully reset"
            >
                <div className="reset-success">
                    <div className="reset-success__icon">
                        <svg viewBox="0 0 52 52" className="checkmark">
                            <circle cx="26" cy="26" r="25" fill="none" className="checkmark__circle" />
                            <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" className="checkmark__check" />
                        </svg>
                    </div>

                    <p className="reset-success__text">
                        You can now sign in with your new password.
                    </p>

                    <Link to="/login" className="reset-success__button">
                        Go to login
                    </Link>
                </div>
            </AuthShell>
        )
    }

    const footer = (
        <>
            Remember your password?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
        </>
    )

    return (
        <AuthShell
            title="Create new password"
            subtitle="Enter a new password for your account"
            footer={footer}
        >
            {/* Show token info (for demo purposes) */}
            {token && (
                <div className="reset-token">
                    <code>Token: {token.substring(0, 20)}...</code>
                </div>
            )}

            <form className="reset-form" onSubmit={handleSubmit}>
                {/* New Password */}
                <div className="reset-field">
                    <label className="reset-label" htmlFor="password">New Password</label>
                    <div className="reset-input-wrapper">
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            className={`reset-input ${passwordValidation.errors && touched.password ? 'reset-input--error' : ''}`}
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            className="reset-input__toggle"
                            onClick={() => setShowPassword(!showPassword)}
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

                    {/* Password strength indicator */}
                    <div className="reset-strength">
                        <div className="reset-strength__bars">
                            {[1, 2, 3, 4].map((level) => (
                                <div
                                    key={level}
                                    className={`reset-strength__bar ${
                                        passwordValidation.strength >= level ? `reset-strength__bar--${passwordValidation.strength}` : ''
                                    }`}
                                />
                            ))}
                        </div>
                        <span className="reset-strength__label">
                            {passwordValidation.strength === 0 && 'Weak'}
                            {passwordValidation.strength === 1 && 'Fair'}
                            {passwordValidation.strength === 2 && 'Good'}
                            {passwordValidation.strength === 3 && 'Strong'}
                            {passwordValidation.strength === 4 && 'Very Strong'}
                        </span>
                    </div>
                </div>

                {/* Confirm Password */}
                <div className="reset-field">
                    <label className="reset-label" htmlFor="confirmPassword">Confirm Password</label>
                    <input
                        id="confirmPassword"
                        type="password"
                        className={`reset-input ${!confirmValidation.isValid && touched.confirmPassword ? 'reset-input--error' : ''}`}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
                        disabled={isLoading}
                    />
                    {!confirmValidation.isValid && touched.confirmPassword && confirmPassword && (
                        <span className="reset-field__error">{confirmValidation.error}</span>
                    )}
                </div>

                <button
                    type="submit"
                    className="reset-submit"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <span className="reset-submit__loading">
                            <span className="reset-spinner" />
                            Resetting...
                        </span>
                    ) : (
                        'Reset password'
                    )}
                </button>
            </form>
        </AuthShell>
    )
}

export default ResetPassword
