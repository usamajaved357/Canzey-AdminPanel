import React, { useState, useEffect } from 'react';
import Header from '../header/Header';
import Sidebar from '../sidebar/Sidebar';
import { useUser } from '../../context/UserContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 1024);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="layout">
      {/* Mobile menu overlay */}
      <div 
        className={`layout-mobile-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className={`layout-main-content ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
        {/* Header */}
        <Header 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen}
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm}
          user={user}
          onLogout={logout}
        />

        {/* Page Content */}
        <main className="layout-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
