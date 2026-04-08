import AppLogo from './AppLogo'
import './TopBar.css'

const navLinks = [
    { label: 'Live View',   path: '/live'       },
    { label: 'Scheduling',  path: '/scheduling'  },
    { label: 'Sky Chart',   path: '/sky-chart'   },
    { label: 'Captures',    path: '/captures'    },
    { label: 'Account',     path: '/bookings'    },
]

function TopBar({ activePath }) {
    return (
        <header className="topbar">

            <AppLogo />

            <nav className="topbar-nav">
                {navLinks.map(link => (<a key={link.path} href={link.path} className={`nav-link ${activePath === link.path ? 'active' : ''}`}>{link.label}</a>))}
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