import { Component, useState, useCallback, useEffect, useRef, forwardRef } from 'react'
import { useWhepStream } from '../hooks/useWhepStream'
import { useHlsStream } from '../hooks/useHlsStream'
import './StreamView.css'

// ── Error Boundary ──────────────────────────────────────────────────────────
class StreamErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { caught: false }
    }

    static getDerivedStateFromError() {
        return { caught: true }
    }

    render() {
        if (this.state.caught) {
            return (
                <StreamOffline
                    label={this.props.label}
                    onRetry={() => this.setState({ caught: false })}
                />
            )
        }
        return this.props.children
    }
}

// ── Offline placeholder ─────────────────────────────────────────────────────
function StreamOffline({ label, onRetry }) {
    return (
        <div className="stream-container stream-container--offline">
            <div className="stream-offline">
                <div className="stream-offline-icon">⚠</div>
                <div className="stream-offline-msg">Stream unavailable</div>
                {onRetry && (
                    <button className="stream-retry-btn" onClick={onRetry}>
                        Retry
                    </button>
                )}
            </div>
            <div className="stream-label">{label}</div>
        </div>
    )
}

// ── WebRTC (WHEP) player ────────────────────────────────────────────────────
function WhepVideo({ label, url, videoRef, onFailed }) {
    const { status } = useWhepStream(url, videoRef)

    useEffect(() => {
        if (status === 'failed') onFailed()
    }, [status, onFailed])

    if (status === 'failed') return null

    return (
        <div className="stream-container">
            <video
                ref={videoRef}
                className="stream-video"
                autoPlay
                muted
                playsInline
            />
            <div className="stream-label">{label}</div>
        </div>
    )
}

// ── HLS player ──────────────────────────────────────────────────────────────
function HlsVideo({ label, url, videoRef }) {
    const internalRef = useRef(null)
    const ref = videoRef || internalRef
    const { status } = useHlsStream(url, ref)

    if (status === 'failed') {
        return <StreamOffline label={label} />
    }

    return (
        <div className="stream-container">
            <video
                ref={ref}
                className="stream-video"
                autoPlay
                muted
                playsInline
            />
            <div className="stream-label">{label}</div>
            <div className="stream-protocol-badge">HLS</div>
        </div>
    )
}

// ── Protocol switcher ───────────────────────────────────────────────────────
function StreamVideo({ label, webrtcUrl, hlsUrl, videoRef }) {
    const internalRef = useRef(null)
    const ref = videoRef || internalRef
    const [useHls, setUseHls] = useState(!webrtcUrl)

    const handleWebRtcFailed = useCallback(() => {
        if (hlsUrl) setUseHls(true)
    }, [hlsUrl])

    if (!useHls && webrtcUrl) {
        return (
            <WhepVideo
                label={label}
                url={webrtcUrl}
                videoRef={ref}
                onFailed={handleWebRtcFailed}
            />
        )
    }

    if (hlsUrl) {
        return <HlsVideo label={label} url={hlsUrl} videoRef={ref} />
    }

    return <StreamOffline label={label} />
}

// ── Public component ────────────────────────────────────────────────────────
const StreamView = forwardRef(function StreamView(
    { label = 'Stream', webrtcUrl = null, hlsUrl = null },
    ref
) {
    if (!webrtcUrl && !hlsUrl) {
        return <StreamOffline label={label} />
    }

    return (
        <StreamErrorBoundary label={label}>
            <StreamVideo label={label} webrtcUrl={webrtcUrl} hlsUrl={hlsUrl} videoRef={ref} />
        </StreamErrorBoundary>
    )
})

export default StreamView
