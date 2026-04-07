import { useState } from 'react'
import { split } from '../utils/session'
import './SessionLobby.css'

const JOIN_CODE = '483920'
const INITIAL_STUDENTS = [
    { id: 1, name: 'Student A'},
    { id: 2, name: 'Student B'},
    { id: 3, name: 'Student C'},
]

function SessionLobby() {
    const [students] = useState(INITIAL_STUDENTS)
    const digits = split(JOIN_CODE)

    return (
        <div className="lobby-shell">
            {/*header*/}
            <header className="lobby-header">
                <div className="lobby-logo"> Horizon Data</div>
                <div className="lobby-session-info">Sun 22 August 2026 - 20:00 - 20:10 AEST - HD-2026-0841</div>
            </header>

            <div className="lobby-body">
                <div className="lobby-left">
                    <div className="lobby-instruction">
                        Join at <strong>https://URL</strong> and enter:
                    </div>
                    <div className="lobby-code">
                        {digits.map((digit, i) => (
                            <div key={i} className="lobby-code-tile">
                                {digit}
                            </div>
                        ))}
                    </div>

                    {/*TODO QR code*/}
                    <div className="lobby-qr">
                        <div className="lobby-qr-box">
                            <div className="lobby-qr-inner">QR</div>
                        </div>
                        <div className="lobby-qr-label">Scan to join</div>
                    </div>
                </div>

                <div className="lobby-divider" />

                <div className="lobby-right">
                    <div className="lobby-roster-heading">
                        <span>Students Joined</span>
                        <span className="lobby-count">{students.length}</span>
                    </div>

                    <ul className="lobby-roster">
                        {students.map(student => (
                            <li key={student.id} className="lobby-roster-item">
                                <div className="lobby-student-avatar">
                                    {student.name[0]}
                                </div>
                                <span className="lobby-student-name">{student.name}</span>
                                <span className="lobby-joined-tick">✔️</span>
                            </li>
                        ))}
                    </ul>

                    {students.length === 0 && (
                        <div className="lobby-empty">
                            Waiting for students to join...
                        </div>
                    )}
                </div>
            </div>

            {/*footer*/}
            <div className="lobby-footer">
                <div className="lobby-status">
                    <span className="lobby-status-dot" />
                    Session ready - waiting for students
                </div>
            </div>
        </div>
    )
}

export default SessionLobby