import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import AuthShell from '../components/auth/AuthShell'
import { useToast } from '../components/ui/ToastProvider'
import { useAuth } from '../contexts/AuthContext'
import './PendingApproval.css'

function PendingApproval() {
    const { showToast } = useToast()
    const { logoutTeacher, user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (!user) return

        if (user.account_status === 'approved') {
            navigate('/bookings', { replace: true })
            return
        }

        let attempts = 0
        const MAX_RETRIES = 30

        const interval = setInterval(async () => {
            attempts++
            if (attempts > MAX_RETRIES) {
                clearInterval(interval)
                return
            }

            try {
                const res = await api.get('/api/auth/teacher/me')
                const status = res.data?.user?.account_status
                if (status === 'approved') {
                    clearInterval(interval)
                    navigate('/bookings', { replace: true })
                }
            } catch {
                // poll will retry on next interval
            }
        }, 5000)

        return () => clearInterval(interval)
    }, [user, navigate])

    const handleSignOut = async () => {
        try {
            await logoutTeacher()
        } catch {
            // proceed regardless
        }
        showToast({ type: 'info', message: 'Signed out successfully' })
        window.location.href = '/login'
    }

    const footer = (
        <button onClick={handleSignOut} className="pending-signout">
            Sign out
        </button>
    )

    return (
        <AuthShell
            title="Account pending approval"
            subtitle="Your teacher account is being reviewed"
            footer={footer}
            showBackButton={false}
        >
            <div className="pending-content">
                <div className="pending-icon">
                    <svg viewBox="0 0 64 64" fill="none" stroke="var(--gold)" strokeWidth="2">
                        <path d="M16 8h32M16 8v8a12 12 0 0012 12h8a12 12 0 0012-12V8M16 56h32M16 56v-8a12 12 0 0112-12h8a12 12 0 0112 12v8" />
                        <line x1="32" y1="28" x2="32" y2="36" stroke="var(--gold)" strokeWidth="2" />
                        <circle cx="32" cy="32" r="2" fill="var(--gold)" stroke="none" />
                    </svg>
                </div>

                <div className="pending-status">
                    <span className="pending-status__badge">Pending Review</span>
                </div>

                <div className="pending-info">
                    <p className="pending-info__text">
                        Teacher accounts require administrator approval before they can be activated.
                        This helps us ensure the platform is used safely for educational purposes.
                    </p>

                    <div className="pending-info__details">
                        <h4 className="pending-info__title">What happens next?</h4>
                        <ul className="pending-info__list">
                            <li>An administrator will review your account</li>
                            <li>You'll be redirected automatically once approved</li>
                            <li>This typically takes 1-2 business days</li>
                        </ul>
                    </div>
                </div>
            </div>
        </AuthShell>
    )
}

export default PendingApproval
