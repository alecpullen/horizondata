function Step3Confirm({
    selectedTarget,
    sessionDate,
    startTime,
    endTime,
    sessionTitle,
    setSessionTitle,
    sessionDescription,
    setSessionDescription
}) {
    // Format date for display
    const formatDate = (dateStr) => {
        if (!dateStr) return 'Not selected'
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    // Format time for display
    const formatTime = (timeStr) => {
        if (!timeStr) return '--:--'
        return timeStr
    }

    return (
        <div className="step-3">
            <div className="confirm-form">
                {/* Session Details */}
                <div className="confirm-section">
                    <h3 className="confirm-section-title">Session Details</h3>
                    <div className="form-field">
                        <label className="form-label">Session Title</label>
                        <input
                            type="text"
                            className="form-input"
                            value={sessionTitle}
                            onChange={(e) => setSessionTitle(e.target.value)}
                            placeholder="Enter a name for this session"
                            required
                        />
                        <span className="form-hint">This will be shown to students joining the session</span>
                    </div>

                    <div className="form-field">
                        <label className="form-label">Description (Optional)</label>
                        <textarea
                            className="form-textarea"
                            value={sessionDescription}
                            onChange={(e) => setSessionDescription(e.target.value)}
                            placeholder="Add notes about learning objectives, activities, or special requirements..."
                            rows={4}
                        />
                    </div>
                </div>

                {/* Booking Summary */}
                <div className="confirm-section">
                    <h3 className="confirm-section-title">Booking Summary</h3>

                    <div className="summary-card">
                        <div className="summary-item summary-item--target">
                            <span className="summary-label">Target</span>
                            <div className="summary-value">
                                <strong>{selectedTarget?.name}</strong>
                                <span className={`type-badge type-badge--${selectedTarget?.type?.toLowerCase() || 'unknown'}`}>
                                    {selectedTarget?.type || 'Unknown'}
                                </span>
                            </div>
                        </div>

                        {selectedTarget?.constellation && (
                            <div className="summary-item">
                                <span className="summary-label">Constellation</span>
                                <span className="summary-value">{selectedTarget.constellation}</span>
                            </div>
                        )}

                        {selectedTarget?.magnitude !== undefined && (
                            <div className="summary-item">
                                <span className="summary-label">Magnitude</span>
                                <span className="summary-value">{selectedTarget.magnitude.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="summary-divider" />

                        <div className="summary-item">
                            <span className="summary-label">Date</span>
                            <span className="summary-value">{formatDate(sessionDate)}</span>
                        </div>

                        <div className="summary-item">
                            <span className="summary-label">Time</span>
                            <span className="summary-value">{formatTime(startTime)} - {formatTime(endTime)}</span>
                        </div>

                        <div className="summary-item">
                            <span className="summary-label">Duration</span>
                            <span className="summary-value">
                                {startTime && endTime ? (
                                    (() => {
                                        const [startH, startM] = startTime.split(':').map(Number)
                                        const [endH, endM] = endTime.split(':').map(Number)
                                        const startMin = startH * 60 + startM
                                        const endMin = endH * 60 + endM
                                        const durationMin = endMin - startMin
                                        const hours = Math.floor(durationMin / 60)
                                        const mins = durationMin % 60
                                        return hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`
                                    })()
                                ) : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="confirm-notes">
                    <div className="note-item">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>Your booking will be pending approval from an administrator</span>
                    </div>
                    <div className="note-item">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>You can start the session 10 minutes before the scheduled time</span>
                    </div>
                    <div className="note-item">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>You can manage or cancel this booking from My Bookings</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Step3Confirm
