import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AppLogo from '../components/AppLogo'
import './Login.css'

function Login() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // TODO: Integrate with BetterAuth
    // import { signIn } from '@/lib/auth'

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            // Placeholder for BetterAuth integration
            // const result = await signIn({ email, password, rememberMe })
            // if (result.success) {
            //     navigate('/bookings')
            // } else {
            //     setError(result.message || 'Login failed')
            // }

            // Temporary mock behavior - remove once BetterAuth is integrated
            console.log('Login attempt:', { email, password, rememberMe })
            await new Promise(r => setTimeout(r, 500))
            navigate('/bookings')
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    // TODO: AAF (Australian Access Federation) SSO integration
    const handleAAFLogin = () => {
        console.log('AAF SSO - integrate with BetterAuth')
        // import { signInSSO }
        // await signInSSO({ provider: 'aaf', callbackURL: '/bookings' })
    }

    return (
        <div className="login-shell">
            <div className="login-blob login-blob--1" />
            <div className="login-blob login-blob--2" />

            <div className="login-content">
                <div className="login-logo-wrap">
                    <AppLogo />
                </div>

                <div className="login-card">
                    <h1 className="login-title">Welcome back</h1>
                    <p className="login-subtitle">Sign in to access your telescope sessions</p>

                    {error && <div className="login-error">{error}</div>}

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="login-field">
                            <label htmlFor="email" className="login-label">Email</label>
                            <input
                                id="email"
                                type="email"
                                className="login-input"
                                placeholder="you@school.edu"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="login-field">
                            <label htmlFor="password" className="login-label">
                                Password
                                <Link to="/forgot-password" className="login-forgot-link">
                                    Forgot?
                                </Link>
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="login-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <div className="login-remember">
                            <label className="login-checkbox">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span className="login-checkmark" />
                                Remember me
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="login-submit"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    <div className="login-divider">
                        <span>or</span>
                    </div>

                    <button
                        className="login-sso-btn"
                        onClick={handleAAFLogin}
                        type="button"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
                        </svg>
                        EDU Login
                    </button>

                    <div className="login-footer">
                        Don't have an account?{' '}
                        <Link to="/register" className="login-link">
                            Create one
                        </Link>
                    </div>
                </div>

                <button
                    className="login-back"
                    onClick={() => navigate('/')}
                    type="button"
                >
                    ← Back to home
                </button>
            </div>
        </div>
    )
}

export default Login
