import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AppLogo from '../../components/AppLogo'
import './AdminShell.css'

const NAV_LINKS = [
    {
        to: '/admin', label: 'Dashboard', end: true,
        icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    },
    {
        to: '/admin/teachers', label: 'Teachers',
        icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
        to: '/admin/bookings', label: 'Bookings',
        icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
        to: '/admin/sessions', label: 'Sessions',
        icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
    },
    {
        to: '/admin/safety', label: 'Safety',
        icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    },
    {
        to: '/admin/queue', label: 'Queue',
        icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    },
    {
        to: '/admin/settings', label: 'Settings',
        icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    },
]

function AdminShell() {
    const { user, logoutTeacher } = useAuth()
    const navigate = useNavigate()
    const [avatarOpen, setAvatarOpen] = useState(false)
    const avatarRef = useRef(null)

    useEffect(() => {
        function handleClickOutside(e) {
            if (avatarRef.current && !avatarRef.current.contains(e.target)) {
                setAvatarOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const fullName = user?.fullName || user?.name || ''
    const initials = fullName
        ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : (user?.email?.[0] ?? '?').toUpperCase()
    const userRole = user?.role || ''

    async function handleLogout() {
        await logoutTeacher()
        navigate('/login', { replace: true })
    }

    return (
        <div className="admin-shell">
            <header className="admin-header">
                <div className="admin-header-brand">
                    <AppLogo />
                    <span className="admin-header-sep">/</span>
                    <span className="admin-header-section">Admin</span>
                </div>

                <div className="admin-avatar-wrap" ref={avatarRef}>
                    <button
                        className="admin-avatar-btn"
                        onClick={() => setAvatarOpen(o => !o)}
                        aria-expanded={avatarOpen}
                        aria-label="User menu"
                        title={fullName || 'User menu'}
                    >
                        {initials}
                    </button>

                    {avatarOpen && (
                        <div className="admin-avatar-menu">
                            <div className="admin-avatar-menu-header">
                                <div className="admin-avatar-menu-initials">{initials}</div>
                                <div className="admin-avatar-menu-info">
                                    <div className="admin-avatar-menu-name">{fullName || user?.email || 'User'}</div>
                                    {userRole && (
                                        <div className="admin-avatar-menu-role">
                                            {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="admin-avatar-menu-divider" />
                            <a
                                href="/bookings"
                                className="admin-avatar-menu-item"
                                onClick={() => setAvatarOpen(false)}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15 3 21 3 21 9"/>
                                    <polyline points="9 21 3 21 3 15"/>
                                    <line x1="21" y1="3" x2="14" y2="10"/>
                                    <line x1="3" y1="21" x2="10" y2="14"/>
                                </svg>
                                Switch to Teacher View
                            </a>
                            <div className="admin-avatar-menu-divider" />
                            <button
                                className="admin-avatar-menu-item admin-avatar-menu-item--danger"
                                onClick={handleLogout}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                    <polyline points="16 17 21 12 16 7"/>
                                    <line x1="21" y1="12" x2="9" y2="12"/>
                                </svg>
                                Log Out
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <div className="admin-body">
                <nav className="admin-sidebar">
                    {NAV_LINKS.map(({ to, label, end, icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                'admin-nav-link' + (isActive ? ' active' : '')
                            }
                        >
                            {icon}
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <main className="admin-content">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

export default AdminShell
