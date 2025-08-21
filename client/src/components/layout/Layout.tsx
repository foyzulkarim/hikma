import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { User } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  user?: User | null;
  onLogout?: () => void;
  showFooter?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  onLogout, 
  showFooter = true 
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header user={user} onLogout={onLogout} />
      
      <main className="flex-1">
        {children}
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
};

export { Layout };

