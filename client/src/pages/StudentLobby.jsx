import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import AppLogo from '../components/AppLogo'
import api from '../lib/api'
import './StudentLobby.css'

function StudentLobby() {
    const { bookingId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const studentName = location.state?.name || 'Student'

    const [error, setError] = useState('')

    useEffect(() => {
        if (!bookingId) return

        let cancelled = false

        async function poll() {
            try {
                const res = await api.get('/api/auth/student/session-info')
                if (cancelled) return

                setError('')
                const { status } = res.data

                if (status === 'active') {
                    navigate(`/live/student?bookingId=${bookingId}`, { replace: true })
                } else if (status === 'ended') {
                    navigate('/join', { replace: true, state: { ended: true } })
                }
            } catch (err) {
                if (cancelled) return
                if (err.response?.status === 401) {
                    navigate('/join', { replace: true, state: { ended: true } })
                } else {
                    setError('Lost connection to session. Please rejoin.')
                }
            }
        }

        poll()
        const interval = setInterval(poll, 3000)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [bookingId, navigate])

    return (
        <div className="slob-shell">
            <div className="slob-blob slob-blob--1" />
            <div className="slob-blob slob-blob--2" />

            <div className="slob-card">
                <AppLogo />

                <div className="slob-spinner" aria-hidden="true" />

                <h1 className="slob-heading">You're in, {studentName}!</h1>
                <p className="slob-sub">
                    Waiting for your teacher to start the session.
                    Hang tight while the rest of the class joins.
                </p>

                {error && <div className="slob-error">{error}</div>}

                <button
                    type="button"
                    className="slob-leave-btn"
                    onClick={() => navigate('/join', { replace: true })}
                >
                    Leave
                </button>
            </div>
        </div>
    )
}

export default StudentLobby
