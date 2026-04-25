import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { split } from '../utils/session'
import AppLogo from '../components/AppLogo'
import api from '../lib/api'
import './SessionLobby.css'

function SessionLobby() {
    const { bookingId } = useParams()
    const navigate = useNavigate()
    const [students, setStudents] = useState([])
    const [booking, setBooking] = useState(null)
    const [loading, setLoading] = useState(true)
    const [joinCode, setJoinCode] = useState('')

    // MSW toggle state - synced with localStorage
    const [mswEnabled, setMswEnabled] = useState(() => {
        const stored = localStorage.getItem('msw-enabled')
        return stored === null ? false : stored === 'true'
    })

    // Persist MSW toggle state and reload to apply changes
    useEffect(() => {
        const prev = localStorage.getItem('msw-enabled')
        const next = mswEnabled.toString()
        if (prev !== null && prev !== next) {
            localStorage.setItem('msw-enabled', next)
            window.location.reload()
        } else {
            localStorage.setItem('msw-enabled', next)
        }
    }, [mswEnabled])

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
                console.log('[Lobby] Fetching session for bookingId:', bookingId)
                try {
                    const sessionRes = await api.get(`/api/sessions/${bookingId}`)
                    const sessionData = sessionRes.data
                    console.log('[Lobby] Session data:', sessionData)
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
                console.log('[Lobby] Fetching participants for bookingId:', bookingId)
                const res = await api.get(`/api/sessions/${bookingId}/participants`)
                const data = res.data
                console.log('[Lobby] Participants data:', data)
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
        } catch (err) {
            console.error('Error starting session:', err)
        }
        navigate('/live/teacher')
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
                        Join at <strong>https://URL</strong> and enter:
                    </div>
                    <div className="lobby-code">
                        {digits.map((digit, i) => (
                            <div key={i} className="lobby-code-tile">
                                {digit}
                            </div>
                        ))}
                    </div>

                    {/*TODO QR code*/}
                    <div className="lobby-qr">
                        <div className="lobby-qr-box">
                            <div className="lobby-qr-inner">QR</div>
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
                                    {student.name[0]}
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
                    {/* Mock API Toggle */}
                    <label className="lobby-msw-toggle" title="Toggle mock API">
                        <span className="lobby-msw-label">Mock API</span>
                        <input
                            type="checkbox"
                            checked={mswEnabled}
                            onChange={(e) => setMswEnabled(e.target.checked)}
                        />
                        <span className="lobby-msw-slider" />
                    </label>
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
