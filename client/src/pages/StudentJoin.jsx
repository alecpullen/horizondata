import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';
import { useAuth } from '../contexts/AuthContext';

const StudentJoin = () => {
  const [displayName, setDisplayName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { joinAsStudent } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (displayName.length > 50) {
      setError('Name must be 50 characters or less');
      return;
    }
    if (!sessionCode.trim()) {
      setError('Please enter the session code');
      return;
    }

    setIsLoading(true);
    try {
      await joinAsStudent(displayName.trim(), sessionCode.trim().toUpperCase());
      navigate('/lobby');
    } catch (err) {
      const code = err.response?.data?.error;
      const message = err.response?.data?.message || 'Failed to join session';
      if (code === 'session_not_found') {
        setError('Session not found or has ended. Please check the session code.');
      } else if (code === 'validation_error') {
        setError(message);
      } else {
        setError('Failed to join session. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <p>Are you a teacher? <Link to="/login">Sign in here</Link></p>
  );

  return (
    <AuthShell
      title="Join Session"
      subtitle="Enter the session code provided by your teacher"
      footer={footer}
    >
      {error && <div className="auth-error">{error}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="displayName">Your Name</label>
          <input
            className="auth-input"
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            placeholder="Student Alex"
            maxLength={50}
          />
          <span className="auth-hint">Visible to your teacher and other students</span>
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="sessionCode">Session Code</label>
          <input
            className="auth-input"
            type="text"
            id="sessionCode"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            required
            placeholder="ABC123"
            style={{ textTransform: 'uppercase' }}
          />
          <span className="auth-hint">6-character code from your teacher</span>
        </div>
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading ? 'Joining…' : 'Join Session'}
        </button>
      </form>
    </AuthShell>
  );
};

export default StudentJoin;
