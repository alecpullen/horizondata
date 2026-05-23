import { useState, useRef, useEffect } from 'react'
import StreamView from '../components/StreamView'
import WeatherWidget from '../components/WeatherWidget'
import AppLogo from '../components/AppLogo'
import api from '../lib/api'
import './PublicView.css'

function PipControls({ onResizeMouseDown }) {
    return (
        <>
            <div className="pv-pip-hover-overlay">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
            </div>
            <div className="pv-pip-resize-handle" onMouseDown={onResizeMouseDown} />
        </>
    )
}

function PublicView() {
    const [swapped, setSwapped] = useState(false)
    const [pipSize, setPipSize] = useState({ w: 240, h: 148 })
    const isResizingRef = useRef(false)

    const [streamUrls, setStreamUrls] = useState({
        primaryWebrtc: null,
        primaryHls: null,
        siteWebrtc: null,
        siteHls: null,
    })

    // Fetch stream URLs from settings (same endpoint as TeacherView)
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

    function handleSwap() {
        if (!isResizingRef.current) setSwapped(s => !s)
    }

    function handleResizeMouseDown(e) {
        e.stopPropagation()
        e.preventDefault()
        isResizingRef.current = true

        const pipEl = e.currentTarget.parentElement
        pipEl.style.transition = 'none'

        const startX = e.clientX
        const startY = e.clientY
        const startW = pipSize.w
        const startH = pipSize.h

        function onMove(ev) {
            pipEl.style.width  = Math.max(160, Math.min(480, startW + (ev.clientX - startX))) + 'px'
            pipEl.style.height = Math.max(100, Math.min(300, startH - (ev.clientY - startY))) + 'px'
        }

        function onUp() {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            pipEl.style.transition = ''
            setPipSize({
                w: parseFloat(pipEl.style.width)  || startW,
                h: parseFloat(pipEl.style.height) || startH,
            })
            setTimeout(() => { isResizingRef.current = false }, 50)
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }

    return (
        <div className="pv-shell">
            {/* Minimal top bar — logo + "Live View" label only */}
            <header className="pv-header">
                <AppLogo />
                <div className="pv-header-badge">
                    <span className="pv-live-dot" />
                    Live Telescope
                </div>
                <a href="/login" className="pv-signin-link">Sign in</a>
            </header>

            <div className="pv-body">
                {/* Feed area — same PiP/swap behaviour as TeacherView */}
                <div className="pv-feed-area">
                    {/* Telescope — primary feed */}
                    <div
                        className={`pv-feed-wrapper ${swapped ? 'pv-feed-wrapper--pip' : 'pv-feed-wrapper--primary'}`}
                        style={swapped ? { width: pipSize.w, height: pipSize.h } : undefined}
                        onClick={swapped ? handleSwap : undefined}
                    >
                        <StreamView
                            label="Primary · Telescope Feed"
                            webrtcUrl={streamUrls.primaryWebrtc}
                            hlsUrl={streamUrls.primaryHls}
                        />
                        {swapped && <PipControls onResizeMouseDown={handleResizeMouseDown} />}
                    </div>

                    {/* Site / all-sky camera */}
                    <div
                        className={`pv-feed-wrapper ${swapped ? 'pv-feed-wrapper--primary' : 'pv-feed-wrapper--pip'}`}
                        style={!swapped ? { width: pipSize.w, height: pipSize.h } : undefined}
                        onClick={!swapped ? handleSwap : undefined}
                    >
                        <StreamView
                            label="Site Camera"
                            webrtcUrl={streamUrls.siteWebrtc}
                            hlsUrl={streamUrls.siteHls}
                        />
                        {!swapped && <PipControls onResizeMouseDown={handleResizeMouseDown} />}
                    </div>
                </div>

                {/* Slim sidebar — conditions only */}
                <aside className="pv-sidebar">
                    <div className="pv-sidebar-section">
                        <div className="pv-sidebar-label">Telescope</div>
                        <div className="pv-scope-name">Horizon Telescope</div>
                        <div className="pv-scope-sub">La Trobe University · Melbourne, AU</div>
                    </div>

                    <WeatherWidget />

                    <div className="pv-sidebar-section pv-cta-section">
                        <p className="pv-cta-text">
                            Want to book a live session or capture images?
                        </p>
                        <a href="/login" className="pv-cta-btn">
                            Sign in to get started
                        </a>
                    </div>
                </aside>
            </div>
        </div>
    )
}

export default PublicView
