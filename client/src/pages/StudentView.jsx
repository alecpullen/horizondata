import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StreamView from '../components/StreamView'
import AppLogo from '../components/AppLogo'
import './StudentView.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const SESSION = {
    object:      'Saturn',
    description: 'The sixth planet from the Sun, famous for its stunning ring system made of ice and rock.',
    funFact:     'Saturn\'s rings are mostly made of ice chunks ranging from tiny grains to pieces as big as a house.',
}

const STUDENT = {
    name:         'Student A',
    captureCount:  2,
}

function StudentView() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const bookingId = searchParams.get('bookingId')

    useEffect(() => {
        if (!bookingId) return
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/sessions/${bookingId}`, {
                    headers: { Accept: 'application/json' },
                })
                const data = await res.json()
                if (data.session?.status === 'ended') {
                    navigate('/join', { replace: true, state: { ended: true } })
                }
            } catch { /* ignore network errors */ }
        }, 5000)
        return () => clearInterval(interval)
    }, [bookingId, navigate])

    return (
        <div className="sv-shell">
            <header className="sv-topbar">
                <div className="sv-topbar-left">
                    <AppLogo />
                </div>
                <div className="sv-session-info">
                    Observing <strong>{SESSION.object}</strong>
                </div>
                <div className="sv-topbar-right">
                    <span className="sv-capture-count">{STUDENT.captureCount} captures</span>
                    <div className="sv-avatar">{STUDENT.name[0]}</div>
                </div>
            </header>

            <div className="sv-feed-area">
                <StreamView label="Primary · Telescope Feed" />

                <div className="sv-object-overlay">
                    <div className="sv-object-name">{SESSION.object}</div>
                    <div className="sv-object-desc">{SESSION.description}</div>
                    <div className="sv-fun-fact">{SESSION.funFact}</div>
                </div>
            </div>

            <div className="sv-actions">
                <button className="sv-capture-btn">
                    Capture Image
                </button>
            </div>

        </div>
    )
}

export default StudentView
