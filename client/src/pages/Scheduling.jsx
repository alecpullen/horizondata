import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import api from '../lib/api'
import './NewBooking/NewBooking.css'
import './Scheduling.css'

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const generateTimeSlots = () => {
    const slots = []
    for (let hour = 18; hour <= 23; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
            const displayHour = hour - 12
            const label = `${displayHour}:${String(minute).padStart(2, '0')} PM`
            slots.push({ time, label })
        }
    }
    for (let hour = 0; hour <= 5; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
            const displayHour = hour === 0 ? 12 : hour
            const label = `${displayHour}:${String(minute).padStart(2, '0')} AM`
            slots.push({ time, label })
        }
    }
    return slots
}

const TIME_SLOTS = generateTimeSlots()

const STATUS_COLORS = {
    confirmed: 'var(--teal)',
    pending: 'var(--gold)',
    completed: 'var(--text3)',
    awaiting: 'var(--orange)',
}

function formatTimeDisplay(timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
    const period = h >= 12 ? 'PM' : 'AM'
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`
}

function Scheduling() {
    const navigate = useNavigate()

    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(today.setDate(diff))
        monday.setHours(0, 0, 0, 0)
        return monday
    })

    const [availableSlots, setAvailableSlots] = useState(null)
    const [rawBookings, setRawBookings] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [activePopup, setActivePopup] = useState(null)

    const popupRef = useRef(null)

    // Convert "DD/MM/YYYY" + "HH:MM - HH:MM" to lookup-friendly shape
    const parsedMyBookings = useMemo(() => {
        return rawBookings.map(b => {
            const [day, month, year] = b.date.split('/').map(Number)
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const [startTime, endTime] = b.time.split(' - ')
            return { ...b, dateStr, startTime, endTime }
        })
    }, [rawBookings])

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentWeekStart])

    async function fetchData() {
        setIsLoading(true)
        setError(null)

        const weekEnd = new Date(currentWeekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)

        try {
            const [availRes, bookingsRes] = await Promise.all([
                api.get(`/api/bookings/availability?${new URLSearchParams({
                    startDate: currentWeekStart.toISOString().split('T')[0],
                    endDate: weekEnd.toISOString().split('T')[0],
                })}`),
                api.get('/api/bookings'),
            ])

            setAvailableSlots(availRes.data.slots || [])

            const data = bookingsRes.data
            setRawBookings([
                ...(data.upcoming || []),
                ...(data.pending || []),
            ])
        } catch (err) {
            console.error('Failed to fetch scheduling data:', err)
            setError('Failed to load schedule. Please try again.')
            setAvailableSlots(null)
        } finally {
            setIsLoading(false)
        }
    }

    const getCellDateStr = useCallback((dayIndex) => {
        const date = new Date(currentWeekStart)
        date.setDate(currentWeekStart.getDate() + dayIndex)
        return date.toISOString().split('T')[0]
    }, [currentWeekStart])

    const isDateTimeInPast = useCallback((dayIndex, slot) => {
        const cellDate = new Date(currentWeekStart)
        cellDate.setDate(currentWeekStart.getDate() + dayIndex)
        const [h, m] = slot.time.split(':').map(Number)
        cellDate.setHours(h, m, 0, 0)
        return cellDate < new Date()
    }, [currentWeekStart])

    const getCellState = useCallback((dayIndex, slot) => {
        if (isDateTimeInPast(dayIndex, slot)) return { state: 'past' }

        const cellDateStr = getCellDateStr(dayIndex)

        const myBooking = parsedMyBookings.find(
            b => b.dateStr === cellDateStr && b.startTime === slot.time
        )
        if (myBooking) return { state: 'mine', booking: myBooking }

        if (availableSlots === null) return { state: 'available' }
        const isAvail = availableSlots.some(s => s.date === cellDateStr && s.startTime === slot.time)
        if (isAvail) return { state: 'available' }

        return { state: 'taken' }
    }, [isDateTimeInPast, getCellDateStr, parsedMyBookings, availableSlots])

    const handleCellClick = useCallback((dayIndex, slot, cellEl, cellInfo) => {
        if (cellInfo.state === 'past' || cellInfo.state === 'taken') return
        const rect = cellEl.getBoundingClientRect()
        setActivePopup({ dayIndex, slot, rect, ...cellInfo })
    }, [])

    useEffect(() => {
        function handleMouseDown(e) {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                setActivePopup(null)
            }
        }
        document.addEventListener('mousedown', handleMouseDown)
        return () => document.removeEventListener('mousedown', handleMouseDown)
    }, [])

    const getDayDate = (dayIndex) => {
        const date = new Date(currentWeekStart)
        date.setDate(currentWeekStart.getDate() + dayIndex)
        return date.getDate()
    }

    const isToday = (dayIndex) => {
        const date = new Date(currentWeekStart)
        date.setDate(currentWeekStart.getDate() + dayIndex)
        return date.toDateString() === new Date().toDateString()
    }

    const formatWeekRange = () => {
        const weekEnd = new Date(currentWeekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        const opts = { month: 'short', day: 'numeric' }
        return `${currentWeekStart.toLocaleDateString('en-AU', opts)} – ${weekEnd.toLocaleDateString('en-AU', opts)}`
    }

    const handlePrevWeek = () => {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() - 7)
        setCurrentWeekStart(d)
        setActivePopup(null)
    }

    const handleNextWeek = () => {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() + 7)
        setCurrentWeekStart(d)
        setActivePopup(null)
    }

    const handleToday = () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(today.setDate(diff))
        monday.setHours(0, 0, 0, 0)
        setCurrentWeekStart(monday)
        setActivePopup(null)
    }

    const formatPopupDateTime = (dayIndex, slot) => {
        const date = new Date(currentWeekStart)
        date.setDate(currentWeekStart.getDate() + dayIndex)
        const formattedDate = date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
        const end = new Date(2000, 0, 1, ...slot.time.split(':').map(Number))
        end.setMinutes(end.getMinutes() + 30)
        const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
        return `${formattedDate} · ${formatTimeDisplay(slot.time)} – ${formatTimeDisplay(endTime)}`
    }

    const handleBookSlot = () => {
        if (!activePopup) return
        const dateStr = getCellDateStr(activePopup.dayIndex)
        navigate(`/bookings/new?date=${dateStr}&startTime=${activePopup.slot.time}`)
        setActivePopup(null)
    }

    const getPopupStyle = () => {
        if (!activePopup) return {}
        const { rect } = activePopup
        const scrollTop = window.scrollY || document.documentElement.scrollTop
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft
        const popupWidth = 260
        let top = rect.bottom + scrollTop + 6
        let left = rect.left + scrollLeft + rect.width / 2 - popupWidth / 2

        left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8))

        if (rect.bottom + 160 > window.innerHeight) {
            top = rect.top + scrollTop - 160
        }

        return { top, left, width: popupWidth }
    }

    return (
        <div className="scheduling-page-wrapper">
            <TopBar activePath="/scheduling" />

            <main className="scheduling-page">
                <div className="scheduling-container">

                    {/* Page Header */}
                    <div className="scheduling-header">
                        <h1 className="scheduling-title">Scheduling Overview</h1>
                        <div className="scheduling-header-right">
                            <div className="calendar-grid-nav">
                                <button className="calendar-nav-btn" onClick={handlePrevWeek} disabled={isLoading}>
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </button>
                                <span className="calendar-week-range">{formatWeekRange()}</span>
                                <button className="calendar-nav-btn" onClick={handleNextWeek} disabled={isLoading}>
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </button>
                                <button className="calendar-today-btn" onClick={handleToday} disabled={isLoading}>Today</button>
                            </div>
                            <button className="sched-new-btn" onClick={() => navigate('/bookings/new')}>
                                + New Booking
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="sched-error">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Calendar Grid — uses NewBooking.css structural classes */}
                    <div className="calendar-grid-section sched-grid-section">
                        {isLoading && (
                            <div className="sched-loading">
                                <div className="sched-loading-spinner" />
                                <span>Loading schedule...</span>
                            </div>
                        )}

                        <div className="calendar-days-row">
                            <div className="calendar-time-header" />
                            {DAYS_OF_WEEK.map((day, index) => (
                                <div key={day} className={`calendar-day-header ${isToday(index) ? 'today' : ''}`}>
                                    <div className="day-name">{day}</div>
                                    <div className="day-date">{getDayDate(index)}</div>
                                </div>
                            ))}
                        </div>

                        <div className={`calendar-slots-container sched-slots-container ${isLoading ? 'loading' : ''}`}>
                            {TIME_SLOTS.map(slot => (
                                <div key={slot.time} className="calendar-time-row">
                                    <div className="calendar-time-label">{slot.label}</div>
                                    <div className="calendar-cells-row">
                                        {DAYS_OF_WEEK.map((_, dayIndex) => {
                                            const cellInfo = getCellState(dayIndex, slot)
                                            const { state, booking } = cellInfo
                                            const isActive = activePopup?.dayIndex === dayIndex && activePopup?.slot?.time === slot.time

                                            return (
                                                <button
                                                    key={dayIndex}
                                                    className={`calendar-cell sched-cell--${state} ${isActive ? 'sched-cell--active' : ''}`}
                                                    onClick={e => handleCellClick(dayIndex, slot, e.currentTarget, cellInfo)}
                                                    disabled={state === 'past' || state === 'taken'}
                                                    title={
                                                        state === 'taken' ? 'Slot unavailable' :
                                                        state === 'past' ? 'Past time slot' :
                                                        state === 'mine' ? booking?.title || 'Your booking' :
                                                        'Available — click to book'
                                                    }
                                                >
                                                    {state === 'mine' && booking && (
                                                        <span className="sched-cell__label">{booking.title}</span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="sched-legend">
                        <div className="sched-legend-item">
                            <div className="sched-legend-swatch sched-legend-swatch--available" />
                            <span>Available</span>
                        </div>
                        <div className="sched-legend-item">
                            <div className="sched-legend-swatch sched-legend-swatch--mine" />
                            <span>Your Booking</span>
                        </div>
                        <div className="sched-legend-item">
                            <div className="sched-legend-swatch sched-legend-swatch--taken" />
                            <span>Unavailable</span>
                        </div>
                        <div className="sched-legend-item">
                            <div className="sched-legend-swatch sched-legend-swatch--past" />
                            <span>Past</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Popup */}
            {activePopup && (
                <div
                    ref={popupRef}
                    className={`sched-popup sched-popup--${activePopup.state}`}
                    style={getPopupStyle()}
                >
                    <div className="sched-popup__datetime">
                        {formatPopupDateTime(activePopup.dayIndex, activePopup.slot)}
                    </div>

                    {activePopup.state === 'mine' && activePopup.booking && (
                        <div className="sched-popup__booking-info">
                            <span className="sched-popup__title">{activePopup.booking.title}</span>
                            <span
                                className="sched-popup__status"
                                style={{ '--status-color': STATUS_COLORS[activePopup.booking.statusColor] }}
                            >
                                {activePopup.booking.status}
                            </span>
                        </div>
                    )}

                    <div className="sched-popup__actions">
                        {activePopup.state === 'available' && (
                            <button className="sched-popup__cta" onClick={handleBookSlot}>
                                Book this slot
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        )}
                        {activePopup.state === 'mine' && (
                            <button className="sched-popup__cta" onClick={() => { navigate('/bookings'); setActivePopup(null) }}>
                                View My Bookings
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        )}
                        <button className="sched-popup__close" onClick={() => setActivePopup(null)}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Scheduling
