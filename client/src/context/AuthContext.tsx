import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '../types';
import { authService } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../utils/constants';
import { useToast } from '../hooks/useToast';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchUser = async () => {
    try {
      const profile = await authService.getProfile();
      setUser(profile);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      console.error('Failed to fetch user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      const response: AuthResponse = await authService.login(credentials);
      setUser(response.user);
      setIsAuthenticated(true);
      showToast({ type: 'success', title: 'Login Successful', message: 'Welcome back!' });
      navigate(ROUTES.DASHBOARD);
    } catch (error: any) {
      showToast({ type: 'error', title: 'Login Failed', message: error.message || 'Invalid credentials' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const response: AuthResponse = await authService.register(data);
      setUser(response.user);
      setIsAuthenticated(true);
      showToast({ type: 'success', title: 'Registration Successful', message: 'Welcome to Hikma!' });
      navigate(ROUTES.DASHBOARD);
    } catch (error: any) {
      showToast({ type: 'error', title: 'Registration Failed', message: error.message || 'Please check your details' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      showToast({ type: 'info', title: 'Logged Out', message: 'You have been successfully logged out.' });
      navigate(ROUTES.LOGIN);
    } catch (error: any) {
      showToast({ type: 'error', title: 'Logout Failed', message: error.message || 'An error occurred during logout' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

