import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import TopBar from '../components/TopBar'
import StreamView from '../components/StreamView'
import WeatherWidget from '../components/WeatherWidget'
import { useToast } from '../components/ui/ToastProvider'
import api from '../lib/api'
import './TeacherView.css'

async function downloadFile(url, fallbackName) {
    const res = await api.get(url, { responseType: 'blob' })
    const href = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = href
    a.download = fallbackName
    a.click()
    URL.revokeObjectURL(href)
}

async function safeDownload(url, name, showToast) {
    try {
        await downloadFile(url, name)
    } catch {
        showToast({ type: 'error', message: 'Download failed. Please try again.' })
    }
}

function TeacherView() {
    const navigate = useNavigate()
    const { state } = useLocation()
    const bookingId = state?.bookingId
    const { showToast } = useToast()

    const [ending, setEnding] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const [lastCapture, setLastCapture] = useState(null) // { id, ts }
    const [booking, setBooking] = useState(null)
    const [session, setSession] = useState(null)
    const [participants, setParticipants] = useState([])

    const primaryStreamRef = useRef(null)
    const [streamUrls, setStreamUrls] = useState({
        primaryWebrtc: null,
        primaryHls: null,
        siteWebrtc: null,
        siteHls: null,
    })

    // Fetch stream settings
    useEffect(() => {
        api.get('/api/settings')
            .then(res => {
                setStreamUrls({
                    primaryWebrtc: res.data.primary_stream_webrtc_url || null,
                    primaryHls: res.data.primary_stream_url || null,
                    siteWebrtc: res.data.site_camera_webrtc_url || null,
                    siteHls: res.data.site_camera_url || null,
                })
            })
            .catch(err => console.error('Failed to load stream settings:', err))
    }, [])

    // Fetch booking data
    useEffect(() => {
        if (!bookingId) return
        api.get(`/api/bookings/${bookingId}`)
            .then(res => setBooking(res.data))
            .catch(err => console.error('Failed to load booking:', err))
    }, [bookingId])

    // Fetch session for joinCode
    useEffect(() => {
        if (!bookingId) return
        api.get(`/api/sessions/${bookingId}`)
            .then(res => setSession(res.data.session))
            .catch(err => console.error('Failed to load session:', err))
    }, [bookingId])

    // Poll participants every 10 s
    useEffect(() => {
        if (!bookingId) return
        const fetchParticipants = () => {
            api.get(`/api/sessions/${bookingId}/participants`)
                .then(res => setParticipants(res.data.participants || []))
                .catch(() => {})
        }
        fetchParticipants()
        const intervalId = setInterval(fetchParticipants, 10000)
        return () => clearInterval(intervalId)
    }, [bookingId])

    const handleCapture = async () => {
        const video = primaryStreamRef.current
        if (!video || video.readyState < 2) {
            showToast({ type: 'error', message: 'Stream must be active to capture an image.' })
            return
        }

        setCapturing(true)
        try {
            const canvas = document.createElement('canvas')
            canvas.width = video.videoWidth || 1920
            canvas.height = video.videoHeight || 1080
            canvas.getContext('2d').drawImage(video, 0, 0)

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
            const ts = new Date().toISOString()
            const formData = new FormData()
            formData.append('file', blob, `capture_${Date.now()}.png`)
            formData.append('objectName', booking?.title || 'Unknown')
            formData.append('timestamp', ts)
            if (bookingId) formData.append('observationSessionId', bookingId)

            const { data } = await api.post('/api/captures', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })

            setLastCapture({ id: data.id, ts })
            showToast({ type: 'success', message: 'Image captured successfully.' })
        } catch (err) {
            const msg = err.response?.data?.message || 'Capture failed. Please try again.'
            showToast({ type: 'error', message: msg })
        } finally {
            setCapturing(false)
        }
    }

    const handleEndSession = async () => {
        if (!bookingId || ending) return
        setEnding(true)
        try {
            await api.post(`/api/sessions/${bookingId}/end`)
        } catch (err) {
            console.error('Failed to end session:', err)
        } finally {
            setEnding(false)
            navigate('/bookings')
        }
    }

    return (
        <div className="tv-shell">
            <TopBar activePath="/live/teacher" />
            <div className="tv-body">
                <div className="tv-feed-area">
                    <StreamView
                        ref={primaryStreamRef}
                        label="Primary · Telescope Feed"
                        webrtcUrl={streamUrls.primaryWebrtc}
                        hlsUrl={streamUrls.primaryHls}
                    />
                    <div className="tv-pip">
                        <StreamView
                            label="Site Camera"
                            webrtcUrl={streamUrls.siteWebrtc}
                            hlsUrl={streamUrls.siteHls}
                        />
                    </div>
                </div>

                {/*sidebar*/}
                <aside className="tv-sidebar">

                    {/*session info*/}
                    <div className="tv-sidebar-section">
                        <div className="tv-sidebar-label">Session</div>
                        <div className="tv-session-ref">{session?.joinCode ?? '—'}</div>
                        <div className="tv-session-date">{booking?.date ?? '—'}</div>
                        <div className="tv-session-time">{booking?.time ?? '—'}</div>
                    </div>

                    {/*current object*/}
                    <div className="tv-sidebar-section">
                        <div className="tv-sidebar-label">Current Object</div>
                        <div className="tv-object-name">{booking?.title ?? 'Unknown'}</div>
                        <div className="tv-object-scope">Horizon Telescope</div>
                    </div>

                    {/*conditions*/}
                    <WeatherWidget />

                    {/*students in session */}
                    <div className="tv-sidebar-section tv-sidebar-section--grow">
                        <div className="tv-sidebar-label">
                            Students in Session — {participants.length}
                        </div>
                        <ul className="tv-student-list">
                            {participants.map(student => (
                                <li key={student.id} className="tv-student-item">
                                    <div className="student-avatar">
                                        {student.name[0]}
                                    </div>
                                    <span className="student-name">{student.name}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/*buttons*/}
                    <div className="tv-sidebar-section tv-actions">
                        <button
                            className="tv-btn tv-btn--capture"
                            onClick={handleCapture}
                            disabled={capturing}
                        >
                            {capturing ? 'Capturing…' : 'Capture Image'}
                        </button>
                        <button
                            className="tv-btn tv-btn--danger"
                            onClick={handleEndSession}
                            disabled={ending}
                        >
                            {ending ? 'Ending…' : 'End Session'}
                        </button>
                    </div>

                    {/*last capture downloads*/}
                    {lastCapture && (
                        <div className="tv-sidebar-section tv-last-capture">
                            <div className="tv-sidebar-label">Last Capture</div>
                            <div className="tv-last-capture-time">
                                {new Date(lastCapture.ts).toLocaleTimeString()}
                            </div>
                            <div className="tv-last-capture-actions">
                                <button
                                    className="tv-btn tv-btn--secondary"
                                    onClick={() => safeDownload(
                                        `/api/captures/${lastCapture.id}/download`,
                                        `${booking?.title ?? 'capture'}_${lastCapture.id}.png`,
                                        showToast
                                    )}
                                >
                                    Download Image
                                </button>
                                <button
                                    className="tv-btn tv-btn--secondary"
                                    onClick={() => safeDownload(
                                        `/api/captures/${lastCapture.id}/metadata`,
                                        `${booking?.title ?? 'capture'}_${lastCapture.id}.json`,
                                        showToast
                                    )}
                                >
                                    Download Metadata
                                </button>
                            </div>
                        </div>
                    )}

                </aside>
            </div>
        </div>
    )
}

export default TeacherView
