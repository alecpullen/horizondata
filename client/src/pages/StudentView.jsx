import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StreamView from '../components/StreamView'
import AppLogo from '../components/AppLogo'
import { useToast } from '../components/ui/ToastProvider'
import './StudentView.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const SESSION = {
    object:      'Saturn',
    description: 'The sixth planet from the Sun, famous for its stunning ring system made of ice and rock.',
    funFact:     'Saturn\'s rings are mostly made of ice chunks ranging from tiny grains to pieces as big as a house.',
}

const STUDENT = {
    name: 'Student A',
}

function StudentView() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const bookingId = searchParams.get('bookingId')
    const { showToast } = useToast()

    const streamRef = useRef(null)
    const [capturing, setCapturing] = useState(false)
    const [captureCount, setCaptureCount] = useState(0)

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

    const handleCapture = useCallback(async () => {
        const video = streamRef.current
        if (!video || video.readyState < 2) {
            showToast({ type: 'error', message: 'Stream must be active to capture an image.' })
            return
        }

        const sessionId = localStorage.getItem('sessionId')
        if (!sessionId) {
            showToast({ type: 'error', message: 'Session expired. Please rejoin.' })
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

            const res = await fetch(`${API_BASE}/api/captures`, {
                method: 'POST',
                headers: { 'X-Session-ID': sessionId },
                body: formData,
            })

            if (res.status === 429) {
                const data = await res.json()
                showToast({ type: 'error', message: data.message || 'Too many captures. Please wait a moment.' })
                return
            }

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                showToast({ type: 'error', message: data.message || 'Capture failed. Please try again.' })
                return
            }

            setCaptureCount(c => c + 1)
            showToast({ type: 'success', message: 'Image captured successfully.' })
        } catch {
            showToast({ type: 'error', message: 'Capture failed. Please try again.' })
        } finally {
            setCapturing(false)
        }
    }, [bookingId, showToast])

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
                    <span className="sv-capture-count">{captureCount} captures</span>
                    <div className="sv-avatar">{STUDENT.name[0]}</div>
                </div>
            </header>

            <div className="sv-feed-area">
                <StreamView ref={streamRef} label="Primary · Telescope Feed" />

                <div className="sv-object-overlay">
                    <div className="sv-object-name">{SESSION.object}</div>
                    <div className="sv-object-desc">{SESSION.description}</div>
                    <div className="sv-fun-fact">{SESSION.funFact}</div>
                </div>
            </div>

            <div className="sv-actions">
                <button
                    className="sv-capture-btn"
                    onClick={handleCapture}
                    disabled={capturing}
                >
                    {capturing ? 'Capturing…' : 'Capture Image'}
                </button>
            </div>

        </div>
    )
}

export default StudentView
