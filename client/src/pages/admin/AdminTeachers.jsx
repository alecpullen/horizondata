import { useEffect, useState, useCallback } from 'react'
import { useToast } from '../../components/ui/ToastProvider'
import api from '../../lib/api'
import './AdminTeachers.css'

const TABS = ['all', 'pending', 'approved', 'suspended']

const STATUS_LABEL = {
    pending:   'Pending',
    approved:  'Approved',
    suspended: 'Suspended',
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
    })
}

function StatusBadge({ status }) {
    return <span className={`teacher-badge teacher-badge--${status}`}>{STATUS_LABEL[status]}</span>
}

function ActionButton({ teacher, onAction, busy }) {
    const canApprove  = teacher.status === 'pending' || teacher.status === 'suspended'
    const canSuspend  = teacher.status === 'approved'

    return (
        <div className="teacher-actions">
            {canApprove && (
                <button
                    className="teacher-btn teacher-btn--approve"
                    disabled={busy}
                    onClick={() => onAction(teacher.id, 'approve')}
                >
                    Approve
                </button>
            )}
            {canSuspend && (
                <button
                    className="teacher-btn teacher-btn--suspend"
                    disabled={busy}
                    onClick={() => onAction(teacher.id, 'suspend')}
                >
                    Suspend
                </button>
            )}
        </div>
    )
}

function AdminTeachers() {
    const { showToast } = useToast()
    const [teachers, setTeachers]   = useState([])
    const [loading, setLoading]     = useState(true)
    const [error, setError]         = useState(null)
    const [activeTab, setActiveTab] = useState('all')
    const [busyIds, setBusyIds]     = useState(new Set())

    const load = useCallback(() => {
        setLoading(true)
        setError(null)
        api.get('/api/admin/teachers')
            .then(res => { setTeachers(res.data); setLoading(false) })
            .catch(err => { setError(err.response?.status?.toString() || err.message); setLoading(false) })
    }, [])

    useEffect(() => { load() }, [load])

    const handleAction = useCallback(async (id, action) => {
        setBusyIds(prev => new Set(prev).add(id))
        try {
            await api.post(`/api/admin/teachers/${id}/${action}`)
            // Update local state so the tab counts re-compute without a full refetch
            setTeachers(prev => prev.map(t =>
                t.id === id ? { ...t, status: action === 'approve' ? 'approved' : 'suspended' } : t
            ))
            const name = teachers.find(t => t.id === id)?.fullName ?? 'Teacher'
            showToast({
                type: 'success',
                message: action === 'approve'
                    ? `${name} approved — they can now log in.`
                    : `${name} suspended.`,
            })
        } catch {
            showToast({ type: 'error', message: 'Action failed. Please try again.' })
        } finally {
            setBusyIds(prev => { const s = new Set(prev); s.delete(id); return s })
        }
    }, [teachers, showToast])

    const counts = TABS.reduce((acc, tab) => {
        acc[tab] = tab === 'all' ? teachers.length : teachers.filter(t => t.status === tab).length
        return acc
    }, {})

    const visible = activeTab === 'all'
        ? teachers
        : teachers.filter(t => t.status === activeTab)

    return (
        <div className="admin-teachers">
            <h2 className="admin-teachers-title">Teachers</h2>

            <div className="teacher-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className={'teacher-tab' + (activeTab === tab ? ' active' : '')}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        <span className="teacher-tab-count">{counts[tab]}</span>
                    </button>
                ))}
            </div>

            {loading && <p className="teacher-empty">Loading…</p>}
            {error   && <p className="teacher-empty teacher-empty--error">Could not load teachers: {error}</p>}

            {!loading && !error && visible.length === 0 && (
                <p className="teacher-empty">No teachers in this category.</p>
            )}

            {!loading && !error && visible.length > 0 && (
                <div className="teacher-table-wrap">
                    <table className="teacher-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Registered</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map(t => (
                                <tr key={t.id}>
                                    <td className="teacher-cell-name">
                                        <span>{t.fullName}</span>
                                        <span className="teacher-institution">{t.institution}</span>
                                    </td>
                                    <td className="teacher-cell-email">{t.email}</td>
                                    <td className="teacher-cell-date">{formatDate(t.registeredAt)}</td>
                                    <td><StatusBadge status={t.status} /></td>
                                    <td>
                                        <ActionButton
                                            teacher={t}
                                            onAction={handleAction}
                                            busy={busyIds.has(t.id)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default AdminTeachers
