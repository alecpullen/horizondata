import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { rawApi } from '../lib/api';

const useRememberStorage = (() => {
  const storages = [localStorage, sessionStorage];
  return {
    getItem: (key) => {
      for (const s of storages) {
        const v = s.getItem(key);
        if (v != null) return v;
      }
      return null;
    },
    setItem: (key, value, remember) => {
      storages.forEach(s => s.removeItem(key));
      (remember ? localStorage : sessionStorage).setItem(key, value);
    },
    removeItem: (key) => storages.forEach(s => s.removeItem(key)),
  };
})();

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [userType, setUserType] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load auth state from storage on mount
  useEffect(() => {
    const loadAuthState = () => {
      const storedUserType = useRememberStorage.getItem('userType');
      const storedToken = useRememberStorage.getItem('token');
      const storedSessionId = useRememberStorage.getItem('sessionId');
      const storedUser = useRememberStorage.getItem('user');

      let parsedUser = null;
      try {
        parsedUser = storedUser ? JSON.parse(storedUser) : null;
      } catch (e) {
        console.error('[AuthContext] Error parsing stored user JSON:', e);
        useRememberStorage.removeItem('user');
        useRememberStorage.removeItem('userType');
        useRememberStorage.removeItem('token');
        useRememberStorage.removeItem('sessionId');
        useRememberStorage.removeItem('refreshToken');
        useRememberStorage.removeItem('__rememberMe');
      }

      if (storedUserType === 'teacher' && storedToken && parsedUser) {
        // Normalize user data to include both 'name' and 'fullName'
        const normalizedUser = {
          ...parsedUser,
          fullName: parsedUser.fullName || parsedUser.name || '',
        };

        setUserType('teacher');
        setToken(storedToken);
        setUser(normalizedUser);
        setIsAuthenticated(true);
      } else if (storedUserType === 'student' && storedSessionId && parsedUser) {
        setUserType('student');
        setSessionId(storedSessionId);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } else {
        // Clear state if something is corrupt or missing
        setUserType(null);
        setUser(null);
        setIsAuthenticated(false);
      }

      setIsLoading(false);
    };

    loadAuthState();
  }, []);

  // Teacher signup
  const signupTeacher = useCallback(async (email, password, name) => {
    const response = await api.post('/api/auth/teacher/signup', {
      email,
      password,
      name,
    });

    const { user, token, refresh_token } = response.data;

    // Normalize user data to include both 'name' and 'fullName'
    const normalizedUser = {
      ...user,
      fullName: user.name || '',
    }

    // Store auth state (always remember on signup)
    useRememberStorage.setItem('userType', 'teacher', true);
    useRememberStorage.setItem('token', token, true);
    useRememberStorage.setItem('refreshToken', refresh_token, true);
    useRememberStorage.setItem('user', JSON.stringify(normalizedUser), true);
    useRememberStorage.setItem('__rememberMe', 'true', true);

    setUserType('teacher');
    setToken(token);
    setUser(normalizedUser);
    setIsAuthenticated(true);

    return response.data;
  }, []);

  // Teacher login
  const loginTeacher = useCallback(async (email, password, rememberMe = false) => {
    try {
      const response = await api.post('/api/auth/teacher/login', {
        email,
        password,
      });

      const { user, token, refresh_token } = response.data;

      const normalizedUser = {
        ...user,
        fullName: user.name || '',
      }

      useRememberStorage.setItem('userType', 'teacher', rememberMe);
      useRememberStorage.setItem('token', token, rememberMe);
      useRememberStorage.setItem('refreshToken', refresh_token, rememberMe);
      useRememberStorage.setItem('user', JSON.stringify(normalizedUser), rememberMe);
      useRememberStorage.setItem('__rememberMe', String(rememberMe), rememberMe);

      setUserType('teacher');
      setToken(token);
      setUser(normalizedUser);
      setIsAuthenticated(true);

      return response.data;
    } catch (err) {
      const errorCode = err.response?.data?.error
      if (errorCode === 'account_pending') {
        return { success: false, error: 'account_pending' }
      }
      if (errorCode === 'email_not_verified') {
        return { success: false, error: 'email_not_verified' }
      }
      if (err.response?.status === 401) {
        return { success: false, error: 'invalid_credentials' }
      }
      // Network errors, 5xx, etc. still throw so Login.jsx catch handles them
      throw err
    }
  }, []);

  // Teacher logout
  const logoutTeacher = useCallback(async () => {
    try {
      await api.post('/api/auth/teacher/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear auth state from both storages
    useRememberStorage.removeItem('userType');
    useRememberStorage.removeItem('token');
    useRememberStorage.removeItem('refreshToken');
    useRememberStorage.removeItem('user');
    useRememberStorage.removeItem('__rememberMe');

    setUserType(null);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Student join session
  const joinAsStudent = useCallback(async (displayName, sessionCode) => {
    const response = await api.post('/api/auth/student/join', {
      display_name: displayName,
      session_code: sessionCode,
    });

    const { session_id, display_name, observation_session_id } = response.data;

    const studentUser = {
      id: session_id,
      display_name: display_name,
      observation_session_id: observation_session_id,
      user_type: 'student',
    };

    // Store auth state
    localStorage.setItem('userType', 'student');
    localStorage.setItem('sessionId', session_id);
    localStorage.setItem('user', JSON.stringify(studentUser));

    setUserType('student');
    setSessionId(session_id);
    setUser(studentUser);
    setIsAuthenticated(true);

    return response.data;
  }, []);

  // Student leave session
  const leaveAsStudent = useCallback(async () => {
    try {
      await api.post('/api/auth/student/leave');
    } catch (error) {
      console.error('Leave error:', error);
    }

    // Clear auth state from both storages
    useRememberStorage.removeItem('userType');
    useRememberStorage.removeItem('sessionId');
    useRememberStorage.removeItem('user');
    useRememberStorage.removeItem('__rememberMe');

    setUserType(null);
    setSessionId(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Refresh token (for teachers)
  const refreshToken = useCallback(async () => {
    const storedRefreshToken = useRememberStorage.getItem('refreshToken');
    if (!storedRefreshToken) return null;

    try {
      const response = await rawApi.post('/api/auth/teacher/refresh', {}, {
        headers: { Authorization: `Bearer ${storedRefreshToken}` },
      });

      const { token, refresh_token } = response.data;

      // Store in same storage as original tokens (check rememberMe flag)
      const remember = localStorage.getItem('__rememberMe') === 'true';
      useRememberStorage.setItem('token', token, remember);
      useRememberStorage.setItem('refreshToken', refresh_token, remember);
      setToken(token);

      return response.data;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logoutTeacher();
      return null;
    }
  }, [logoutTeacher]);

  // Get current user info
  const getCurrentUser = useCallback(async () => {
    if (userType === 'teacher') {
      const response = await api.get('/api/auth/teacher/me');
      const user = response.data.user
      // Normalize user data to include both 'name' and 'fullName'
      const normalizedUser = {
        ...user,
        fullName: user.name || '',
      }
        setUser(normalizedUser);
      useRememberStorage.setItem('user', JSON.stringify(normalizedUser), useRememberStorage.getItem('__rememberMe') === 'true');
      return response.data;
    } else if (userType === 'student') {
      const response = await api.get('/api/auth/student/me');
      setUser(response.data.user);
      useRememberStorage.setItem('user', JSON.stringify(response.data.user), true);
      return response.data;
    }
  }, [userType]);

  // Kick student (teacher only)
  const kickStudent = useCallback(async (studentSessionId, reason = '') => {
    const response = await api.post('/api/auth/teacher/kick', {
      student_session_id: studentSessionId,
      reason,
    });
    return response.data;
  }, []);

  // List participants (teacher only)
  const listParticipants = useCallback(async (observationSessionId) => {
    const response = await api.get('/api/auth/teacher/participants', {
      params: { observation_session_id: observationSessionId },
    });
    return response.data;
  }, []);

  const value = {
    userType,
    user,
    token,
    sessionId,
    isAuthenticated,
    isLoading,
    isTeacher: userType === 'teacher',
    isStudent: userType === 'student',
    signupTeacher,
    loginTeacher,
    logoutTeacher,
    joinAsStudent,
    leaveAsStudent,
    refreshToken,
    getCurrentUser,
    kickStudent,
    listParticipants,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
