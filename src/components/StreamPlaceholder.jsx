import './StreamPlaceholder.css'

function StreamPlaceholder({ label = 'Stream', streamUrl = null}) {
    if (streamUrl) {
        return (
            <div clasName="stream-container">
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
        <div className="stream-container placeholder">
            <div className="'placeholder-inner">
                <div className="placeholder-icon">icon</div>
                <div className="placeholder-lanel">{label}</div>
                <div className="placeholder-sub">Stream not connected</div>
            </div>
            <div className="stream-label">{label}</div>
        </div>
    )
}

export default StreamPlaceholder