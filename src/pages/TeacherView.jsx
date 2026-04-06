import TopBar from '../components/TopBar'
import StreamPlaceholder from '../components/StreamPlaceholder'
import './TeacherView.css'

const SESSION = {
    date:      'Sun 22 Aug 2026',
    time:      '20:00 – 20:10 AEST',
    ref:       'HD-2026-0841',
    object:    'Saturn',
    telescope: 'Bundoora',
}

const STUDENTS = [
    { id: 1, name: 'Student A' },
    { id: 2, name: 'Student B' },
    { id: 3, name: 'Student C' },
    { id: 4, name: 'Student D'},
    { id: 5, name: 'Student E'},
]

function TeacherView() {
    return (
        <div className="tv-shell">
            <TopBar activePath="/live/teacher" />
            <div className="tv-body">
                <div className="tv-feed-area">
                    <StreamPlaceholder label="Primary · Telescope Feed" />
                    <div className="tv-pip">
                        <StreamPlaceholder label="Site Camera" />
                    </div>
                </div>

                {/*sidebar*/}
                <aside className="tv-sidebar">

                    {/*session info*/}
                    <div className="tv-sidebar-section">
                        <div className="tv-sidebar-label">Session</div>
                        <div className="tv-session-ref">{SESSION.ref}</div>
                        <div className="tv-session-date">{SESSION.date}</div>
                        <div className="tv-session-time">{SESSION.time}</div>
                    </div>

                    {/*current object*/}
                    <div className="tv-sidebar-section">
                        <div className="tv-sidebar-label">Current Object</div>
                        <div className="tv-object-name">{SESSION.object}</div>
                        <div className="tv-object-scope">{SESSION.telescope}</div>
                    </div>

                    {/*students in session */}
                    <div className="tv-sidebar-section tv-sidebar-section--grow">
                        <div className="tv-sidebar-label">
                            Students in Session — {STUDENTS.length}
                        </div>
                        <ul className="tv-student-list">
                            {STUDENTS.map(student => (
                                <li key={student.id} className="tv-student-item">
                                    <div className="student-avatar">
                                        {student.name[0]}
                                    </div>
                                    <span className="student-name">{student.name}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/*buttons*/}
                    <div className="tv-sidebar-section tv-actions">
                        <button className="tv-btn tv-btn--capture">
                            Capture Image
                        </button>
                        <button className="tv-btn tv-btn--danger">
                            End Session
                        </button>
                    </div>

                </aside>
            </div>
        </div>
    )
}

export default TeacherView