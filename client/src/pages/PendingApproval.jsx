import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { useToast } from '../components/ui/ToastProvider'
import { useMockSession } from '../hooks/useLocalStorage'
import './PendingApproval.css'

function PendingApproval() {
    const { showToast } = useToast()
    const { logout, session } = useMockSession()

    const handleSignOut = () => {
        logout()
        showToast({
            type: 'info',
            message: 'Signed out successfully'
        })
        window.location.href = '/login'
    }

    const footer = (
        <>
            <button onClick={handleSignOut} className="pending-signout">
                Sign out
            </button>
        </>
    )

    return (
        <AuthShell
            title="Account pending approval"
            subtitle="Your teacher account is being reviewed"
            footer={footer}
            showBackButton={false}
        >
            <div className="pending-content">
                {/* Hourglass/Pending icon */}
                <div className="pending-icon">
                    <svg viewBox="0 0 64 64" fill="none" stroke="var(--gold)" strokeWidth="2">
                        <path d="M16 8h32M16 8v8a12 12 0 0012 12h8a12 12 0 0012-12V8M16 56h32M16 56v-8a12 12 0 0112-12h8a12 12 0 0112 12v8" />
                        <line x1="32" y1="28" x2="32" y2="36" stroke="var(--gold)" strokeWidth="2" />
                        <circle cx="32" cy="32" r="2" fill="var(--gold)" stroke="none" />
                    </svg>
                </div>

                {/* Status message */}
                <div className="pending-status">
                    <span className="pending-status__badge">Pending Review</span>
                </div>

                {/* Explanation */}
                <div className="pending-info">
                    <p className="pending-info__text">
                        Teacher accounts require administrator approval before they can be activated.
                        This helps us ensure the platform is used safely for educational purposes.
                    </p>

                    <div className="pending-info__details">
                        <h4 className="pending-info__title">What happens next?</h4>
                        <ul className="pending-info__list">
                            <li>An administrator will review your account</li>
                            <li>You'll receive an email at <strong>{session?.email || 'your email'}</strong> once approved</li>
                            <li>This typically takes 1-2 business days</li>
                        </ul>
                    </div>
                </div>

                {/* Contact link */}
                <p className="pending-contact">
                    Questions?{' '}
                    <Link to="/contact" className="auth-link">
                        Contact the administrator
                    </Link>
                </p>
            </div>
        </AuthShell>
    )
}

export default PendingApproval
