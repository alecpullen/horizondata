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
    const canApprove  = teacher.account_status === 'pending' || teacher.account_status === 'suspended'
    const canSuspend  = teacher.account_status === 'approved'

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
            {!teacher.email_verified && (
                <button
                    className="teacher-btn teacher-btn--verify"
                    disabled={busy}
                    onClick={() => onAction(teacher.id, 'verify-email')}
                >
                    Verify Email
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
            .then(res => { setTeachers(res.data.items ?? []); setLoading(false) })
            .catch(err => { setError(err.response?.status?.toString() || err.message); setLoading(false) })
    }, [])

    useEffect(() => { load() }, [load])

    const handleAction = useCallback(async (id, action) => {
        setBusyIds(prev => new Set(prev).add(id))
        try {
            const name = teachers.find(t => t.id === id)?.name ?? 'Teacher'
            if (action === 'verify-email') {
                const res = await api.patch(`/api/admin/teachers/${id}`, { email_verified: true })
                setTeachers(prev => prev.map(t =>
                    t.id === id ? { ...t, email_verified: res.data.email_verified } : t
                ))
                showToast({ type: 'success', message: `${name}'s email marked as verified.` })
            } else {
                const newStatus = action === 'approve' ? 'approved' : 'suspended'
                await api.patch(`/api/admin/teachers/${id}`, { status: newStatus })
                setTeachers(prev => prev.map(t =>
                    t.id === id ? { ...t, account_status: newStatus } : t
                ))
                showToast({
                    type: 'success',
                    message: action === 'approve'
                        ? `${name} approved — they can now log in.`
                        : `${name} suspended.`,
                })
            }
        } catch {
            showToast({ type: 'error', message: 'Action failed. Please try again.' })
        } finally {
            setBusyIds(prev => { const s = new Set(prev); s.delete(id); return s })
        }
    }, [teachers, showToast])

    const counts = TABS.reduce((acc, tab) => {
        acc[tab] = tab === 'all' ? teachers.length : teachers.filter(t => t.account_status === tab).length
        return acc
    }, {})

    const visible = activeTab === 'all'
        ? teachers
        : teachers.filter(t => t.account_status === activeTab)

    return (
        <div className="admin-teachers">
            <div className="admin-teachers-header">
                <h2 className="admin-teachers-title">Teachers</h2>
                <p className="admin-teachers-desc">Manage teacher accounts, registrations, and access permissions.</p>
            </div>

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
                                <th>Email</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map(t => (
                                <tr key={t.id}>
                                    <td className="teacher-cell-name">
                                        <span>{t.name}</span>
                                    </td>
                                    <td className="teacher-cell-email">{t.email}</td>
                                    <td className="teacher-cell-date">{formatDate(t.created_at)}</td>
                                    <td><StatusBadge status={t.account_status} /></td>
                                    <td>
                                        <span className={`teacher-badge teacher-badge--${t.email_verified ? 'verified' : 'unverified'}`}>
                                            {t.email_verified ? 'Verified' : 'Unverified'}
                                        </span>
                                    </td>
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
