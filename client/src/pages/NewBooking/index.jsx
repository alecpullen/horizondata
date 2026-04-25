import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../../components/TopBar'
import { useToast } from '../../components/ui/ToastProvider'
import Step1Schedule from './Step1Schedule'
import Step2SelectTarget from './Step2SelectTarget'
import Step3Confirm from './Step3Confirm'
import api from '../../lib/api'
import './NewBooking.css'

const STEPS = [
    { id: 1, label: 'Select Date/Time' },
    { id: 2, label: 'Select Targets' },
    { id: 3, label: 'Confirm Details' }
]

const OBSERVATION_MINUTES_PER_TARGET = 5

// Default filter values (using visibility API)
const DEFAULT_FILTERS = {
    type: 'all', // all, planet, star, nebula, galaxy, cluster
    search: ''
}

function NewBooking() {
    const navigate = useNavigate()
    const { showToast } = useToast()
    const [currentStep, setCurrentStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)

    // Step 1: Scheduling
    const [sessionDate, setSessionDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [availableSlots, setAvailableSlots] = useState([])

    // Step 2: Target selection (multiple targets supported)
    const [targets, setTargets] = useState([])
    const [filters, setFilters] = useState(DEFAULT_FILTERS)
    const [selectedTargets, setSelectedTargets] = useState([])

    // Session duration in minutes (calculated from time selection)
    const [sessionDuration, setSessionDuration] = useState(30)

    // Step 3: Session details
    const [sessionTitle, setSessionTitle] = useState('')
    const [sessionDescription, setSessionDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Calculate max targets based on session duration (5 min each)
    const maxTargets = useMemo(() => {
        if (sessionDuration <= 0) return 0
        return Math.floor(sessionDuration / OBSERVATION_MINUTES_PER_TARGET)
    }, [sessionDuration])

    // Fetch targets on mount with default filters
    useEffect(() => {
        fetchTargets()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Update session title when targets change
    useEffect(() => {
        if (selectedTargets.length > 0) {
            if (selectedTargets.length === 1) {
                setSessionTitle(`Observation: ${selectedTargets[0].name}`)
            } else {
                setSessionTitle(`Multi-Target Session (${selectedTargets.length} objects)`)
            }
        }
    }, [selectedTargets])

    // Remove excess targets if session duration is reduced
    useEffect(() => {
        if (selectedTargets.length > maxTargets && maxTargets > 0) {
            setSelectedTargets(prev => prev.slice(0, maxTargets))
        }
    }, [maxTargets, selectedTargets.length])

    async function fetchTargets() {
        setIsLoading(true)
        try {
            // Build query params from filters for visibility API
            const params = new URLSearchParams()
            if (filters.type && filters.type !== 'all') params.append('type', filters.type)

            // Include selected session time for accurate visibility calculation
            if (sessionDate && startTime) {
                const sessionDateTime = new Date(`${sessionDate}T${startTime}`)
                params.append('time', sessionDateTime.toISOString())
            }

            const { data } = await api.get(`/api/visibility/objects?${params}`)

            // Transform visibility API response to target format
            let transformedTargets = (data.objects || []).map(obj => {
                const elevation = obj.coordinates?.elevation ?? 0
                const riseTime = obj.visibility?.rise_time ? new Date(obj.visibility.rise_time) : null
                const setTime = obj.visibility?.set_time ? new Date(obj.visibility.set_time) : null

                // Calculate trend and transit info
                const sessionTime = sessionDate && startTime ? new Date(`${sessionDate}T${startTime}`) : new Date()
                const trend = calculateTrend(sessionTime, riseTime, setTime)
                const transitTime = calculateTransitTime(riseTime, setTime)

                // Quality based on elevation: green (>45°), yellow (20-45°), red (<20°)
                const quality = elevation > 45 ? 'good' : elevation > 20 ? 'fair' : 'poor'

                return {
                    id: obj.name.toLowerCase().replace(/\s+/g, '-'),
                    name: obj.name,
                    type: obj.type,
                    // Map coordinates
                    rightAscension: obj.coordinates?.ra ? `${obj.coordinates.ra.toFixed(2)}h` : null,
                    declination: obj.coordinates?.dec ? `${obj.coordinates.dec > 0 ? '+' : ''}${obj.coordinates.dec.toFixed(2)}°` : null,
                    altitude: elevation.toFixed(1) + '°',
                    elevation: elevation, // numeric for sorting
                    azimuth: obj.coordinates?.azimuth ? `${obj.coordinates.azimuth.toFixed(1)}°` : null,
                    // Map visibility data
                    magnitude: obj.visibility?.magnitude ?? null,
                    isVisible: obj.visibility?.is_visible ?? false,
                    // Quality indicators
                    trend,
                    transitTime,
                    quality,
                    // Map metadata
                    constellation: obj.metadata?.constellation || 'Unknown',
                    catalog: obj.metadata?.catalog_id || null,
                    description: obj.metadata?.description || null,
                    distance: obj.metadata?.distance || null,
                }
            })

            // Client-side search filtering
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                transformedTargets = transformedTargets.filter(t =>
                    t.name.toLowerCase().includes(searchLower) ||
                    (t.catalog && t.catalog.toLowerCase().includes(searchLower)) ||
                    (t.constellation && t.constellation.toLowerCase().includes(searchLower))
                )
            }

            // Sort by elevation (highest first) - best viewing first
            transformedTargets.sort((a, b) => b.elevation - a.elevation)

            setTargets(transformedTargets)
        } catch (err) {
            showToast({ type: 'error', message: 'Failed to load targets' })
            console.error('Failed to fetch targets:', err)
        } finally {
            setIsLoading(false)
        }
    }

    // Calculate trend (rising/setting/transit) based on session time vs rise/set times
    function calculateTrend(sessionTime, riseTime, setTime) {
        if (!riseTime || !setTime) return { direction: '●', label: 'Circumpolar' }

        const sessionMinutes = sessionTime.getTime()
        const riseMinutes = riseTime.getTime()
        const setMinutes = setTime.getTime()
        const transitTime = (riseMinutes + setMinutes) / 2

        // Within 30 min of transit = high point
        if (Math.abs(sessionMinutes - transitTime) < 30 * 60 * 1000) {
            return { direction: '●', label: 'Highest point' }
        }

        // Before transit = rising, after = setting
        if (sessionMinutes < transitTime) {
            return { direction: '↗', label: 'Rising' }
        }
        return { direction: '↘', label: 'Setting' }
    }

    // Calculate transit (highest point) time from rise and set times
    function calculateTransitTime(riseTime, setTime) {
        if (!riseTime || !setTime) return null
        const transit = new Date((riseTime.getTime() + setTime.getTime()) / 2)
        return transit.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    }

    // Validate that the selected slot is marked available by the backend
    const isSelectedSlotAvailable = useMemo(() => {
        if (!sessionDate || !startTime || !availableSlots || availableSlots.length === 0) {
            return false
        }
        return availableSlots.some(
            s => s.date === sessionDate && s.startTime === startTime && s.available === true
        )
    }, [sessionDate, startTime, availableSlots])

    const canProceed = useMemo(() => {
        switch (currentStep) {
            case 1:
                return sessionDate && startTime && endTime && startTime < endTime && isSelectedSlotAvailable
            case 2:
                // Must have at least one target, and not exceed max
                return selectedTargets.length > 0 && selectedTargets.length <= maxTargets
            case 3:
                return sessionTitle.trim().length > 0
            default:
                return false
        }
    }, [currentStep, sessionDate, startTime, endTime, isSelectedSlotAvailable, selectedTargets, maxTargets, sessionTitle])

    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1)
        }
    }

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        } else {
            navigate('/bookings')
        }
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            await api.post('/api/bookings', {
                targets: selectedTargets.map(t => ({ id: t.id, name: t.name })),
                targetCount: selectedTargets.length,
                date: sessionDate,
                startTime,
                endTime,
                title: sessionTitle,
                description: sessionDescription
            })
            showToast({ type: 'success', message: 'Booking created successfully!' })
            navigate('/bookings')
        } catch (err) {
            showToast({ type: 'error', message: 'Failed to create booking' })
            console.error('Failed to create booking:', err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleApplyFilters = () => {
        fetchTargets()
    }

    return (
        <div className="page-shell">
            <TopBar activePath="/bookings" />

            <main className="new-booking-page">
                <div className="new-booking-container">
                    {/* Header with Step Indicator */}
                    <header className="new-booking-header">
                        <h1 className="new-booking-title">New Booking</h1>
                        <div className="step-indicator">
                            {STEPS.map((step, index) => (
                                <div
                                    key={step.id}
                                    className={`step-item ${currentStep === step.id ? 'step-item--active' : ''} ${currentStep > step.id ? 'step-item--completed' : ''}`}
                                >
                                    <div className="step-number">{step.id}</div>
                                    <div className="step-label">{step.label}</div>
                                    {index < STEPS.length - 1 && (
                                        <div className="step-connector" />
                                    )}
                                </div>
                            ))}
                        </div>
                        <button className="new-booking-close" onClick={() => navigate('/bookings')}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </header>

                    {/* Step Content */}
                    <div className="step-content">
                        {currentStep === 1 && (
                            <Step1Schedule
                                sessionDate={sessionDate}
                                setSessionDate={setSessionDate}
                                startTime={startTime}
                                setStartTime={setStartTime}
                                endTime={endTime}
                                setEndTime={setEndTime}
                                onDurationChange={setSessionDuration}
                                onAvailabilityChange={setAvailableSlots}
                            />
                        )}

                        {currentStep === 2 && (
                            <Step2SelectTarget
                                targets={targets}
                                filters={filters}
                                setFilters={setFilters}
                                selectedTargets={selectedTargets}
                                setSelectedTargets={setSelectedTargets}
                                maxTargets={maxTargets}
                                onApplyFilters={handleApplyFilters}
                                isLoading={isLoading}
                            />
                        )}

                        {currentStep === 3 && (
                            <Step3Confirm
                                selectedTargets={selectedTargets}
                                maxTargets={maxTargets}
                                sessionDate={sessionDate}
                                startTime={startTime}
                                endTime={endTime}
                                sessionTitle={sessionTitle}
                                setSessionTitle={setSessionTitle}
                                sessionDescription={sessionDescription}
                                setSessionDescription={setSessionDescription}
                            />
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="step-footer">
                        <button
                            className="step-btn step-btn--secondary"
                            onClick={handleBack}
                            disabled={isSubmitting}
                        >
                            {currentStep === 1 ? 'Cancel' : 'Back'}
                        </button>

                        {currentStep < 3 ? (
                            <button
                                className="step-btn step-btn--primary"
                                onClick={handleNext}
                                disabled={!canProceed}
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                className="step-btn step-btn--primary"
                                onClick={handleSubmit}
                                disabled={!canProceed || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="step-btn-spinner" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Booking'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

export default NewBooking
