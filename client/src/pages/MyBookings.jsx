import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import AccountNav from '../components/auth/AccountNav'
import BookingManage from '../components/BookingManage'
import api from '../lib/api'
import './MyBookings.css'


const statusColors = {
    confirmed: 'var(--teal)',
    pending: 'var(--gold)',
    completed: 'var(--text3)',
    awaiting: 'var(--orange)'
}

// Parse date and time string to Date object
function parseSessionTime(dateStr, timeStr) {
    // Expected format: date '14/04/2026', time '09:00 - 10:30'
    const [day, month, year] = dateStr.split('/').map(Number)
    const startTime = timeStr.split(' - ')[0]
    const [hours, minutes] = startTime.split(':').map(Number)

    return new Date(year, month - 1, day, hours, minutes)
}

// Check if session can be started (within 10 minutes of start time)
function canStartSession(sessionDate, sessionTime) {
    const sessionStartTime = parseSessionTime(sessionDate, sessionTime)
    const now = new Date()
    const diffMs = sessionStartTime - now
    const diffMinutes = diffMs / (1000 * 60)

    // Can start if within 10 minutes before the session start time
    return diffMinutes <= 10 && diffMinutes > -120 // Allow up to 2 hours after start
}

// Get time until session can be started
function getTimeUntilStart(sessionDate, sessionTime) {
    const sessionStartTime = parseSessionTime(sessionDate, sessionTime)
    const now = new Date()
    const diffMs = sessionStartTime - now
    const diffMinutes = Math.ceil(diffMs / (1000 * 60)) - 10

    if (diffMinutes <= 0) return 'Available now'
    if (diffMinutes < 60) return `Available in ${diffMinutes} min`
    const hours = Math.floor(diffMinutes / 60)
    const mins = diffMinutes % 60
    return `Available in ${hours}h ${mins}m`
}


function BookingCard({ booking, isPast, onManage }) {
    const navigate = useNavigate()
    const handleStartSession = () => {
        window.location.href = `/lobby/${booking.id}`
    }

    const handleManage = () => {
        onManage(booking)
    }

    const isStartable = canStartSession(booking.date, booking.time)
    const timeUntilStart = getTimeUntilStart(booking.date, booking.time)

    return (
        <div className="booking-card">
            <div className="booking-card__header">
                <div className="booking-card__date">
                    <span className="booking-card__date-text">{booking.date}</span>
                    <span className="booking-card__time">{booking.time}</span>
                </div>
                <span
                    className="booking-card__status"
                    style={{ '--status-color': statusColors[booking.statusColor] }}
                >
                    {booking.status}
                </span>
            </div>

            <div className="booking-card__content">
                <h3 className="booking-card__title">{booking.title}</h3>
                <p className="booking-card__description">{booking.description}</p>
                {isPast && booking.captureCount > 0 && (
                    <div className="booking-card__captures">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span>{booking.captureCount} captures</span>
                    </div>
                )}
            </div>

            <div className="booking-card__actions">
                {!isPast && booking.statusColor === 'confirmed' && !booking.headless && (
                    <button
                        className="booking-card__btn booking-card__btn--primary"
                        onClick={handleStartSession}
                        disabled={!isStartable}
                        title={!isStartable ? timeUntilStart : ''}
                    >
                        Start Session
                    </button>
                )}
                {!isPast && booking.statusColor === 'confirmed' && booking.headless && (
                    <div className="booking-card__headless-badge">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                        </svg>
                        Queue Scheduled
                    </div>
                )}
                {!isPast && booking.statusColor === 'pending' && (
                    <button
                        className="booking-card__btn booking-card__btn--primary"
                        disabled
                    >
                        Awaiting Approval
                    </button>
                )}
                {isPast && (
                    <button
                        className="booking-card__btn booking-card__btn--primary"
                        onClick={() => navigate(`/bookings/${booking.id}/captures`)}
                    >
                        View Captures
                    </button>
                )}
                <button
                    className="booking-card__btn booking-card__btn--secondary"
                    onClick={handleManage}
                >
                    {isPast ? 'Details' : 'Manage'}
                </button>
            </div>
            {!isPast && booking.statusColor === 'confirmed' && !booking.headless && !isStartable && (
                <div className="booking-card__start-hint">
                    {timeUntilStart}
                </div>
            )}
        </div>
    )
}

