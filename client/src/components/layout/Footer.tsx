import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center">
              <h2 className="text-xl font-bold text-blue-600">Hikma</h2>
              <span className="ml-2 text-sm text-gray-500">Code Intelligence Platform</span>
            </div>
            <p className="mt-2 text-sm text-gray-600 max-w-md">
              Empowering developers with AI-driven code intelligence. 
              Ask questions about your codebase and get intelligent insights.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link to="/dashboard" className="text-sm text-gray-600 hover:text-blue-600">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/projects" className="text-sm text-gray-600 hover:text-blue-600">
                  Projects
                </Link>
              </li>
              <li>
                <Link to="/query" className="text-sm text-gray-600 hover:text-blue-600">
                  Query Interface
                </Link>
              </li>
              <li>
                <Link to="/history" className="text-sm text-gray-600 hover:text-blue-600">
                  Query History
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
              Support
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-blue-600">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-blue-600">
                  API Reference
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-blue-600">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-blue-600">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-6">
              <p className="text-sm text-gray-500">
                © {currentYear} Hikma. All rights reserved.
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-6">
              <a href="#" className="text-sm text-gray-500 hover:text-blue-600">
                Privacy Policy
              </a>
              <a href="#" className="text-sm text-gray-500 hover:text-blue-600">
                Terms of Service
              </a>
              <a href="#" className="text-sm text-gray-500 hover:text-blue-600">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export { Footer };

