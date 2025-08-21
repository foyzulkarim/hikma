import React from 'react';
import { Layout } from '../components/layout';
import { useAuth } from '../context/AuthContext';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-8 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-lg text-gray-600">
            Welcome, {user?.firstName || user?.username || 'Guest'}!
          </p>
          <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Quick Overview
              </h3>
              <div className="mt-4 max-w-xl text-sm text-gray-500">
                <p>This is your personalized dashboard. Here you can see a summary of your projects, recent queries, and system health.</p>
                <p className="mt-2">More features will be added here soon!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;

