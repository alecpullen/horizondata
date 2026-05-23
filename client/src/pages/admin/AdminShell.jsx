import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AppLogo from '../../components/AppLogo'
import './AdminShell.css'

const NAV_LINKS = [
    { to: '/admin',          label: 'Dashboard', end: true },
    { to: '/admin/teachers', label: 'Teachers' },
    { to: '/admin/bookings', label: 'Bookings' },
    { to: '/admin/sessions', label: 'Sessions' },
    { to: '/admin/safety',   label: 'Safety' },
    { to: '/admin/queue',    label: 'Queue' },
    { to: '/admin/settings', label: 'Settings' },
]

function AdminShell() {
    const { user, logoutTeacher } = useAuth()
    const navigate = useNavigate()

    function handleLogout() {
        logoutTeacher()
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
                <div className="admin-header-user">
                    <span className="admin-header-name">{user?.fullName ?? user?.email}</span>
                    <button className="admin-header-logout" onClick={handleLogout}>Log out</button>
                </div>
            </header>

            <div className="admin-body">
                <nav className="admin-sidebar">
                    {NAV_LINKS.map(({ to, label, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                'admin-nav-link' + (isActive ? ' active' : '')
                            }
                        >
                            {label}
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
