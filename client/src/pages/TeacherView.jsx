import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import TopBar from '../components/TopBar'
import StreamView from '../components/StreamView'
import WeatherWidget from '../components/WeatherWidget'
import { useToast } from '../components/ui/ToastProvider'
import api from '../lib/api'
import './TeacherView.css'

const SESSION = {
    date:      'Sun 22 Aug 2026',
    time:      '20:00 – 20:10 AEST',
    ref:       'HD-2026-0841',
    object:    'Saturn',
    telescope: 'Bundoora',
}

const STUDENTS = [
    { id: 1, name: 'Student A' },
    { id: 2, name: 'Student B' },
    { id: 3, name: 'Student C' },
    { id: 4, name: 'Student D'},
    { id: 5, name: 'Student E'},
]

async function downloadFile(url, fallbackName) {
    const res = await api.get(url, { responseType: 'blob' })
    const href = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = href
    a.download = fallbackName
    a.click()
    URL.revokeObjectURL(href)
}

function TeacherView() {
    const navigate = useNavigate()
    const { state } = useLocation()
    const bookingId = state?.bookingId
    const { showToast } = useToast()

    const [ending, setEnding] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const [lastCapture, setLastCapture] = useState(null) // { id, ts }

    const primaryStreamRef = useRef(null)

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
            formData.append('objectName', SESSION.object)
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
                    <StreamView ref={primaryStreamRef} label="Primary · Telescope Feed" />
                    <div className="tv-pip">
                        <StreamView label="Site Camera" />
                    </div>
                </div>

                {/*sidebar*/}
                <aside className="tv-sidebar">

                    {/*session info*/}
                    <div className="tv-sidebar-section">
                        <div className="tv-sidebar-label">Session</div>
                        <div className="tv-session-ref">{SESSION.ref}</div>
                        <div className="tv-session-date">{SESSION.date}</div>
                        <div className="tv-session-time">{SESSION.time}</div>
                    </div>

                    {/*current object*/}
                    <div className="tv-sidebar-section">
                        <div className="tv-sidebar-label">Current Object</div>
                        <div className="tv-object-name">{SESSION.object}</div>
                        <div className="tv-object-scope">{SESSION.telescope}</div>
                    </div>

                    {/*conditions*/}
                    <WeatherWidget />

                    {/*students in session */}
                    <div className="tv-sidebar-section tv-sidebar-section--grow">
                        <div className="tv-sidebar-label">
                            Students in Session — {STUDENTS.length}
                        </div>
                        <ul className="tv-student-list">
                            {STUDENTS.map(student => (
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
                                    onClick={() => downloadFile(
                                        `/api/captures/${lastCapture.id}/download`,
                                        `${SESSION.object}_${lastCapture.id}.png`
                                    )}
                                >
                                    Download Image
                                </button>
                                <button
                                    className="tv-btn tv-btn--secondary"
                                    onClick={() => downloadFile(
                                        `/api/captures/${lastCapture.id}/metadata`,
                                        `${SESSION.object}_${lastCapture.id}.json`
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
