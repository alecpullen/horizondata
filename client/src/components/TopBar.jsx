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
    const [fullName, setFullName] = useState('')
    const [mswEnabled, setMswEnabled] = useState(() => {
        const stored = localStorage.getItem('msw-enabled')
        return stored === null ? true : stored === 'true'
    })
    const accountDropdownRef = useRef(null)
    const liveViewDropdownRef = useRef(null)

    // Persist MSW toggle state
    useEffect(() => {
        localStorage.setItem('msw-enabled', mswEnabled.toString())
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
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const isAccountActive = accountLinks.some(link => link.path === activePath)
    const isLiveViewActive = navLinks[0].children.some(link => link.path === activePath)

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
                <div className="avatar">
                    {fullName
                        ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        : '??'}
                </div>
            </div>

        </header>
    )
}

export default TopBar