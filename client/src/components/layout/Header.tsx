import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui';
import { ROUTES } from '../../utils/constants';
import { User } from '../../types';

interface HeaderProps {
  user?: User | null;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navigation = [
    { name: 'Dashboard', href: ROUTES.DASHBOARD },
    { name: 'Projects', href: ROUTES.PROJECTS },
    { name: 'Query', href: ROUTES.QUERY },
    { name: 'History', href: ROUTES.HISTORY },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to={user ? ROUTES.DASHBOARD : ROUTES.HOME} className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-blue-600">Hikma</h1>
              </div>
              <div className="hidden md:block ml-2">
                <span className="text-sm text-gray-500">Code Intelligence Platform</span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          {user && (
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          )}

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="hidden md:block">
                  <span className="text-sm text-gray-700">
                    Welcome, {user.firstName || user.username}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Link to={ROUTES.SETTINGS}>
                    <Button variant="ghost" size="sm">
                      Settings
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={onLogout}>
                    Logout
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to={ROUTES.LOGIN}>
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to={ROUTES.REGISTER}>
                  <Button variant="primary" size="sm">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {user && (
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export { Header };

