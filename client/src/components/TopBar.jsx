import { useState, useRef, useEffect } from 'react'
import AppLogo from './AppLogo'
import './TopBar.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const navLinks = [
    {
        label: 'Live View',
        children: [
            { label: 'Teacher', path: '/live/teacher' },
            { label: 'Student', path: '/live/student' },
        ],
    },
    { label: 'Scheduling',  path: '/scheduling'  },
    { label: 'Sky Chart',   path: '/sky-chart'   },
    { label: 'Captures',    path: '/captures'    },
]

const accountLinks = [
    { label: 'My Bookings', path: '/bookings' },
    { label: 'My Account',  path: '/account'  },
]

function TopBar({ activePath }) {
    const [accountOpen, setAccountOpen] = useState(false)
    const [liveViewOpen, setLiveViewOpen] = useState(false)
    const [avatarOpen, setAvatarOpen] = useState(false)
    const [fullName, setFullName] = useState('')
    const [userRole, setUserRole] = useState('')
    const [mswEnabled, setMswEnabled] = useState(() => {
        const stored = localStorage.getItem('msw-enabled')
        return stored === null ? true : stored === 'true'
    })
    const accountDropdownRef = useRef(null)
    const liveViewDropdownRef = useRef(null)
    const avatarDropdownRef = useRef(null)

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

    // Fetch user info on mount
    useEffect(() => {
        async function fetchUser() {
            try {
                const response = await fetch(`${API_BASE}/api/account`, {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                })
                if (response.ok) {
                    const data = await response.json()
                    setFullName(data.fullName || '')
                    setUserRole(data.role || '')
                }
            } catch (err) {
                // Silently fail - avatar will show placeholder
                console.error('Failed to fetch user:', err)
            }
        }
        fetchUser()
    }, [])

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
                setAccountOpen(false)
            }
            if (liveViewDropdownRef.current && !liveViewDropdownRef.current.contains(event.target)) {
                setLiveViewOpen(false)
            }
            if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(event.target)) {
                setAvatarOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const isAccountActive = accountLinks.some(link => link.path === activePath)
    const isLiveViewActive = navLinks[0].children.some(link => link.path === activePath)

    const handleLogout = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            })
            if (response.ok) {
                window.location.href = '/login'
            } else {
                console.error('Logout failed')
            }
        } catch (err) {
            console.error('Logout error:', err)
        }
    }

    return (
        <header className="topbar">

            <AppLogo />

            <nav className="topbar-nav">
                {/* Live View Dropdown */}
                <div className="nav-dropdown" ref={liveViewDropdownRef}>
                    <button
                        className={`nav-link nav-link--dropdown ${isLiveViewActive ? 'active' : ''}`}
                        onClick={() => setLiveViewOpen(!liveViewOpen)}
                        aria-expanded={liveViewOpen}
                    >
                        Live View
                        <svg
                            className={`dropdown-arrow ${liveViewOpen ? 'dropdown-arrow--open' : ''}`}
                            viewBox="0 0 24 24"
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {liveViewOpen && (
                        <div className="dropdown-menu">
                            {navLinks[0].children.map(link => (
                                <a
                                    key={link.path}
                                    href={link.path}
                                    className={`dropdown-item ${activePath === link.path ? 'dropdown-item--active' : ''}`}
                                    onClick={() => setLiveViewOpen(false)}
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {navLinks.slice(1).map(link => (
                    <a
                        key={link.path}
                        href={link.path}
                        className={`nav-link ${activePath === link.path ? 'active' : ''}`}
                    >
                        {link.label}
                    </a>
                ))}

                {/* Account Dropdown */}
                <div className="nav-dropdown" ref={accountDropdownRef}>
                    <button
                        className={`nav-link nav-link--dropdown ${isAccountActive ? 'active' : ''}`}
                        onClick={() => setAccountOpen(!accountOpen)}
                        aria-expanded={accountOpen}
                    >
                        Account
                        <svg
                            className={`dropdown-arrow ${accountOpen ? 'dropdown-arrow--open' : ''}`}
                            viewBox="0 0 24 24"
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {accountOpen && (
                        <div className="dropdown-menu">
                            {accountLinks.map(link => (
                                <a
                                    key={link.path}
                                    href={link.path}
                                    className={`dropdown-item ${activePath === link.path ? 'dropdown-item--active' : ''}`}
                                    onClick={() => setAccountOpen(false)}
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </nav>

            <div className="topbar-right">
                <label className="msw-toggle" title="Toggle mock API">
                    <span className="msw-toggle-label">MOCK API</span>
                    <input
                        type="checkbox"
                        checked={mswEnabled}
                        onChange={(e) => setMswEnabled(e.target.checked)}
                    />
                    <span className="msw-toggle-slider" />
                </label>

                {/* Avatar Dropdown */}
                <div className="avatar-dropdown" ref={avatarDropdownRef}>
                    <button
                        className="avatar avatar--button"
                        onClick={() => setAvatarOpen(!avatarOpen)}
                        aria-expanded={avatarOpen}
                        aria-label="User menu"
                        title={fullName || 'Guest'}
                    >
                        {fullName
                            ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                            : '??'}
                    </button>

                    {avatarOpen && (
                        <div className="avatar-menu">
                            <div className="avatar-menu-header">
                                <div className="avatar-menu-initials">
                                    {fullName
                                        ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                        : '??'}
                                </div>
                                <div className="avatar-menu-info">
                                    <div className="avatar-menu-name">{fullName || 'Guest User'}</div>
                                    {userRole && (
                                        <div className="avatar-menu-role">{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</div>
                                    )}
                                </div>
                            </div>
                            <div className="avatar-menu-divider" />
                            <a
                                href="/account"
                                className="avatar-menu-item"
                                onClick={() => setAvatarOpen(false)}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                My Account
                            </a>
                            <a
                                href="/bookings"
                                className="avatar-menu-item"
                                onClick={() => setAvatarOpen(false)}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                My Bookings
                            </a>
                            <a
                                href="/settings"
                                className="avatar-menu-item"
                                onClick={() => setAvatarOpen(false)}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                                Settings
                            </a>
                            <a
                                href="/help"
                                className="avatar-menu-item"
                                onClick={() => setAvatarOpen(false)}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                Help & Support
                            </a>
                            <div className="avatar-menu-divider" />
                            <button
                                className="avatar-menu-item avatar-menu-item--danger"
                                onClick={handleLogout}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Log Out
                            </button>
                        </div>
                    )}
                </div>
            </div>

        </header>
    )
}

export default TopBar