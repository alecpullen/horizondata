import StreamView from '../components/StreamView'
import AppLogo from '../components/AppLogo'
import './StudentView.css'

const SESSION = {
    object:      'Saturn',
    description: 'The sixth planet from the Sun, famous for its stunning ring system made of ice and rock.',
    funFact:     'Saturn\'s rings are mostly made of ice chunks ranging from tiny grains to pieces as big as a house.',
}

const STUDENT = {
    name:         'Student A',
    captureCount:  2,
}

function StudentView() {
    return (
        <div className="sv-shell">
            <header className="sv-topbar">
                <div className="sv-topbar-left">
                    <AppLogo />
                </div>
                <div className="sv-session-info">
                    Observing <strong>{SESSION.object}</strong>
                </div>
                <div className="sv-topbar-right">
                    <span className="sv-capture-count">{STUDENT.captureCount} captures</span>
                    <div className="sv-avatar">{STUDENT.name[0]}</div>
                </div>
            </header>

            <div className="sv-feed-area">
                <StreamView label="Primary · Telescope Feed" />

                <div className="sv-object-overlay">
                    <div className="sv-object-name">{SESSION.object}</div>
                    <div className="sv-object-desc">{SESSION.description}</div>
                    <div className="sv-fun-fact">{SESSION.funFact}</div>
                </div>
            </div>

            <div className="sv-actions">
                <button className="sv-capture-btn">
                    Capture Image
                </button>
            </div>

        </div>
    )
}

export default StudentView