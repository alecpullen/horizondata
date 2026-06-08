import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { split } from '../utils/session'
import AppLogo from '../components/AppLogo'
import { useToast } from '../components/ui/ToastProvider'
import api from '../lib/api'
import './SessionLobby.css'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

function SessionLobby() {
    const { bookingId } = useParams()
    const navigate = useNavigate()
    const { showToast } = useToast()
    const [students, setStudents] = useState([])
    const [booking, setBooking] = useState(null)
    const [loading, setLoading] = useState(true)
    const [joinCode, setJoinCode] = useState('')
    const [sessionError, setSessionError] = useState('')
    const [starting, setStarting] = useState(false)



    // Fetch booking details and session info
    useEffect(() => {
        async function fetchBookingAndSession() {
            if (!bookingId) {
                setLoading(false)
                return
            }

            try {
                // Fetch booking details
                let bookingData = null
                try {
                    const bookingRes = await api.get(`/api/bookings/${bookingId}`)
                    bookingData = bookingRes.data
                    setBooking(bookingData)
                } catch {
                    // Fallback: find in list
                    try {
                        const listRes = await api.get('/api/bookings')
                        const allBookings = [
                            ...(listRes.data.upcoming || []),
                            ...(listRes.data.pending || [])
                        ]
                        const found = allBookings.find(b => String(b.id) === bookingId)
                        if (found) {
                            bookingData = found
                            setBooking(found)
                        }
                    } catch { /* ignore */ }
                }

                // Fetch or create session to get join code
                try {
                    const sessionRes = await api.get(`/api/sessions/${bookingId}`)
                    const sessionData = sessionRes.data
                    if (sessionData.success && sessionData.session?.joinCode) {
                        setJoinCode(sessionData.session.joinCode)
                        setSessionError('')
                    } else {
                        throw new Error('Session response missing join code')
                    }
                } catch (e) {
                    console.error('[Lobby] Session fetch failed:', e)
                    // Don't leave the code area silently blank — tell the
                    // teacher the join code couldn't be loaded and why.
                    const message = e.response?.data?.message
                        || 'Could not load the session join code. Please refresh or try again.'
                    setSessionError(message)
                    showToast({ type: 'error', message })
                }
            } catch (err) {
                console.error('Failed to fetch booking or session:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchBookingAndSession()
    }, [bookingId, showToast])

    // Poll for participants
    useEffect(() => {
        if (!bookingId) return

        async function fetchParticipants() {
            try {
                const res = await api.get(`/api/sessions/${bookingId}/participants`)
                const data = res.data
                if (data.success && data.participants) {
                    setStudents(data.participants)
                }
            } catch (err) {
                console.error('Failed to fetch participants:', err)
            }
        }

        // Initial fetch
        fetchParticipants()

        // Poll every 3 seconds
        const interval = setInterval(fetchParticipants, 3000)
        return () => clearInterval(interval)
    }, [bookingId])

    const handleBeginSession = async () => {
        if (starting) return
        setStarting(true)
        try {
            const res = await api.post(`/api/sessions/${bookingId}/start`)
            // Only go live once the backend confirms the session is active —
            // never navigate optimistically, or the teacher believes they're
            // live when no session was registered.
            if (res.data?.success) {
                navigate('/live/teacher', { state: { bookingId } })
            } else {
                showToast({ type: 'error', message: res.data?.message || 'Could not start the session. Please try again.' })
            }
        } catch (err) {
            console.error('Error starting session:', err)
            // Surface the backend's reason (e.g. "Session not available yet —
            // starts in 39h" or "This booking window has ended.").
            const message = err.response?.data?.message || 'Failed to start session. Please try again.'
            showToast({ type: 'error', message })
        } finally {
            setStarting(false)
        }
    }

    const digits = split(joinCode)

    // Format session info display
    const sessionInfo = booking
        ? `${booking.date} - ${booking.time} - HD-${booking.id}`
        : 'Loading session info...'

    const sessionTitle = booking?.title || 'Astronomy Session'

    return (
        <div className="lobby-shell">
            {/*header*/}
            <header className="lobby-header">
                <AppLogo />
                <div className="lobby-header-center">
                    <h1 className="lobby-session-title">{loading ? 'Loading...' : sessionTitle}</h1>
                    <div className="lobby-session-info">{sessionInfo}</div>
                </div>
                <button
                    type="button"
                    className="lobby-close-btn"
                    aria-label="Cancel and return to bookings"
                    onClick={() => navigate('/bookings')}
                >
                    ×
                </button>
            </header>

            <div className="lobby-body">
                <div className="lobby-left">
                    <div className="lobby-instruction">
                        Join at <strong>{APP_URL}</strong> and enter:
                    </div>
                    <div className="lobby-code">
                        {digits.map((digit, i) => (
                            <div key={i} className="lobby-code-tile">
                                {digit}
                            </div>
                        ))}
                    </div>
                    {!joinCode && sessionError && (
                        <div className="lobby-code-error" role="alert">{sessionError}</div>
                    )}

                    <div className="lobby-qr">
                        <div className="lobby-qr-box">
                            <QRCodeSVG value={`${APP_URL}/join${joinCode ? `?code=${joinCode}` : ''}`} size={160} />
                        </div>
                        <div className="lobby-qr-label">Scan to join</div>
                    </div>
                </div>

                <div className="lobby-divider" />

                <div className="lobby-right">
                    <div className="lobby-roster-heading">
                        <span>Students Joined</span>
                        <span className="lobby-count">{students.length}</span>
                    </div>

                    <ul className="lobby-roster">
                        {students.map(student => (
                            <li key={student.id} className="lobby-roster-item">
                                 <div className="lobby-student-avatar">
                                     {student.name?.[0] ?? '?'}
                                 </div>
                                <span className="lobby-student-name">{student.name}</span>
                                <span className="lobby-joined-tick">✔️</span>
                            </li>
                        ))}
                    </ul>

                    {students.length === 0 && (
                        <div className="lobby-empty">
                            Waiting for students to join...
                        </div>
                    )}
                </div>
            </div>

            {/*footer*/}
            <div className="lobby-footer">
                <div className="lobby-footer-left">
                    <div className="lobby-status">
                        <span className="lobby-status-dot" />
                        Session ready - waiting for students
                    </div>

                </div>
                <button
                    className="lobby-begin-btn"
                    onClick={handleBeginSession}
                    disabled={loading || starting}
                >
                    {starting ? 'Starting…' : 'Begin Session'}
                </button>
            </div>
        </div>
    )
}

export default SessionLobby
