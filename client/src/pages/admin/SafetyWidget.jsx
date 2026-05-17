import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '../../components/ui/ToastProvider'
import api from '../../lib/api'
import './SafetyWidget.css'

const POLL_MS    = 15000
const DURATIONS  = [
    { key: '15m', label: '15 min', mins: 15 },
    { key: '1h',  label: '1 hr',   mins: 60 },
    { key: 'custom', label: 'Custom', mins: null },
]

const STATUS_META = {
    ACTIVE:       { label: 'Active',       mod: 'green' },
    FORCE_OPEN:   { label: 'Force open',   mod: 'teal'  },
    CLOSED:       { label: 'Closed',       mod: 'grey'  },
    FORCE_CLOSED: { label: 'Force closed', mod: 'red'   },
    UNSAFE:       { label: 'Unsafe',       mod: 'red'   },
}

function formatCountdown(expiresAt) {
    const ms = new Date(expiresAt) - Date.now()
    if (ms <= 0) return '0:00'
    const totalSecs = Math.floor(ms / 1000)
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
}

function SafetyWidget() {
    const { showToast } = useToast()
    const [data, setData]               = useState(null)
    const [loading, setLoading]         = useState(true)
    const [busy, setBusy]               = useState(false)
    const [duration, setDuration]       = useState('15m')
    const [customMins, setCustomMins]   = useState('')
    const [countdown, setCountdown]     = useState('')
    const countdownRef                  = useRef(null)

    const fetchStatus = useCallback((quiet = false) => {
        if (!quiet) setLoading(true)
        fetch('/api/admin/safety/status')
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    // Poll every 15s
    useEffect(() => {
        fetchStatus()
        const id = setInterval(() => fetchStatus(true), POLL_MS)
        return () => clearInterval(id)
    }, [fetchStatus])

    // Countdown ticker — runs every second when override is active
    useEffect(() => {
        clearInterval(countdownRef.current)
        if (data?.override?.expiresAt) {
            const tick = () => setCountdown(formatCountdown(data.override.expiresAt))
            tick()
            countdownRef.current = setInterval(tick, 1000)
        } else {
            setCountdown('')
        }
        return () => clearInterval(countdownRef.current)
    }, [data?.override?.expiresAt])

    const resolvedMins = useCallback(() => {
        if (duration === 'custom') {
            const n = parseInt(customMins, 10)
            return isNaN(n) || n <= 0 ? null : n
        }
        return DURATIONS.find(d => d.key === duration)?.mins ?? null
    }, [duration, customMins])

    const handleOverride = useCallback(async (state) => {
        const mins = resolvedMins()
        if (!mins) {
            showToast({ type: 'error', message: 'Enter a valid duration.' })
            return
        }
        setBusy(true)
        try {
            const r = await fetch('/api/admin/safety/override', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state, durationMins: mins }),
            })
            if (!r.ok) throw new Error()
            const d = await r.json()
            setData(d)
            showToast({ type: 'success', message: `Safety forced ${state.toLowerCase()} for ${mins < 60 ? `${mins} min` : `${mins / 60}h`}.` })
        } catch {
            showToast({ type: 'error', message: 'Override failed.' })
        } finally { setBusy(false) }
    }, [resolvedMins, showToast])

    const handleClear = useCallback(async () => {
        setBusy(true)
        try {
            const r = await fetch('/api/admin/safety/override', { method: 'DELETE' })
            if (!r.ok) throw new Error()
            const d = await r.json()
            setData(d)
            showToast({ type: 'success', message: 'Override cleared — reverting to automatic.' })
        } catch {
            showToast({ type: 'error', message: 'Could not clear override.' })
        } finally { setBusy(false) }
    }, [showToast])

    const meta      = STATUS_META[data?.status] ?? { label: data?.status ?? '—', mod: 'grey' }
    const hasOverride = !!data?.override
    const canSubmit = resolvedMins() !== null

    return (
        <div className={`safety-widget safety-widget--${meta.mod}`}>
            <h3 className="safety-widget-title">Safety System</h3>

            {/* Status row */}
            <div className="safety-status-row">
                <div className="safety-status-left">
                    <span className={`safety-dot safety-dot--${meta.mod}`} />
                    <span className={`safety-status-label safety-status-label--${meta.mod}`}>
                        {loading ? '…' : meta.label}
                    </span>
                </div>
                <span className="safety-source">
                    {data ? (data.source === 'manual' ? 'Manual override' : 'Automatic') : ''}
                </span>
            </div>

            {/* Countdown */}
            {hasOverride && countdown && (
                <div className="safety-countdown">
                    Expires in <span className="safety-countdown-value">{countdown}</span>
                </div>
            )}

            <div className="safety-divider" />

            {hasOverride ? (
                /* Clear override */
                <div className="safety-override-section">
                    <button
                        className="safety-btn safety-btn--clear"
                        disabled={busy}
                        onClick={handleClear}
                    >
                        {busy ? 'Clearing…' : 'Clear override'}
                    </button>
                </div>
            ) : (
                /* Force override controls */
                <div className="safety-override-section">
                    <span className="safety-override-label">Force override</span>

                    <div className="safety-duration-row">
                        {DURATIONS.map(d => (
                            <label key={d.key} className="safety-duration-opt">
                                <input
                                    type="radio"
                                    name="safety-duration"
                                    checked={duration === d.key}
                                    onChange={() => setDuration(d.key)}
                                />
                                <span>{d.label}</span>
                            </label>
                        ))}
                        {duration === 'custom' && (
                            <input
                                className="safety-custom-input"
                                type="number"
                                min="1"
                                max="1440"
                                placeholder="min"
                                value={customMins}
                                onChange={e => setCustomMins(e.target.value)}
                                autoFocus
                            />
                        )}
                    </div>

                    <div className="safety-action-row">
                        <button
                            className="safety-btn safety-btn--open"
                            disabled={busy || !canSubmit}
                            onClick={() => handleOverride('OPEN')}
                        >
                            Force open
                        </button>
                        <button
                            className="safety-btn safety-btn--close"
                            disabled={busy || !canSubmit}
                            onClick={() => handleOverride('CLOSED')}
                        >
                            Force closed
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SafetyWidget
