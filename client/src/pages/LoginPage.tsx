import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui';
import { ROUTES } from '../utils/constants';
import { isValidEmail } from '../utils/helpers';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { login, isLoading } = useAuth();

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

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (valid) {
      try {
        await login({ email, password });
      } catch (error) {
        // Error handled by AuthContext and useToast
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full space-y-8 p-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold text-gray-900">Sign in to your account</CardTitle>
          <CardDescription className="mt-2 text-sm text-gray-600">
            Or <Link to={ROUTES.REGISTER} className="font-medium text-blue-600 hover:text-blue-500">create a new account</Link>
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
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              label="Password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
            />

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link to={ROUTES.FORGOT_PASSWORD} className="font-medium text-blue-600 hover:text-blue-500">
                  Forgot your password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;

