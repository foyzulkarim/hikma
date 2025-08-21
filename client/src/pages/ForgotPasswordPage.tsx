import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui';
import { ROUTES } from '../utils/constants';
import { isValidEmail } from '../utils/helpers';
import { authService } from '../services/authService';
import { useToast } from '../hooks/useToast';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { showToast } = useToast();

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

    if (valid) {
      setIsLoading(true);
      setMessage('');
      try {
        // Assuming authService has a forgotPassword method
        await authService.forgotPassword(email);
        setMessage('If an account with that email exists, a password reset link has been sent.');
        showToast({ type: 'success', title: 'Password Reset Email Sent', message: 'Check your inbox.' });
      } catch (error: any) {
        showToast({ type: 'error', title: 'Password Reset Failed', message: error.message || 'An error occurred.' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full space-y-8 p-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold text-gray-900">Forgot Password?</CardTitle>
          <CardDescription className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
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

            {message && (
              <p className="text-sm text-green-600 text-center">{message}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Send Reset Link
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <Link to={ROUTES.LOGIN} className="font-medium text-blue-600 hover:text-blue-500">
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;

