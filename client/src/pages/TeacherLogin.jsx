import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';
import { useAuth } from '../contexts/AuthContext';

const TeacherLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [errorSecondary, setErrorSecondary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { loginTeacher } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorSecondary(null);
    setIsLoading(true);
    try {
      const result = await loginTeacher(email, password);
      if (result.user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/bookings');
      }
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === 'email_not_verified') {
        setError('Please verify your email before signing in.');
        setErrorSecondary(
          <>
            Didn't receive the email?{' '}
            <Link to={`/verify-email?email=${encodeURIComponent(email)}`} className="auth-link">Resend it here</Link>
          </>
        );
      } else {
        setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <>
      <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
      <p>Are you a student? <Link to="/join">Join a session</Link></p>
    </>
  );

  return (
    <AuthShell
      title="Teacher Login"
      subtitle="Sign in to manage telescope sessions"
      footer={footer}
    >
      {error && (
        <div className="auth-error">
          <div>{error}</div>
          {errorSecondary && <div style={{ marginTop: '6px', fontSize: '0.875rem' }}>{errorSecondary}</div>}
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
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
          />
          <div style={{ textAlign: 'right', marginTop: '4px' }}>
            <Link to="/forgot-password" className="auth-link" style={{ fontSize: '0.8125rem' }}>
              Forgot password?
            </Link>
          </div>
        </div>
        <label className="auth-remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
          />
          Remember me
        </label>
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </AuthShell>
  );
};

export default TeacherLogin;
