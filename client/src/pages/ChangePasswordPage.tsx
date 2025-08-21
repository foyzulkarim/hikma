import React, { useState } from 'react';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui';
import { isValidPassword } from '../utils/helpers';
import { authService } from '../services/authService';
import { useToast } from '../hooks/useToast';

const ChangePasswordPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmNewPasswordError, setConfirmNewPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!currentPassword) {
      setCurrentPasswordError('Current password is required');
      valid = false;
    } else {
      setCurrentPasswordError('');
    }

    if (!newPassword) {
      setNewPasswordError('New password is required');
      valid = false;
    } else if (!isValidPassword(newPassword)) {
      setNewPasswordError('Password must be at least 8 characters, with 1 uppercase, 1 lowercase, and 1 number');
      valid = false;
    } else {
      setNewPasswordError('');
    }

    if (!confirmNewPassword) {
      setConfirmNewPasswordError('Confirm new password is required');
      valid = false;
    } else if (newPassword !== confirmNewPassword) {
      setConfirmNewPasswordError('New passwords do not match');
      valid = false;
    } else {
      setConfirmNewPasswordError('');
    }

    if (valid) {
      setIsLoading(true);
      try {
        await authService.changePassword({ currentPassword, newPassword });
        showToast({ type: 'success', title: 'Password Changed', message: 'Your password has been updated successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } catch (error: any) {
        showToast({ type: 'error', title: 'Password Change Failed', message: error.message || 'An error occurred.' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Change Password</h1>
      <Card>
        <CardHeader>
          <CardTitle>Update Your Password</CardTitle>
          <CardDescription>Ensure your account is secure by regularly updating your password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              label="Current Password"
              placeholder="********"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              error={currentPasswordError}
            />
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              label="New Password"
              placeholder="********"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={newPasswordError}
            />
            <Input
              id="confirmNewPassword"
              name="confirmNewPassword"
              type="password"
              label="Confirm New Password"
              placeholder="********"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              error={confirmNewPasswordError}
            />
            <Button type="submit" isLoading={isLoading} disabled={isLoading}>
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;

