import { useState, useEffect, useCallback, Fragment } from 'react'
import { useToast } from '../../components/ui/ToastProvider'
import './AdminQueue.css'

const POLL_MS = 10000

const STATUS_META = {
    pending: { label: 'Pending', mod: 'gold'  },
    running: { label: 'Running', mod: 'teal'  },
    done:    { label: 'Done',    mod: 'grey'  },
    aborted: { label: 'Aborted', mod: 'red'   },
}

function StatusBadge({ status }) {
    const meta = STATUS_META[status] ?? { label: status, mod: 'grey' }
    return <span className={`queue-badge queue-badge--${meta.mod}`}>{meta.label}</span>
}

function fmtScheduled(iso) {
    const d = new Date(iso)
    const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    return `${date}, ${time}`
}

function AdminQueue() {
    const { showToast } = useToast()
    const [jobs, setJobs]           = useState([])
    const [loading, setLoading]     = useState(true)
    const [error, setError]         = useState(null)
    const [confirmingId, setConfirmingId] = useState(null)
    const [busyId, setBusyId]       = useState(null)

    const fetchQueue = useCallback(() => {
        fetch('/api/admin/queue')
            .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
            .then(data => { setJobs(data); setLoading(false); setError(null) })
            .catch(err => { setError(err.message); setLoading(false) })
    }, [])

    useEffect(() => {
        fetchQueue()
        const id = setInterval(fetchQueue, POLL_MS)
        return () => clearInterval(id)
    }, [fetchQueue])

    const handleAbort = useCallback(async (jobId, title) => {
        setBusyId(jobId)
        try {
            const r = await fetch(`/api/admin/queue/${jobId}/abort`, { method: 'POST' })
            if (!r.ok) throw new Error()
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'aborted' } : j))
            setConfirmingId(null)
            showToast({ type: 'success', message: `"${title}" aborted.` })
        } catch {
            showToast({ type: 'error', message: 'Could not abort job.' })
        } finally {
            setBusyId(null)
        }
    }, [showToast])

    if (loading) {
        return <div className="admin-queue"><p className="queue-empty">Loading…</p></div>
    }

    return (
        <div className="admin-queue">
            <div className="queue-section-header">
                <h2 className="queue-section-title">Observation Queue</h2>
                <span className="queue-poll-indicator" title="Polling every 10s">
                    <span className="queue-poll-dot" />
                    Live
                </span>
            </div>

            {error && <p className="queue-empty queue-empty--error">Error: {error}</p>}

            {jobs.length === 0 ? (
                <p className="queue-empty">No jobs in the queue.</p>
            ) : (
                <div className="queue-table-wrap">
                    <table className="queue-table">
                        <thead>
                            <tr>
                                <th>Booking</th>
                                <th>Teacher</th>
                                <th>Scheduled</th>
                                <th>Targets</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(job => {
                                const confirming = confirmingId === job.id
                                const canAbort   = job.status === 'pending' || job.status === 'running'
                                return (
                                    <Fragment key={job.id}>
                                        <tr className={confirming ? 'queue-row--confirming' : ''}>
                                            <td className="queue-cell-title">{job.title}</td>
                                            <td>{job.teacherName}</td>
                                            <td className="queue-cell-mono">{fmtScheduled(job.scheduledAt)}</td>
                                            <td className="queue-cell-targets">
                                                {job.targetsCompleted} of {job.targetsTotal} done
                                            </td>
                                            <td><StatusBadge status={job.status} /></td>
                                            <td>
                                                {canAbort && (
                                                    <button
                                                        className={'queue-btn queue-btn--abort' + (confirming ? ' active' : '')}
                                                        disabled={busyId === job.id}
                                                        onClick={() => confirming
                                                            ? setConfirmingId(null)
                                                            : setConfirmingId(job.id)
                                                        }
                                                    >
                                                        {confirming ? 'Cancel' : 'Abort'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {confirming && (
                                            <tr className="queue-confirm-drawer">
                                                <td colSpan={6}>
                                                    <div className="queue-confirm-body">
                                                        <span className="queue-confirm-msg">
                                                            Abort <strong>{job.title}</strong>? This cannot be undone.
                                                        </span>
                                                        <div className="queue-confirm-actions">
                                                            <button
                                                                className="queue-btn queue-btn--abort-confirm"
                                                                disabled={busyId === job.id}
                                                                onClick={() => handleAbort(job.id, job.title)}
                                                            >
                                                                {busyId === job.id ? 'Aborting…' : 'Yes, abort'}
                                                            </button>
                                                            <button
                                                                className="queue-btn queue-btn--ghost"
                                                                disabled={busyId === job.id}
                                                                onClick={() => setConfirmingId(null)}
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
            )}
        </div>
    )
}

export default AdminQueue
