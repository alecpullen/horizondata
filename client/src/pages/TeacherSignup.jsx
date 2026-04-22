import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';
import { useAuth } from '../contexts/AuthContext';

const TeacherSignup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signupTeacher } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await signupTeacher(email, password, name);
      navigate('/bookings');
    } catch (err) {
      const code = err.response?.data?.error;
      const message = err.response?.data?.message || 'Registration failed';
      if (code === 'email_exists') {
        setError('An account with this email already exists');
      } else if (code === 'validation_error') {
        setError(message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <p>Already have an account? <Link to="/login">Sign in</Link></p>
  );

  return (
    <AuthShell
      title="Teacher Registration"
      subtitle="Create an account to manage telescope sessions"
      footer={footer}
    >
      {error && <div className="auth-error">{error}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="name">Full Name</label>
          <input
            className="auth-input"
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="John Doe"
          />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">Email</label>
          <input
            className="auth-input"
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="teacher@example.com"
          />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">Password</label>
          <input
            className="auth-input"
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            minLength={8}
          />
          <span className="auth-hint">Must be at least 8 characters</span>
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="confirmPassword">Confirm Password</label>
          <input
            className="auth-input"
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
    </AuthShell>
  );
};

export default TeacherSignup;
