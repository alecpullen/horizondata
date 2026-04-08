import { Component, useState, useCallback } from 'react'
import './StreamView.css'

// ── Error Boundary ──────────────────────────────────────────────────────────
// Catches unexpected JS errors inside a stream so one failure cannot unmount
// or crash sibling streams.
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

// ── Live video player ───────────────────────────────────────────────────────
function StreamVideo({ label, streamUrl }) {
    const [failed, setFailed] = useState(false)
    const [retryKey, setRetryKey] = useState(0)

    const handleError = useCallback(() => setFailed(true), [])

    const handleRetry = useCallback(() => {
        setFailed(false)
        setRetryKey(k => k + 1)
    }, [])

    if (failed) {
        return <StreamOffline label={label} onRetry={handleRetry} />
    }

    return (
        <div className="stream-container">
            <video
                key={retryKey}
                className="stream-video"
                src={streamUrl}
                autoPlay
                muted
                playsInline
                onError={handleError}
            />
            <div className="stream-label">{label}</div>
        </div>
    )
}

// ── Public component ────────────────────────────────────────────────────────
function StreamView({ label = 'Stream', streamUrl = null }) {
    if (!streamUrl) {
        return <StreamOffline label={label} />
    }

    return (
        <StreamErrorBoundary label={label}>
            <StreamVideo label={label} streamUrl={streamUrl} />
        </StreamErrorBoundary>
    )
}

export default StreamView
