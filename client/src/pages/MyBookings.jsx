import { useState } from 'react'
import TopBar from '../components/TopBar'
import AccountNav from '../components/auth/AccountNav'
import './MyBookings.css'

// Mock booking data
const mockBookings = {
    upcoming: [
        {
            id: 1,
            date: '14/04/2026',
            time: '09:00 - 10:30',
            status: 'Confirmed',
            statusColor: 'confirmed',
            title: 'Year 9 Science Class',
            description: 'Introduction to telescope operation and lunar observation. Students will learn basic telescope controls and capture images of the Moon.',
            sessionCode: 'ABC-123'
        },
        {
            id: 2,
            date: '16/04/2026',
            time: '14:00 - 15:30',
            status: 'Confirmed',
            statusColor: 'confirmed',
            title: 'Year 10 Astronomy',
            description: 'Planetary observation session focusing on Jupiter and its moons. Students will practice tracking and image capture.',
            sessionCode: 'DEF-456'
        },
        {
            id: 3,
            date: '22/04/2026',
            time: '19:30 - 21:00',
            status: 'Pending',
            statusColor: 'pending',
            title: 'Evening Star Party',
            description: 'After-school astronomy club session. Deep sky objects including nebulae and star clusters.',
            sessionCode: null
        }
    ],
    past: [
        {
            id: 4,
            date: '01/04/2026',
            time: '10:00 - 11:30',
            status: 'Completed',
            statusColor: 'completed',
            title: 'Year 8 Science - Moon Phase',
            description: 'Students observed and documented different moon phases. 12 images captured and downloaded.',
            sessionCode: null
        },
        {
            id: 5,
            date: '28/03/2026',
            time: '09:00 - 10:30',
            status: 'Completed',
            statusColor: 'completed',
            title: 'Year 9 - Solar Observation',
            description: 'Safe solar observation using neutral density filters. Students learned about sunspots and solar features.',
            sessionCode: null
        }
    ],
    pending: [
        {
            id: 6,
            date: '25/04/2026',
            time: '20:00 - 22:00',
            status: 'Awaiting Approval',
            statusColor: 'awaiting',
            title: 'Weekend Astrophotography Workshop',
            description: 'Advanced session for year 11/12 students. Focus on long-exposure imaging and image processing.',
            sessionCode: null
        }
    ]
}

const tabs = [
    { id: 'upcoming', label: 'Upcoming', count: mockBookings.upcoming.length },
    { id: 'past', label: 'Past', count: mockBookings.past.length },
    { id: 'pending', label: 'Pending', count: mockBookings.pending.length }
]

const statusColors = {
    confirmed: 'var(--teal)',
    pending: 'var(--gold)',
    completed: 'var(--text3)',
    awaiting: 'var(--orange)'
}

function BookingCard({ booking, isPast }) {
    const handleJoin = () => {
        if (booking.sessionCode) {
            window.location.href = `/join?code=${booking.sessionCode}`
        }
    }

    const handleManage = () => {
        // Navigate to session management page
        console.log('Manage booking:', booking.id)
    }

    return (
        <div className="booking-card">
            <div className="booking-card__header">
                <div className="booking-card__date">
                    <span className="booking-card__date-icon">📅</span>
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
                {booking.sessionCode && (
                    <div className="booking-card__code">
                        <span className="booking-card__code-label">Session Code:</span>
                        <span className="booking-card__code-value">{booking.sessionCode}</span>
                    </div>
                )}
            </div>

            <div className="booking-card__actions">
                {!isPast && booking.statusColor !== 'awaiting' && (
                    <button
                        className="booking-card__btn booking-card__btn--primary"
                        onClick={handleJoin}
                        disabled={!booking.sessionCode}
                    >
                        {booking.sessionCode ? 'Join Session' : 'Not Started'}
                    </button>
                )}
                {isPast && (
                    <button
                        className="booking-card__btn booking-card__btn--primary"
                        onClick={() => window.location.href = '/captures'}
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
        </div>
    )
}

function MyBookings() {
    const [activeTab, setActiveTab] = useState('upcoming')

    const currentBookings = mockBookings[activeTab]
    const isPast = activeTab === 'past'

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
                            onClick={() => window.location.href = '/scheduling'}
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
                        {currentBookings.length > 0 ? (
                            currentBookings.map(booking => (
                                <BookingCard
                                    key={booking.id}
                                    booking={booking}
                                    isPast={isPast}
                                />
                            ))
                        ) : (
                            <div className="bookings-empty">
                                <div className="bookings-empty__icon">📅</div>
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
                                        onClick={() => window.location.href = '/scheduling'}
                                    >
                                        Create New Booking
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

export default MyBookings
