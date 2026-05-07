import { useState } from 'react'
import './BookingManage.css'

const statusColors = {
    confirmed: 'var(--teal)',
    pending: 'var(--gold)',
    completed: 'var(--text3)',
    awaiting: 'var(--orange)',
}

// ── Shared detail row ──────────────────────────────────────────────────────────
function DetailRow({ label, value }) {
    return (
        <div className="bm-detail-row">
            <span className="bm-detail-label">{label}</span>
            <span className="bm-detail-value">{value ?? '—'}</span>
        </div>
    )
}

// ── Cancel confirmation view ───────────────────────────────────────────────────
function CancelConfirm({ booking, onConfirm, onBack }) {
    return (
        <div className="bm-cancel-confirm">
            <div className="bm-cancel-icon">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
            <h3 className="bm-cancel-title">Cancel this booking?</h3>
            <p className="bm-cancel-body">
                <strong>{booking.title}</strong> on <strong>{booking.date}</strong> at <strong>{booking.time}</strong> will be permanently cancelled. This cannot be undone.
            </p>
            <div className="bm-cancel-actions">
                <button className="bm-btn bm-btn--ghost" onClick={onBack}>
                    Keep Booking
                </button>
                <button className="bm-btn bm-btn--danger" onClick={() => onConfirm(booking.id)}>
                    Yes, Cancel It
                </button>
            </div>
        </div>
    )
}

// ── Past session summary view ──────────────────────────────────────────────────
function PastSessionView({ booking }) {
    return (
        <>
            <div className="bm-section">
                <h3 className="bm-section-title">Session Details</h3>
                <DetailRow label="Date" value={booking.date} />
                <DetailRow label="Time" value={booking.time} />
                <DetailRow label="Status" value={booking.status} />
                <DetailRow label="Booking ID" value={`HD-${booking.id}`} />
            </div>

            {booking.description && (
                <div className="bm-section">
                    <h3 className="bm-section-title">Description</h3>
                    <p className="bm-description">{booking.description}</p>
                </div>
            )}

            <div className="bm-section">
                <h3 className="bm-section-title">Session Summary</h3>
                <div className="bm-summary-grid">
                    <div className="bm-summary-stat">
                        <span className="bm-summary-stat__value">
                            {booking.captureCount ?? 0}
                        </span>
                        <span className="bm-summary-stat__label">Images Captured</span>
                    </div>
                    <div className="bm-summary-stat">
                        <span className="bm-summary-stat__value">
                            {booking.studentCount ?? 0}
                        </span>
                        <span className="bm-summary-stat__label">Students Joined</span>
                    </div>
                    <div className="bm-summary-stat">
                        <span className="bm-summary-stat__value">
                            {booking.duration ?? '—'}
                        </span>
                        <span className="bm-summary-stat__label">Duration</span>
                    </div>
                </div>
            </div>

            {booking.targetObject && (
                <div className="bm-section">
                    <h3 className="bm-section-title">Observation Target</h3>
                    <DetailRow label="Object" value={booking.targetObject} />
                    {booking.coordinates?.ra && (
                        <DetailRow label="RA / Dec" value={`${booking.coordinates.ra} / ${booking.coordinates.dec}`} />
                    )}
                </div>
            )}

            <div className="bm-footer">
                <button
                    className="bm-btn bm-btn--primary"
                    onClick={() => window.location.href = '/captures'}
                >
                    View Captures
                </button>
            </div>
        </>
    )
}

// ── Manage (upcoming/pending) view ────────────────────────────────────────────
function ManageView({ booking, onRequestCancel }) {
    return (
        <>
            <div className="bm-section">
                <h3 className="bm-section-title">Booking Details</h3>
                <DetailRow label="Date" value={booking.date} />
                <DetailRow label="Time" value={booking.time} />
                <DetailRow label="Status" value={booking.status} />
                <DetailRow label="Booking ID" value={`HD-${booking.id}`} />
            </div>

            {booking.description && (
                <div className="bm-section">
                    <h3 className="bm-section-title">Description</h3>
                    <p className="bm-description">{booking.description}</p>
                </div>
            )}

            {booking.targetObject && (
                <div className="bm-section">
                    <h3 className="bm-section-title">Observation Target</h3>
                    <DetailRow label="Object" value={booking.targetObject} />
                    {booking.coordinates?.ra && (
                        <DetailRow label="RA / Dec" value={`${booking.coordinates.ra} / ${booking.coordinates.dec}`} />
                    )}
                </div>
            )}

            <div className="bm-section">
                <h3 className="bm-section-title">Notes</h3>
                <p className="bm-description bm-description--muted">
                    {booking.notes ?? 'No additional notes for this session.'}
                </p>
            </div>

            <div className="bm-footer bm-footer--spaced">
                <button className="bm-btn bm-btn--danger-ghost" onClick={onRequestCancel}>
                    Cancel Booking
                </button>
                {booking.statusColor === 'confirmed' && (
                    <button
                        className="bm-btn bm-btn--primary"
                        onClick={() => window.location.href = `/lobby/${booking.id}`}
                    >
                        Go to Lobby
                    </button>
                )}
            </div>
        </>
    )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function BookingManage({ booking, isPast, onClose, onCancel }) {
    const [confirmingCancel, setConfirmingCancel] = useState(false)

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose()
    }

    const title = isPast
        ? 'Session Summary'
        : confirmingCancel
            ? 'Cancel Booking'
            : 'Manage Booking'

    return (
        <div className="bm-backdrop" onClick={handleBackdropClick}>
            <div className="bm-modal">
                {/* Header */}
                <div className="bm-modal-header">
                    <div className="bm-modal-header-left">
                        <h2 className="bm-modal-title">{title}</h2>
                        <span
                            className="bm-modal-status"
                            style={{ '--status-color': statusColors[booking.statusColor] }}
                        >
                            {booking.status}
                        </span>
                    </div>
                    <button className="bm-close-btn" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                {/* Booking title */}
                {!confirmingCancel && (
                    <div className="bm-booking-title">{booking.title}</div>
                )}

                {/* Body */}
                <div className="bm-modal-body">
                    {confirmingCancel ? (
                        <CancelConfirm
                            booking={booking}
                            onConfirm={onCancel}
                            onBack={() => setConfirmingCancel(false)}
                        />
                    ) : isPast ? (
                        <PastSessionView booking={booking} />
                    ) : (
                        <ManageView
                            booking={booking}
                            onRequestCancel={() => setConfirmingCancel(true)}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
