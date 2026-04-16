import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../../components/TopBar'
import { useToast } from '../../components/ui/ToastProvider'
import Step1Schedule from './Step1Schedule'
import Step2SelectTarget from './Step2SelectTarget'
import Step3Confirm from './Step3Confirm'
import './NewBooking.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

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
            let transformedTargets = []
            let sessionInfo = null

            // Use session-aware API if we have date and times
            if (sessionDate && startTime && endTime) {
                // Convert local date/time to UTC ISO format
                const startDateTime = new Date(`${sessionDate}T${startTime}`)
                const endDateTime = new Date(`${sessionDate}T${endTime}`)
                
                // Handle crossing midnight
                if (endDateTime < startDateTime) {
                    endDateTime.setDate(endDateTime.getDate() + 1)
                }

                const params = new URLSearchParams({
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    min_elevation: '30'
                })

                const response = await fetch(`${API_BASE}/api/visibility/session?${params}`, {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`)
                }

                const data = await response.json()
                sessionInfo = data.session

                // Transform session API response to target format
                transformedTargets = (data.targets || []).map(target => {
                    // Quality mapping: excellent/good/fair/poor to our display system
                    const qualityMap = {
                        'excellent': 'good',
                        'good': 'good',
                        'fair': 'fair',
                        'poor': 'poor',
                        'not_visible': 'poor'
                    }

                    return {
                        id: target.name.toLowerCase().replace(/\s+/g, '-'),
                        name: target.name,
                        type: target.type,
                        // Coordinates
                        rightAscension: target.coordinates?.ra || null,
                        declination: target.coordinates?.dec || null,
                        ra: target.coordinates?.ra_hours?.toFixed(2) + 'h',
                        dec: target.coordinates?.dec_degrees?.toFixed(2) + '°',
                        altitude: target.elevation_max?.toFixed(1) + '°',
                        elevation: target.elevation_max,
                        azimuth: null,
                        // Magnitude
                        magnitude: target.magnitude ?? null,
                        isVisible: target.quality_grade !== 'not_visible',
                        // Session-aware quality data
                        quality: qualityMap[target.quality_grade] || 'poor',
                        qualityGrade: target.quality_grade,
                        qualityScore: target.quality_score,
                        elevationStart: target.elevation_start,
                        elevationEnd: target.elevation_end,
                        elevationMin: target.elevation_min,
                        elevationMax: target.elevation_max,
                        transitsDuringSession: target.transits_during_session,
                        transitTime: target.transit_time,
                        visibleEntireSession: target.visible_entire_session,
                        setsDuringSession: target.sets_during_session,
                        bestTime: target.best_time,
                        recommendation: target.recommendation,
                        // Metadata
                        constellation: target.constellation || 'Unknown',
                        catalog: target.catalog_id || null,
                        description: null,
                        distance: null,
                        // Trend (simplified for session view)
                        trend: target.transits_during_session 
                            ? { direction: '●', label: 'Transits during session' }
                            : target.sets_during_session
                                ? { direction: '↘', label: 'Setting' }
                                : { direction: '↗', label: 'Rising' }
                    }
                })
            } else {
                // Fallback to basic visibility API if no session times
                const params = new URLSearchParams()
                if (filters.type && filters.type !== 'all') params.append('type', filters.type)

                const response = await fetch(`${API_BASE}/api/visibility/objects?${params}`, {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`)
                }

                const data = await response.json()

                transformedTargets = (data.objects || []).map(obj => {
                    const elevation = obj.coordinates?.elevation ?? 0
                    const quality = elevation > 45 ? 'good' : elevation > 20 ? 'fair' : 'poor'

                    return {
                        id: obj.name.toLowerCase().replace(/\s+/g, '-'),
                        name: obj.name,
                        type: obj.type,
                        rightAscension: obj.coordinates?.ra ? `${obj.coordinates.ra.toFixed(2)}h` : null,
                        declination: obj.coordinates?.dec ? `${obj.coordinates.dec > 0 ? '+' : ''}${obj.coordinates.dec.toFixed(2)}°` : null,
                        altitude: elevation.toFixed(1) + '°',
                        elevation: elevation,
                        azimuth: obj.coordinates?.azimuth ? `${obj.coordinates.azimuth.toFixed(1)}°` : null,
                        magnitude: obj.visibility?.magnitude ?? null,
                        isVisible: obj.visibility?.is_visible ?? false,
                        quality,
                        qualityGrade: null,
                        qualityScore: null,
                        constellation: obj.metadata?.constellation || 'Unknown',
                        catalog: obj.metadata?.catalog_id || null,
                        trend: { direction: '●', label: 'Current position' },
                        transitTime: null
                    }
                })
            }

            // Client-side search filtering
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                transformedTargets = transformedTargets.filter(t =>
                    t.name.toLowerCase().includes(searchLower) ||
                    (t.catalog && t.catalog.toLowerCase().includes(searchLower)) ||
                    (t.constellation && t.constellation.toLowerCase().includes(searchLower))
                )
            }

            // Sort by quality score (highest first) if available, otherwise by elevation
            transformedTargets.sort((a, b) => {
                if (a.qualityScore !== null && b.qualityScore !== null) {
                    return b.qualityScore - a.qualityScore
                }
                return b.elevation - a.elevation
            })

            setTargets(transformedTargets)
            
            // Store session info for display (moon phase, etc.)
            if (sessionInfo) {
                window.sessionVisibilityInfo = sessionInfo
            }
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

    const canProceed = useMemo(() => {
        switch (currentStep) {
            case 1:
                return sessionDate && startTime && endTime && startTime < endTime
            case 2:
                // Must have at least one target, and not exceed max
                return selectedTargets.length > 0 && selectedTargets.length <= maxTargets
            case 3:
                return sessionTitle.trim().length > 0
            default:
                return false
        }
    }, [currentStep, sessionDate, startTime, endTime, selectedTargets, maxTargets, sessionTitle])

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
            const response = await fetch(`${API_BASE}/api/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    targets: selectedTargets.map(t => ({ id: t.id, name: t.name })),
                    targetCount: selectedTargets.length,
                    date: sessionDate,
                    startTime,
                    endTime,
                    title: sessionTitle,
                    description: sessionDescription
                })
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

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
