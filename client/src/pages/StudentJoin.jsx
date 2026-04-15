import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLogo from '../components/AppLogo'
import './StudentJoin.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function StudentJoin() {
    const navigate = useNavigate()
    const inputRef = useRef(null)

    const [code, setCode] = useState('')
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

    async function handleJoin() {
        if (code.length < 6) {
            setError('Please enter the full 6 digit code.')
            return
        }

        setLoading(true)
        setError('')

        try {
            // First, find the session with this join code
            // For now, we'll try joining with a lookup - this is a simplified flow
            // In production, the backend would have a lookup endpoint for join codes
            const response = await fetch(`${API_BASE}/api/sessions/lookup`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ joinCode: code })
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success && data.bookingId) {
                    // Now join the session
                    const joinResponse = await fetch(`${API_BASE}/api/sessions/${data.bookingId}/join`, {
                        method: 'POST',
                        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ joinCode: code })
                    })

                    if (joinResponse.ok) {
                        navigate(`/live/student?bookingId=${data.bookingId}`)
                    } else {
                        const errorData = await joinResponse.json()
                        setError(errorData.error || 'Failed to join session')
                    }
                } else {
                    setError('Invalid join code')
                }
            } else {
                setError('Invalid join code')
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
        if (error) setError(error)
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') handleJoin()
    }

    return (
        <div className="sj-shell">
            <div className="sj-blob sj-blob--1" />
            <div className="sj-blob sj-blob--2" />

            <div className="sj-card">
                <AppLogo />

                <h1 className="sj-heading">Join a Session</h1>
                <p className="sj-sub">Enter the 6 digit code shown on your classroom screen</p>

                {/*code input*/}
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
                    onClick={handleJoin}
                    disabled={loading || code.length < 6}
                >
                    {loading ? 'Joining...' : 'Join'}
                </button>

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