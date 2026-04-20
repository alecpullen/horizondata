import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

    // Validation
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
      navigate('/lobby'); // Redirect to lobby after joining
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to join session';
      const code = err.response?.data?.error;
      
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

  return (
    <div className="join-container">
      <div className="join-card">
        <h1>Join Observation Session</h1>
        <p>Enter the session code provided by your teacher</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="displayName">Your Name</label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Student Alex"
              maxLength={50}
            />
            <small>This will be visible to your teacher and other students</small>
          </div>

          <div className="form-group">
            <label htmlFor="sessionCode">Session Code</label>
            <input
              type="text"
              id="sessionCode"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              required
              placeholder="ABC123"
              style={{ textTransform: 'uppercase' }}
            />
            <small>Enter the 6-character code from your teacher</small>
          </div>

          <button 
            type="submit" 
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Joining...' : 'Join Session'}
          </button>
        </form>

        <div className="join-footer">
          <p>
            Are you a teacher? <Link to="/login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentJoin;
