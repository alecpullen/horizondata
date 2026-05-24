import { useEffect, useState, useCallback, Fragment } from 'react'
import { useToast } from '../../components/ui/ToastProvider'
import api from '../../lib/api'
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
                        const confirming = terminatingId === s.id
                        return (
                            <Fragment key={s.id}>
                                <tr className={confirming ? 'sess-row--confirming' : ''}>
                                    <td className="sess-cell-title">{s.title}</td>
                                    <td>{s.teacher_name}</td>
                                    <td className="sess-cell-mono">{fmtTime(s.started_at)}</td>
                                    <td className="sess-cell-mono">{duration(s.started_at)}</td>
                                    <td className="sess-cell-center">
                                        <span className="sess-student-count">{s.student_count}</span>
                                    </td>
                                    <td className="sess-cell-mono sess-join-code">{s.session_code}</td>
                                    <td>
                                        <button
                                            className={'sess-btn sess-btn--terminate' + (confirming ? ' active' : '')}
                                            disabled={busyId === s.id}
                                            onClick={() => confirming
                                                ? setTerminatingId(null)
                                                : setTerminatingId(s.id)
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
                                                    This will immediately end the session for all {s.student_count} connected student{s.student_count !== 1 ? 's' : ''}. Continue?
                                                </span>
                                                <div className="sess-confirm-actions">
                                                    <button
                                                        className="sess-btn sess-btn--terminate-confirm"
                                                        disabled={busyId === s.id}
                                                        onClick={() => onTerminate(s.id, s.title)}
                                                    >
                                                        {busyId === s.id ? 'Terminating…' : 'Yes, terminate'}
                                                    </button>
                                                    <button
                                                        className="sess-btn sess-btn--ghost"
                                                        disabled={busyId === s.id}
                                                        onClick={() => setTerminatingId(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
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
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(s => (
                        <tr key={s.id}>
                            <td className="sess-cell-title">{s.title}</td>
                            <td>{s.teacher_name}</td>
                            <td>{fmtDate(s.started_at)}</td>
                            <td className="sess-cell-mono">{duration(s.started_at, s.ended_at)}</td>
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

    const fetchSessions = useCallback(() => {
        api.get('/api/admin/sessions')
            .then(res => {
                const all = res.data.items ?? []
                setActive(all.filter(s => s.status === 'active'))
                setPast(all.filter(s => s.status !== 'active'))
                setLoadingPast(false)
                setError(null)
            })
            .catch(err => {
                setError(err.response?.status?.toString() || err.message)
                setLoadingPast(false)
            })
    }, [])

    // Poll all sessions every 5s — active table stays live, past updates too
    useEffect(() => {
        fetchSessions()
        const id = setInterval(fetchSessions, POLL_MS)
        return () => clearInterval(id)
    }, [fetchSessions])

    const handleTerminate = useCallback(async (sessionId, title) => {
        setBusyId(sessionId)
        try {
            await api.post(`/api/admin/sessions/${sessionId}/terminate`)
            setActive(prev => prev.filter(s => s.id !== sessionId))
            setTerminatingId(null)
            // Re-fetch so the terminated session appears in past
            api.get('/api/admin/sessions')
                .then(res => {
                    const all = res.data.items ?? []
                    setPast(all.filter(s => s.status !== 'active'))
                })
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
            <div className="admin-sessions-header">
                <h2 className="admin-sessions-title">Sessions</h2>
                <p className="admin-sessions-desc">Monitor and manage active and past telescope observation sessions.</p>
            </div>

            <div className="sessions-page-content">
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
        </div>
    )
}

export default AdminSessions
