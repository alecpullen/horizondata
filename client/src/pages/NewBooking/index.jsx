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
    { id: 2, label: 'Select Target' },
    { id: 3, label: 'Confirm Details' }
]

// Default filter values
const DEFAULT_FILTERS = {
    scope: 'all', // all, deep, planetary, stellar
    visibleNow: false,
    magnitude: [0, 15],
    popular: false,
    search: ''
}

function NewBooking() {
    const navigate = useNavigate()
    const { showToast } = useToast()
    const [currentStep, setCurrentStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)

    // Step 1: Target selection
    const [targets, setTargets] = useState([])
    const [filters, setFilters] = useState(DEFAULT_FILTERS)
    const [selectedTarget, setSelectedTarget] = useState(null)

    // Step 2: Scheduling
    const [sessionDate, setSessionDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')

    // Step 3: Session details
    const [sessionTitle, setSessionTitle] = useState('')
    const [sessionDescription, setSessionDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Fetch targets on mount with default filters
    useEffect(() => {
        fetchTargets()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Update session title when target changes
    useEffect(() => {
        if (selectedTarget) {
            setSessionTitle(`Observation: ${selectedTarget.name}`)
        }
    }, [selectedTarget])

    async function fetchTargets() {
        setIsLoading(true)
        try {
            // Build query params from filters
            const params = new URLSearchParams()
            if (filters.scope && filters.scope !== 'all') params.append('scope', filters.scope)
            if (filters.visibleNow) params.append('visibleNow', 'true')
            if (filters.popular) params.append('popular', 'true')
            if (filters.magnitude[0] > 0) params.append('minMag', filters.magnitude[0])
            if (filters.magnitude[1] < 15) params.append('maxMag', filters.magnitude[1])
            if (filters.search) params.append('search', filters.search)

            const response = await fetch(`${API_BASE}/api/space-objects?${params}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = await response.json()
            // Transform API response to target format
            setTargets(data.items || data.objects || data || [])
        } catch (err) {
            showToast({ type: 'error', message: 'Failed to load targets' })
            console.error('Failed to fetch targets:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const canProceed = useMemo(() => {
        switch (currentStep) {
            case 1:
                return sessionDate && startTime && endTime && startTime < endTime
            case 2:
                return selectedTarget !== null
            case 3:
                return sessionTitle.trim().length > 0
            default:
                return false
        }
    }, [currentStep, sessionDate, startTime, endTime, selectedTarget, sessionTitle])

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
                    targetId: selectedTarget.id,
                    targetName: selectedTarget.name,
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
                    {/* Header */}
                    <header className="new-booking-header">
                        <h1 className="new-booking-title">New Booking</h1>
                        <button className="new-booking-close" onClick={() => navigate('/bookings')}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </header>

                    {/* Step Indicator */}
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
                            />
                        )}

                        {currentStep === 2 && (
                            <Step2SelectTarget
                                targets={targets}
                                filters={filters}
                                setFilters={setFilters}
                                selectedTarget={selectedTarget}
                                setSelectedTarget={setSelectedTarget}
                                onApplyFilters={handleApplyFilters}
                                isLoading={isLoading}
                            />
                        )}

                        {currentStep === 3 && (
                            <Step3Confirm
                                selectedTarget={selectedTarget}
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
