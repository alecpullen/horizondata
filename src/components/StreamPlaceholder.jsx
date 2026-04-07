import './StreamPlaceholder.css'

function StreamPlaceholder({ label = 'Stream', streamUrl = null }) {

    if (streamUrl) {
        return (
            <div className="stream-container">
                <video
                    className="stream-video"
                    src={streamUrl}
                    autoPlay
                    muted
                    playsInline
                />
                <div className="stream-label">{label}</div>
            </div>
        )
    }

    return (
        <div className="stream-container stream-container--offline">
            <div className="stream-offline">
                <div className="stream-offline-icon">⚠</div>
                <div className="stream-offline-msg">No connection</div>
                <div className="stream-offline-sub">Stream unavailable at this time</div>
            </div>
            <div className="stream-label">{label}</div>
        </div>
    )
}

export default StreamPlaceholder