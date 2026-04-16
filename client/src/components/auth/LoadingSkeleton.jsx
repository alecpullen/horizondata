import './LoadingSkeleton.css'

function LoadingSkeleton() {
    return (
        <div className="skeleton-shell">
            {/* Ambient background blobs (same as auth pages) */}
            <div className="skeleton-blob skeleton-blob--1" />
            <div className="skeleton-blob skeleton-blob--2" />

            <div className="skeleton-content">
                {/* Logo shimmer */}
                <div className="skeleton-logo">
                    <div className="skeleton-shimmer" />
                </div>

                {/* Card shimmer */}
                <div className="skeleton-card">
                    {/* Title */}
                    <div className="skeleton-title">
                        <div className="skeleton-shimmer" />
                    </div>

                    {/* Subtitle */}
                    <div className="skeleton-subtitle">
                        <div className="skeleton-shimmer" />
                    </div>

                    {/* Form fields */}
                    <div className="skeleton-field">
                        <div className="skeleton-label">
                            <div className="skeleton-shimmer" />
                        </div>
                        <div className="skeleton-input">
                            <div className="skeleton-shimmer" />
                        </div>
                    </div>

                    <div className="skeleton-field">
                        <div className="skeleton-label">
                            <div className="skeleton-shimmer" />
                        </div>
                        <div className="skeleton-input">
                            <div className="skeleton-shimmer" />
                        </div>
                    </div>

                    {/* Checkbox */}
                    <div className="skeleton-checkbox">
                        <div className="skeleton-checkbox__box">
                            <div className="skeleton-shimmer" />
                        </div>
                        <div className="skeleton-checkbox__text">
                            <div className="skeleton-shimmer" />
                        </div>
                    </div>

                    {/* Button */}
                    <div className="skeleton-button">
                        <div className="skeleton-shimmer" />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoadingSkeleton
