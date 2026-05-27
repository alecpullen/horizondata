import { Link } from 'react-router-dom'
import './AccountNav.css'

const accountLinks = [
    { label: 'My Bookings', path: '/bookings' },
    { label: 'My Account',  path: '/account'  },
]

function AccountNav({ activePath }) {
    return (
        <nav className="account-nav">
            <div className="account-nav__container">
                {accountLinks.map(link => (
                    <Link
                        key={link.path}
                        to={link.path}
                        className={`account-nav__link ${activePath === link.path ? 'account-nav__link--active' : ''}`}
                    >
                        {link.label}
                    </Link>
                ))}
            </div>
        </nav>
    )
}

export default AccountNav
