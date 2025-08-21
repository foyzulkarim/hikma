import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui';
import { ROUTES } from '../utils/constants';
import { isValidPassword } from '../utils/helpers';
import { authService } from '../services/authService';
import { useToast } from '../hooks/useToast';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    if (!token) {
      showToast({ type: 'error', title: 'Invalid Link', message: 'Password reset token is missing.' });
    }
  }, [token, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!newPassword) {
      setNewPasswordError('New password is required');
      valid = false;
    } else if (!isValidPassword(newPassword)) {
      setNewPasswordError('Password must be at least 8 characters, with 1 uppercase, 1 lowercase, and 1 number');
      valid = false;
    } else {
      setNewPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Confirm password is required');
      valid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      valid = false;
    } else {
      setConfirmPasswordError('');
    }

    if (valid && token) {
      setIsLoading(true);
      setMessage('');
      try {
        await authService.resetPassword(token, newPassword);
        setMessage('Your password has been reset successfully. You can now log in.');
        showToast({ type: 'success', title: 'Password Reset Successful', message: 'You can now log in.' });
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
          <CardTitle className="text-3xl font-extrabold text-gray-900">Reset Your Password</CardTitle>
          <CardDescription className="mt-2 text-sm text-gray-600">
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              label="New Password"
              placeholder="********"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={newPasswordError}
            />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              label="Confirm New Password"
              placeholder="********"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPasswordError}
            />

            {message && (
              <p className="text-sm text-green-600 text-center">{message}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading || !token}
            >
              Reset Password
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

export default ResetPasswordPage;

