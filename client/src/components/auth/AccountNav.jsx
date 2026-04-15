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
                    <a
                        key={link.path}
                        href={link.path}
                        className={`account-nav__link ${activePath === link.path ? 'account-nav__link--active' : ''}`}
                    >
                        {link.label}
                    </a>
                ))}
            </div>
        </nav>
    )
}

export default AccountNav
