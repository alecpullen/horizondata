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
                    if (sessionData.success && sessionData.session) {
                        setJoinCode(sessionData.session.joinCode)
                    }
                } catch (e) {
                    console.error('[Lobby] Session fetch failed:', e)
                }
            } catch (err) {
                console.error('Failed to fetch booking or session:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchBookingAndSession()
    }, [bookingId])

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
        try {
            await api.post(`/api/sessions/${bookingId}/start`)
            navigate('/live/teacher', { state: { bookingId } })
        } catch (err) {
            console.error('Error starting session:', err)
            showToast({ type: 'error', message: 'Failed to start session. Please try again.' })
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
                    disabled={loading}
                >
                    Begin Session
                </button>
            </div>
        </div>
    )
}

export default SessionLobby
