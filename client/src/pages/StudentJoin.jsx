import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLogo from '../components/AppLogo'
import './StudentJoin.css'

function StudentJoin() {
    const navigate = useNavigate()
    const inputRef = useRef(null)

    const [code, setCode] = useState('')
    const [error, setError] = useState('')

    function handleJoin() {
        if (code.length < 6) {
            setError('Please enter the full 6 digit code.')
            return
        }
        // TODO code validation

        navigate('/live/student')
    }

    function handleInput(e) {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6)
        setCode(value)
        if (error) setError(error)
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') handleJoin()
    }

    return (
        <div className="sj-shell">
            <div className="sj-blob sj-blob--1" />
            <div className="sj-blob sj-blob--2" />

            <div className="sj-card">
                <AppLogo />

                <h1 className="sj-heading">Join a Session</h1>
                <p className="sj-sub">Enter the 6 digit code shown on your classroom screen</p>

                {/*code input*/}
                <div className="sj-input-wrap">
                    <input
                        className="sj-input"
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        />
                </div>

                <div className="sj-digit-row" onClick={() => inputRef.current?.focus()}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`sj-digit ${code[i] ? 'filled' : ''}`}>
                            {code[i] || ''}
                        </div>
                    ))}
                </div>

                {error && <div className="sj-error">{error}</div>}
                <button className={`sj-btn ${code.length === 6 ? 'ready' : ''}`} onClick={handleJoin}>Join</button>
            </div>
        </div>
    )
}

export default StudentJoin