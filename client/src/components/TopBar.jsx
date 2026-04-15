import { useState, useRef, useEffect } from 'react'
import AppLogo from './AppLogo'
import './TopBar.css'

const navLinks = [
    { label: 'Live View (teacher)',   path: '/live/teacher'       },
    { label: 'Live View (student)',   path: '/live/student'       },
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
    const dropdownRef = useRef(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setAccountOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const isAccountActive = accountLinks.some(link => link.path === activePath)

    return (
        <header className="topbar">

            <AppLogo />

            <nav className="topbar-nav">
                {navLinks.map(link => (
                    <a
                        key={link.path}
                        href={link.path}
                        className={`nav-link ${activePath === link.path ? 'active' : ''}`}
                    >
                        {link.label}
                    </a>
                ))}

                {/* Account Dropdown */}
                <div className="nav-dropdown" ref={dropdownRef}>
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
                <div className="sys-status">
                    <span className="status-dot online" />
                    ONLINE
                </div>
                <div className="avatar">MM</div>
            </div>

        </header>
    )
}

export default TopBar