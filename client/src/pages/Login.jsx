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

    // TODO: Social login with BetterAuth
    const handleSocialLogin = (provider) => {
        console.log(`Social login with ${provider} - integrate with BetterAuth`)
        // import { signInSocial }
        // await signInSocial({ provider, callbackURL: '/bookings' })
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
                        <span>or continue with</span>
                    </div>

                    <div className="login-social">
                        <button
                            className="login-social-btn"
                            onClick={() => handleSocialLogin('google')}
                            type="button"
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Google
                        </button>
                        <button
                            className="login-social-btn"
                            onClick={() => handleSocialLogin('microsoft')}
                            type="button"
                        >
                            <svg viewBox="0 0 21 21" width="18" height="18">
                                <path fill="#f25022" d="M1 1h9v9H1z"/>
                                <path fill="#00a4ef" d="M1 11h9v9H1z"/>
                                <path fill="#7fba00" d="M11 1h9v9h-9z"/>
                                <path fill="#ffb900" d="M11 11h9v9h-9z"/>
                            </svg>
                            Microsoft
                        </button>
                    </div>

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
