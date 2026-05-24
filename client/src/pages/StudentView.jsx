import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StreamView from '../components/StreamView'
import AppLogo from '../components/AppLogo'
import { useToast } from '../components/ui/ToastProvider'
import api from '../lib/api'
import './StudentView.css'

function StudentView() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const bookingId = searchParams.get('bookingId')
    const { showToast } = useToast()

    const studentName = JSON.parse(localStorage.getItem('user') || '{}')?.display_name || 'Student'

    const streamRef = useRef(null)
    const [capturing, setCapturing] = useState(false)
    const [captureCount, setCaptureCount] = useState(0)
    const [streamUrls, setStreamUrls] = useState({ webrtc: null, hls: null })
    const [objectName, setObjectName] = useState('')

    // Fetch stream settings
    useEffect(() => {
        let cancelled = false
        api.get('/api/settings')
            .then(res => {
                if (!cancelled) {
                    setStreamUrls({
                        webrtc: res.data.primary_stream_webrtc_url || null,
                        hls: res.data.primary_stream_url || null,
                    })
                }
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [])

    // Fetch session info (object name) + poll for session end
    useEffect(() => {
        if (!bookingId) return

        let cancelled = false

        async function fetchInfo() {
            try {
                const res = await api.get('/api/auth/student/session-info')
                if (cancelled) return
                if (res.data.booking_title) {
                    setObjectName(res.data.booking_title)
                }
                if (res.data.status === 'ended') {
                    navigate('/join', { replace: true, state: { ended: true } })
                }
            } catch (err) {
                if (cancelled) return
                if (err.response?.status === 401) {
                    navigate('/join', { replace: true, state: { ended: true } })
                }
            }
        }

        fetchInfo()
        const interval = setInterval(fetchInfo, 5000)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
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
            formData.append('objectName', objectName || 'Unknown')
            formData.append('timestamp', ts)
            if (bookingId) formData.append('observationSessionId', bookingId)

            const res = await api.post('/api/captures', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                validateStatus: null,
            })

            if (res.status === 429) {
                showToast({ type: 'error', message: res.data?.message || 'Too many captures. Please wait a moment.' })
                return
            }

            if (res.status < 200 || res.status >= 300) {
                showToast({ type: 'error', message: res.data?.message || 'Capture failed. Please try again.' })
                return
            }

            setCaptureCount(c => c + 1)
            showToast({ type: 'success', message: 'Image captured successfully.' })
        } catch {
            showToast({ type: 'error', message: 'Capture failed. Please try again.' })
        } finally {
            setCapturing(false)
        }
    }, [bookingId, objectName, showToast])

    return (
        <div className="sv-shell">
            <header className="sv-topbar">
                <div className="sv-topbar-left">
                    <AppLogo />
                </div>
                <div className="sv-session-info">
                    {objectName ? <>Observing <strong>{objectName}</strong></> : 'Loading session…'}
                </div>
                <div className="sv-topbar-right">
                    <span className="sv-capture-count">{captureCount} captures</span>
                    <div className="sv-avatar">{studentName[0]?.toUpperCase()}</div>
                </div>
            </header>

            <div className="sv-feed-area">
                <StreamView
                    ref={streamRef}
                    label="Primary · Telescope Feed"
                    webrtcUrl={streamUrls.webrtc}
                    hlsUrl={streamUrls.hls}
                />

                {objectName && (
                    <div className="sv-object-overlay">
                        <div className="sv-object-name">{objectName}</div>
                    </div>
                )}
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
