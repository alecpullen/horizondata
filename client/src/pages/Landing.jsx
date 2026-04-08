import { useNavigate } from 'react-router-dom'
import AppLogo from '../components/AppLogo'
import './Landing.css'

function RoleCard({ title, description, accent, onClick }) {
    return (
        <button className={`lp-card lp-card--${accent}`} onClick={onClick}>
            <div className="lp-card-title">{title}</div>
            <div className="lp-card-desc">{description}</div>
            <div className="lp-card-arrow">→</div>
        </button>
    )
}

function Landing() {
    const navigate = useNavigate()

    return (
        <div className="lp-shell">
            <div className="lp-blob lp-blob--1" />
            <div className="lp-blob lp-blob--2" />

            <div className="lp-content">
                <div className="lp-logo-wrap">
                    <AppLogo />
                </div>

                <h1 className="lp-heading">Welcome</h1>
                <p className="lp-sub">How are you joining today?</p>

                <div className="lp-cards">
                    <RoleCard
                        title="I'm a Teacher"
                        description="Manage bookings and run live telescope sessions"
                        accent="teal"
                        onClick={() => navigate('/bookings')}
                    />
                    <RoleCard
                        title="I'm a Student"
                        description="Join a session with your 6-digit code"
                        accent="gold"
                        onClick={() => navigate('/join')}
                    />
                </div>
            </div>
        </div>
    )
}

export default Landing
