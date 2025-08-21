import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui';
import { useToast } from '../hooks/useToast';
import { authService } from '../services/authService';
import { isValidEmail, isValidUsername } from '../utils/helpers';

const ProfilePage: React.FC = () => {
  const { user, checkAuth, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [isLoading, setIsLoading] = useState(false);

  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!username) {
      setUsernameError('Username is required');
      valid = false;
    } else if (!isValidUsername(username)) {
      setUsernameError('Username must be 3-20 alphanumeric characters or underscores');
      valid = false;
    } else {
      setUsernameError('');
    }

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
      try {
        await authService.updateProfile({
          username,
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        });
        await checkAuth(); // Refresh user data in context
        showToast({ type: 'success', title: 'Profile Updated', message: 'Your profile has been successfully updated.' });
      } catch (error: any) {
        showToast({ type: 'error', title: 'Profile Update Failed', message: error.message || 'An error occurred.' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">User Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Update Your Information</CardTitle>
          <CardDescription>Manage your personal details and account settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <Input
              id="username"
              name="username"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={usernameError}
              disabled={authLoading}
            />
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              disabled={authLoading}
            />
            <Input
              id="firstName"
              name="firstName"
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={authLoading}
            />
            <Input
              id="lastName"
              name="lastName"
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={authLoading}
            />
            <Button type="submit" isLoading={isLoading} disabled={isLoading || authLoading}>
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;

