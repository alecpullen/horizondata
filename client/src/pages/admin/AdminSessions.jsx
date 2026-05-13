import { useEffect, useState, useCallback } from 'react'
import { useToast } from '../../components/ui/ToastProvider'
import './AdminSessions.css'

const POLL_MS = 5000

function duration(startIso, endIso) {
    const ms = new Date(endIso ?? Date.now()) - new Date(startIso)
    const totalMins = Math.floor(ms / 60000)
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}

function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PAST_STATUS_META = {
    ended:      { label: 'Ended',      mod: 'grey'  },
    terminated: { label: 'Terminated', mod: 'red'   },
}

function PastBadge({ status }) {
    const meta = PAST_STATUS_META[status] ?? { label: status, mod: 'grey' }
    return <span className={`sess-badge sess-badge--${meta.mod}`}>{meta.label}</span>
}

function ActiveTable({ sessions, onTerminate, terminatingId, setTerminatingId, busyId }) {
    if (sessions.length === 0) {
        return <p className="sess-empty">No active sessions right now.</p>
    }

    return (
        <div className="sess-table-wrap">
            <table className="sess-table">
                <thead>
                    <tr>
                        <th>Session</th>
                        <th>Teacher</th>
                        <th>Started</th>
                        <th>Duration</th>
                        <th>Students</th>
                        <th>Join code</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(s => {
                        const confirming = terminatingId === s.bookingId
                        return (
                            <>
                                <tr key={s.bookingId} className={confirming ? 'sess-row--confirming' : ''}>
                                    <td className="sess-cell-title">{s.title}</td>
                                    <td>{s.teacherName}</td>
                                    <td className="sess-cell-mono">{fmtTime(s.startedAt)}</td>
                                    <td className="sess-cell-mono">{duration(s.startedAt)}</td>
                                    <td className="sess-cell-center">
                                        <span className="sess-student-count">{s.studentCount}</span>
                                    </td>
                                    <td className="sess-cell-mono sess-join-code">{s.joinCode}</td>
                                    <td>
                                        <button
                                            className={'sess-btn sess-btn--terminate' + (confirming ? ' active' : '')}
                                            disabled={busyId === s.bookingId}
                                            onClick={() => confirming
                                                ? setTerminatingId(null)
                                                : setTerminatingId(s.bookingId)
                                            }
                                        >
                                            {confirming ? 'Cancel' : 'Terminate'}
                                        </button>
                                    </td>
                                </tr>

                                {confirming && (
                                    <tr className="sess-confirm-drawer">
                                        <td colSpan={7}>
                                            <div className="sess-confirm-body">
                                                <span className="sess-confirm-msg">
                                                    This will immediately end the session for all {s.studentCount} connected student{s.studentCount !== 1 ? 's' : ''}. Continue?
                                                </span>
                                                <div className="sess-confirm-actions">
                                                    <button
                                                        className="sess-btn sess-btn--terminate-confirm"
                                                        disabled={busyId === s.bookingId}
                                                        onClick={() => onTerminate(s.bookingId, s.title)}
                                                    >
                                                        {busyId === s.bookingId ? 'Terminating…' : 'Yes, terminate'}
                                                    </button>
                                                    <button
                                                        className="sess-btn sess-btn--ghost"
                                                        disabled={busyId === s.bookingId}
                                                        onClick={() => setTerminatingId(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function PastTable({ sessions }) {
    if (sessions.length === 0) {
        return <p className="sess-empty">No past sessions yet.</p>
    }

    return (
        <div className="sess-table-wrap">
            <table className="sess-table">
                <thead>
                    <tr>
                        <th>Session</th>
                        <th>Teacher</th>
                        <th>Date</th>
                        <th>Duration</th>
                        <th>Captures</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(s => (
                        <tr key={`${s.bookingId}-${s.startedAt}`}>
                            <td className="sess-cell-title">{s.title}</td>
                            <td>{s.teacherName}</td>
                            <td>{fmtDate(s.startedAt)}</td>
                            <td className="sess-cell-mono">{duration(s.startedAt, s.endedAt)}</td>
                            <td className="sess-cell-center">{s.captureCount}</td>
                            <td><PastBadge status={s.status} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function AdminSessions() {
    const { showToast } = useToast()
    const [active, setActive]           = useState([])
    const [past, setPast]               = useState([])
    const [loadingPast, setLoadingPast] = useState(true)
    const [error, setError]             = useState(null)
    const [terminatingId, setTerminatingId] = useState(null)
    const [busyId, setBusyId]           = useState(null)
    // Increment to force the duration columns to refresh each poll tick
    const [tick, setTick]               = useState(0)

    const fetchActive = useCallback(() => {
        fetch('/api/admin/sessions/active')
            .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
            .then(data => { setActive(data); setTick(t => t + 1); setError(null) })
            .catch(err => setError(err.message))
    }, [])

    // Poll active sessions every 5s
    useEffect(() => {
        fetchActive()
        const id = setInterval(fetchActive, POLL_MS)
        return () => clearInterval(id)
    }, [fetchActive])

    // Fetch past sessions once
    useEffect(() => {
        fetch('/api/admin/sessions/past')
            .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
            .then(data => { setPast(data); setLoadingPast(false) })
            .catch(err => { setError(err.message); setLoadingPast(false) })
    }, [])

    const handleTerminate = useCallback(async (bookingId, title) => {
        setBusyId(bookingId)
        try {
            const r = await fetch(`/api/admin/sessions/${bookingId}/terminate`, { method: 'POST' })
            if (!r.ok) throw new Error()
            setActive(prev => prev.filter(s => s.bookingId !== bookingId))
            setTerminatingId(null)
            // Re-fetch past so the terminated session appears
            fetch('/api/admin/sessions/past')
                .then(r => r.json())
                .then(setPast)
                .catch(() => {})
            showToast({ type: 'success', message: `"${title}" terminated.` })
        } catch {
            showToast({ type: 'error', message: 'Could not terminate session.' })
        } finally {
            setBusyId(null)
        }
    }, [showToast])

    return (
        <div className="admin-sessions">
            <div className="sess-section">
                <div className="sess-section-header">
                    <h2 className="sess-section-title">Active Sessions</h2>
                    <span className="sess-poll-indicator" title="Polling every 5s">
                        <span className="sess-poll-dot" />
                        Live
                    </span>
                </div>

                {error && <p className="sess-empty sess-empty--error">Error: {error}</p>}
                <ActiveTable
                    sessions={active}
                    onTerminate={handleTerminate}
                    terminatingId={terminatingId}
                    setTerminatingId={setTerminatingId}
                    busyId={busyId}
                />
            </div>

            <div className="sess-section sess-section--past">
                <h2 className="sess-section-title">Past Sessions</h2>
                {loadingPast
                    ? <p className="sess-empty">Loading…</p>
                    : <PastTable sessions={past} />
                }
            </div>
        </div>
    )
}

export default AdminSessions
