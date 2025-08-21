import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui';
import { ROUTES } from '../utils/constants';
import { isValidEmail, isValidPassword, isValidUsername } from '../utils/helpers';

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const { register, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!email) {
      setEmailError('Email is required');
      valid = false;
    } else if (!isValidEmail(email)) {
      setEmailError('Invalid email format');
      valid = false;
    } else {
      setEmailError('');
    }

    if (!username) {
      setUsernameError('Username is required');
      valid = false;
    } else if (!isValidUsername(username)) {
      setUsernameError('Username must be 3-20 alphanumeric characters or underscores');
      valid = false;
    } else {
      setUsernameError('');
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else if (!isValidPassword(password)) {
      setPasswordError('Password must be at least 8 characters, with 1 uppercase, 1 lowercase, and 1 number');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Confirm password is required');
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      valid = false;
    } else {
      setConfirmPasswordError('');
    }

    if (valid) {
      try {
        await register({ email, username, password });
      } catch (error) {
        // Error handled by AuthContext and useToast
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full space-y-8 p-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold text-gray-900">Create your account</CardTitle>
          <CardDescription className="mt-2 text-sm text-gray-600">
            Or <Link to={ROUTES.LOGIN} className="font-medium text-blue-600 hover:text-blue-500">sign in to your existing account</Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              label="Username"
              placeholder="your_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={usernameError}
            />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              label="Password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
            />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              label="Confirm Password"
              placeholder="********"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPasswordError}
            />

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Sign Up
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;

