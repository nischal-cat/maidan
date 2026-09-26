/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { authAPI } from '../services/api';
import { signInWithGoogle, signOutOfFirebase } from '../lib/firebase';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: User };

const initialState: AuthState = {
  user: null,
  token: null,
  loading: true,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, loading: true, error: null };
    case 'AUTH_SUCCESS':
      return { ...state, loading: false, user: action.payload.user, token: action.payload.token, error: null };
    case 'AUTH_FAILURE':
      return { ...state, loading: false, error: action.payload };
    case 'LOGOUT':
      return { ...state, user: null, token: null, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'UPDATE_USER':
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  register: (data: FormData | { name: string; email: string; password: string; phone?: string; role?: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<User | null>;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  resendOtp: (phone: string) => Promise<void>;
  googleSignIn: () => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem('maidan_token');
    const userStr = localStorage.getItem('maidan_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
      } catch {
        localStorage.removeItem('maidan_token');
        localStorage.removeItem('maidan_user');
        dispatch({ type: 'AUTH_FAILURE', payload: 'Invalid session' });
      }
    } else {
      dispatch({ type: 'AUTH_FAILURE', payload: '' });
    }
  }, []);

  const login = async (email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await authAPI.login({ email, password });
      localStorage.setItem('maidan_token', res.data.token);
      localStorage.setItem('maidan_user', JSON.stringify(res.data.user));
      dispatch({ type: 'AUTH_SUCCESS', payload: res.data });
      return res.data.user;
    } catch (err: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: err.response?.data?.message || 'Login failed' });
      throw err;
    }
  };

  const register = async (data: FormData | { name: string; email: string; password: string; phone?: string; role?: string }) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await authAPI.register(data);
      localStorage.setItem('maidan_token', res.data.token);
      localStorage.setItem('maidan_user', JSON.stringify(res.data.user));
      dispatch({ type: 'AUTH_SUCCESS', payload: res.data });
    } catch (err: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: err.response?.data?.message || 'Registration failed' });
      throw err;
    }
  };

  const logout = () => {
    void signOutOfFirebase().catch(() => {});
    localStorage.removeItem('maidan_token');
    localStorage.removeItem('maidan_user');
    localStorage.removeItem('maidan_pending_booking');
    dispatch({ type: 'LOGOUT' });
  };

  const clearError = () => dispatch({ type: 'CLEAR_ERROR' });

  const updateUser = (user: User) => {
    localStorage.setItem('maidan_user', JSON.stringify(user));
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  const refreshUser = async () => {
    try {
      const res = await authAPI.me();
      localStorage.setItem('maidan_user', JSON.stringify(res.data.user));
      dispatch({ type: 'UPDATE_USER', payload: res.data.user });
      return res.data.user;
    } catch {
      return null;
    }
  };

  const sendOtp = async (phone: string) => {
    await authAPI.sendOtp(phone);
  };

  const verifyOtp = async (phone: string, code: string) => {
    const res = await authAPI.verifyOtp(phone, code);
    updateUser(res.data.user);
  };

  const resendOtp = async (phone: string) => {
    await authAPI.resendOtp(phone);
  };

  const googleSignIn = async () => {
    dispatch({ type: 'AUTH_START' });
    try {
      const idToken = await signInWithGoogle();
      const res = await authAPI.firebaseGoogle(idToken);
      localStorage.setItem('maidan_token', res.data.token);
      localStorage.setItem('maidan_user', JSON.stringify(res.data.user));
      dispatch({ type: 'AUTH_SUCCESS', payload: res.data });
      return res.data.user;
    } catch (err: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: err.response?.data?.message || err.message || 'Google sign-in failed' });
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError, updateUser, refreshUser, sendOtp, verifyOtp, resendOtp, googleSignIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
