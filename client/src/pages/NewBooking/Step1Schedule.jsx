import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Generate 30-minute time slots from 6 PM to 6 AM (night observation window)
const generateTimeSlots = () => {
    const slots = []

    // Evening slots: 18:00 - 23:30
    for (let hour = 18; hour <= 23; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
            const displayHour = hour > 12 ? hour - 12 : hour
            const period = hour >= 12 ? 'PM' : 'AM'
            const label = `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
            slots.push({ time, label })
        }
    }

    // Early morning slots: 00:00 - 05:30
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

const SESSION_DURATION = 30 // minutes

function Step1Schedule({
    sessionDate,
    setSessionDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    onDurationChange
}) {
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(today.setDate(diff))
        monday.setHours(0, 0, 0, 0)
        return monday
    })
    const [availableSlots, setAvailableSlots] = useState([])
    const [isLoadingSlots, setIsLoadingSlots] = useState(false)
    const [error, setError] = useState(null)

    // Calculate duration between two time strings in minutes
    const calculateDuration = (start, end) => {
        const [startH, startM] = start.split(':').map(Number)
        const [endH, endM] = end.split(':').map(Number)
        let startMinutes = startH * 60 + startM
        let endMinutes = endH * 60 + endM
        // Handle crossing midnight
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60
        }
        return endMinutes - startMinutes
    }

    // Calculate end time based on start time
    const calculateEndTime = (start) => {
        const [hours, minutes] = start.split(':').map(Number)
        const endDate = new Date(2000, 0, 1, hours, minutes + SESSION_DURATION)
        return `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    }

    // Fetch available slots when week changes
    useEffect(() => {
        fetchAvailableSlots()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentWeekStart])

    async function fetchAvailableSlots() {
        setIsLoadingSlots(true)
        setError(null)

        try {
            const weekEnd = new Date(currentWeekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)

            const params = new URLSearchParams({
                startDate: currentWeekStart.toISOString().split('T')[0],
                endDate: weekEnd.toISOString().split('T')[0]
            })

            const response = await fetch(`${API_BASE}/api/bookings/availability?${params}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include',
            })

            if (!response.ok) {
                // If the endpoint doesn't exist yet, assume all slots are available
                if (response.status === 404) {
                    setAvailableSlots(null) // null means all slots are available
                    return
                }
                throw new Error(`HTTP ${response.status}`)
            }

            const data = await response.json()
            // Expected format: [{ date: '2026-04-15', startTime: '20:00', endTime: '20:30' }, ...]
            setAvailableSlots(data.slots || data || [])
        } catch (err) {
            console.error('Failed to fetch available slots:', err)
            setError('Failed to load available time slots')
            setAvailableSlots(null) // Fallback: allow all slots
        } finally {
            setIsLoadingSlots(false)
        }
    }

    // Check if a slot is available
    const isSlotAvailable = (dayIndex, slot) => {
        // If no availability data, all slots are available (except past ones)
        if (availableSlots === null) return true
        if (!availableSlots || availableSlots.length === 0) return false

        const cellDate = new Date(currentWeekStart)
        cellDate.setDate(currentWeekStart.getDate() + dayIndex)
        const dateStr = cellDate.toISOString().split('T')[0]

        return availableSlots.some(
            available => available.date === dateStr && available.startTime === slot.time
        )
    }

    // Handle cell selection
    const handleCellClick = (dayIndex, slot) => {
        const selectedDate = new Date(currentWeekStart)
        selectedDate.setDate(currentWeekStart.getDate() + dayIndex)
        const dateStr = selectedDate.toISOString().split('T')[0]
        const calculatedEndTime = calculateEndTime(slot.time)
        setSessionDate(dateStr)
        setStartTime(slot.time)
        setEndTime(calculatedEndTime)

        // Report duration to parent
        if (onDurationChange) {
            const duration = calculateDuration(slot.time, calculatedEndTime)
            onDurationChange(duration)
        }
    }

    // Report initial duration if time is already set
    useEffect(() => {
        if (startTime && endTime && onDurationChange) {
            const duration = calculateDuration(startTime, endTime)
            onDurationChange(duration)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Check if a cell is selected
    const isCellSelected = (dayIndex, slot) => {
        if (!sessionDate || !startTime) return false
        const cellDate = new Date(currentWeekStart)
        cellDate.setDate(currentWeekStart.getDate() + dayIndex)
        const dateStr = cellDate.toISOString().split('T')[0]
        return dateStr === sessionDate && slot.time === startTime
    }

    // Check if date is in the past (for the current time)
    const isDateTimeInPast = (dayIndex, slot) => {
        const cellDate = new Date(currentWeekStart)
        cellDate.setDate(currentWeekStart.getDate() + dayIndex)
        const [hours, minutes] = slot.time.split(':').map(Number)
        cellDate.setHours(hours, minutes, 0, 0)

        const now = new Date()
        return cellDate < now
    }

    // Get day date string
    const getDayDate = (dayIndex) => {
        const date = new Date(currentWeekStart)
        date.setDate(currentWeekStart.getDate() + dayIndex)
        return date.getDate()
    }

    // Check if a day is today
    const isToday = (dayIndex) => {
        const date = new Date(currentWeekStart)
        date.setDate(currentWeekStart.getDate() + dayIndex)
        const today = new Date()
        return date.toDateString() === today.toDateString()
    }

    // Navigation
    const handlePrevWeek = () => {
        const newWeek = new Date(currentWeekStart)
        newWeek.setDate(newWeek.getDate() - 7)
        setCurrentWeekStart(newWeek)
    }

    const handleNextWeek = () => {
        const newWeek = new Date(currentWeekStart)
        newWeek.setDate(newWeek.getDate() + 7)
        setCurrentWeekStart(newWeek)
    }

    const handleToday = () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(today.setDate(diff))
        monday.setHours(0, 0, 0, 0)
        setCurrentWeekStart(monday)
    }

    // Format week range
    const formatWeekRange = () => {
        const weekEnd = new Date(currentWeekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        const options = { month: 'short', day: 'numeric' }
        return `${currentWeekStart.toLocaleDateString('en-AU', options)} - ${weekEnd.toLocaleDateString('en-AU', options)}`
    }

    // Format selected date/time for display
    const formatSelection = () => {
        if (!sessionDate || !startTime) return 'No session selected'
        const date = new Date(sessionDate)
        const formattedDate = date.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })

        // Format times for display
        const formatTimeDisplay = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number)
            const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h)
            const period = h >= 12 ? 'PM' : 'AM'
            return `${displayH}:${String(m).padStart(2, '0')} ${period}`
        }

        return `${formattedDate}, ${formatTimeDisplay(startTime)} - ${formatTimeDisplay(endTime)}`
    }

    return (
        <div className="step-1 step-1--schedule">
            {/* Weekly Schedule Grid */}
            <div className="schedule-section calendar-grid-section calendar-grid-section--flexible">
                <div className="calendar-grid-header">
                    <div className="calendar-header-left">
                        <h3 className="schedule-section-title">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            Select Date & Time
                        </h3>
                        {/* Selection Summary - Merged into header */}
                        <div className="selection-badge">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span className="selection-badge-text">{formatSelection()}</span>
                        </div>
                    </div>
                    <div className="calendar-grid-nav">
                        <button className="calendar-nav-btn" onClick={handlePrevWeek} disabled={isLoadingSlots}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                        <span className="calendar-week-range">{formatWeekRange()}</span>
                        <button className="calendar-nav-btn" onClick={handleNextWeek} disabled={isLoadingSlots}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                        <button className="calendar-today-btn" onClick={handleToday} disabled={isLoadingSlots}>Today</button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="calendar-error">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {isLoadingSlots && (
                    <div className="calendar-loading">
                        <div className="calendar-loading-spinner" />
                        <span>Loading available slots...</span>
                    </div>
                )}

                {/* Days Header */}
                <div className="calendar-days-row">
                    <div className="calendar-time-header"></div>
                    {DAYS_OF_WEEK.map((day, index) => (
                        <div key={day} className={`calendar-day-header ${isToday(index) ? 'today' : ''}`}>
                            <div className="day-name">{day}</div>
                            <div className="day-date">{getDayDate(index)}</div>
                        </div>
                    ))}
                </div>

                {/* Time Slots Grid - Scrollable */}
                <div className={`calendar-slots-container ${isLoadingSlots ? 'loading' : ''}`}>
                    {TIME_SLOTS.map((slot) => (
                        <div key={slot.time} className="calendar-time-row">
                            <div className="calendar-time-label">{slot.label}</div>
                            <div className="calendar-cells-row">
                                {DAYS_OF_WEEK.map((_, dayIndex) => {
                                    const selected = isCellSelected(dayIndex, slot)
                                    const inPast = isDateTimeInPast(dayIndex, slot)
                                    const available = isSlotAvailable(dayIndex, slot)
                                    const disabled = inPast || !available

                                    return (
                                        <button
                                            key={dayIndex}
                                            className={`calendar-cell ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${!available && !inPast ? 'booked' : ''}`}
                                            onClick={() => !disabled && handleCellClick(dayIndex, slot)}
                                            disabled={disabled}
                                            title={!available && !inPast ? 'Slot already booked' : inPast ? 'Past time slot' : 'Click to book'}
                                        >
                                            {selected && (
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Step1Schedule