function MyBookings() {
    const [activeTab, setActiveTab] = useState('upcoming')
    const [bookings, setBookings] = useState({ upcoming: [], past: [], pending: [] })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedBooking, setSelectedBooking] = useState(null)

    const handleManage = (booking) => setSelectedBooking(booking)
    const handleCloseModal = () => setSelectedBooking(null)

    const handleCancelBooking = async (bookingId) => {
        try {
            await api.delete(`/api/bookings/${bookingId}`)
            setBookings(prev => ({
                ...prev,
                upcoming: prev.upcoming.filter(b => b.id !== bookingId),
                pending: prev.pending.filter(b => b.id !== bookingId),
            }))
            setSelectedBooking(null)
        } catch (err) {
            console.error('Failed to cancel booking:', err)
        }
    }

    useEffect(() => {
        async function fetchBookings() {
            try {
                setLoading(true)
                const response = await api.get('/api/bookings')
                setBookings(response.data)
            } catch (err) {
                setError(err.response?.statusText || err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchBookings()
    }, [])

    const currentBookings = bookings[activeTab] || []
    const isPast = activeTab === 'past'

    const tabs = [
        { id: 'upcoming', label: 'Upcoming', count: bookings.upcoming.length },
        { id: 'past', label: 'Past', count: bookings.past.length },
        { id: 'pending', label: 'Pending', count: bookings.pending.length }
    ]

    return (
        <div className="page-shell">
            <TopBar activePath="/bookings" />
            <AccountNav activePath="/bookings" />

            <main className="bookings-page bookings-page--with-subnav">
                <div className="bookings-container">
                    <header className="bookings-header">
                        <h1 className="bookings-title">My Bookings</h1>
                        <button
                            className="bookings-new-btn"
                            onClick={() => window.location.href = '/bookings/new'}
                        >
                            <span>+</span>
                            New Booking
                        </button>
                    </header>

                    <nav className="bookings-tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`bookings-tab ${activeTab === tab.id ? 'bookings-tab--active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                                <span className="bookings-tab__count">{tab.count}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="bookings-list">
                        {loading && (
                            <div className="bookings-loading">
                                <div className="bookings-loading__spinner" />
                                <p>Loading bookings...</p>
                            </div>
                        )}

                        {error && !loading && (
                            <div className="bookings-error">
                                <div className="bookings-error__icon">
                                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </div>
                                <h3 className="bookings-error__title">Failed to load bookings</h3>
                                <p className="bookings-error__text">{error}</p>
                            </div>
                        )}

                        {!loading && !error && currentBookings.length > 0 ? (
                            currentBookings.map(booking => (
                                <BookingCard
                                    key={booking.id}
                                    booking={booking}
                                    isPast={isPast}
                                    onManage={handleManage}
                                />
                            ))
                        ) : (
                            <div className="bookings-empty">
                                <div className="bookings-empty__icon">
                                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                </div>
                                <h3 className="bookings-empty__title">No {activeTab} bookings</h3>
                                <p className="bookings-empty__text">
                                    {activeTab === 'upcoming'
                                        ? "You don't have any upcoming sessions scheduled."
                                        : activeTab === 'past'
                                            ? "You haven't completed any sessions yet."
                                            : "You don't have any pending approvals."}
                                </p>
                                {activeTab !== 'past' && (
                                    <button
                                        className="bookings-empty__btn"
                                        onClick={() => window.location.href = '/bookings/new'}
                                    >
                                        Create New Booking
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {selectedBooking && (
                <BookingManage
                    booking={selectedBooking}
                    isPast={activeTab === 'past'}
                    onClose={handleCloseModal}
                    onCancel={handleCancelBooking}
                />
            )}
        </div>
    )
}

export default MyBookings
