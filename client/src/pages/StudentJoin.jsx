import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLogo from '../components/AppLogo'
import './StudentJoin.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function StudentJoin() {
    const navigate = useNavigate()
    const inputRef = useRef(null)
    const nameRef = useRef(null)

    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [bookingId, setBookingId] = useState(null)
    const [step, setStep] = useState('code') // 'code' | 'name'
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    // MSW toggle state - synced with localStorage
    const [mswEnabled, setMswEnabled] = useState(() => {
        const stored = localStorage.getItem('msw-enabled')
        return stored === null ? true : stored === 'true'
    })

    // Persist MSW toggle state and reload to apply changes
    useEffect(() => {
        const prev = localStorage.getItem('msw-enabled')
        const next = mswEnabled.toString()
        if (prev !== null && prev !== next) {
            localStorage.setItem('msw-enabled', next)
            window.location.reload()
        } else {
            localStorage.setItem('msw-enabled', next)
        }
    }, [mswEnabled])

    async function handleCodeSubmit() {
        if (code.length < 6) {
            setError('Please enter the full 6 digit code.')
            return
        }

        setLoading(true)
        setError('')

        try {
            const response = await fetch(`${API_BASE}/api/sessions/lookup`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ joinCode: code })
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success && data.bookingId) {
                    setBookingId(data.bookingId)
                    setStep('name')
                    // Focus the name input on the next tick
                    setTimeout(() => nameRef.current?.focus(), 0)
                } else {
                    setError('Invalid join code')
                }
            } else {
                setError('Invalid join code')
            }
        } catch (err) {
            console.error('Error looking up session:', err)
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    async function handleNameSubmit() {
        const trimmed = name.trim()
        if (!trimmed) {
            setError('Please enter your name.')
            return
        }

        setLoading(true)
        setError('')

        try {
            const joinResponse = await fetch(`${API_BASE}/api/sessions/${bookingId}/join`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ joinCode: code, name: trimmed })
            })

            if (joinResponse.ok) {
                navigate(`/student/lobby/${bookingId}`, { state: { name: trimmed } })
            } else {
                const errorData = await joinResponse.json().catch(() => ({}))
                setError(errorData.error || 'Failed to join session')
            }
        } catch (err) {
            console.error('Error joining session:', err)
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    function handleInput(e) {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6)
        setCode(value)
        if (error) setError('')
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') handleCodeSubmit()
    }

    function handleNameKeyDown(e) {
        if (e.key === 'Enter') handleNameSubmit()
    }

    return (
        <div className="sj-shell">
            <div className="sj-blob sj-blob--1" />
            <div className="sj-blob sj-blob--2" />

            <div className="sj-card">
                <AppLogo />

                <h1 className="sj-heading">Join a Session</h1>
                <p className="sj-sub">
                    {step === 'code'
                        ? 'Enter the 6 digit code shown on your classroom screen'
                        : 'Enter your name so your teacher knows who has joined'}
                </p>

                {step === 'code' ? (
                    <>
                        <div className="sj-input-wrap">
                            <input
                                className="sj-input"
                                ref={inputRef}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="000000"
                                value={code}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                        </div>

                        <div className="sj-digit-row" onClick={() => inputRef.current?.focus()}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className={`sj-digit ${code[i] ? 'filled' : ''}`}>
                                    {code[i] || ''}
                                </div>
                            ))}
                        </div>

                        {error && <div className="sj-error">{error}</div>}
                        <button
                            className={`sj-btn ${code.length === 6 ? 'ready' : ''}`}
                            onClick={handleCodeSubmit}
                            disabled={loading || code.length < 6}
                        >
                            {loading ? 'Checking...' : 'Next'}
                        </button>
                    </>
                ) : (
                    <>
                        <input
                            ref={nameRef}
                            className="sj-name-input"
                            type="text"
                            placeholder="Your name"
                            value={name}
                            maxLength={40}
                            onChange={(e) => {
                                setName(e.target.value)
                                if (error) setError('')
                            }}
                            onKeyDown={handleNameKeyDown}
                            required
                        />

                        {error && <div className="sj-error">{error}</div>}

                        <button
                            className={`sj-btn ${name.trim() ? 'ready' : ''}`}
                            onClick={handleNameSubmit}
                            disabled={loading || !name.trim()}
                        >
                            {loading ? 'Joining...' : 'Join'}
                        </button>

                        <button
                            type="button"
                            className="sj-back-btn"
                            onClick={() => {
                                setStep('code')
                                setError('')
                            }}
                            disabled={loading}
                        >
                            ← Use a different code
                        </button>
                    </>
                )}

                {/* Mock API Toggle */}
                <label className="sj-msw-toggle" title="Toggle mock API">
                    <span className="sj-msw-label">Mock API</span>
                    <input
                        type="checkbox"
                        checked={mswEnabled}
                        onChange={(e) => setMswEnabled(e.target.checked)}
                    />
                    <span className="sj-msw-slider" />
                </label>
            </div>
        </div>
    )
}

export default StudentJoin