import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Users, Shield, Menu, X, Bell, Search } from 'lucide-react';
import './Header.css';

const Header = ({ sidebarOpen, setSidebarOpen, searchTerm, setSearchTerm, user, onLogout }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get user initials for avatar placeholder
  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  const handleLogout = () => {
    onLogout();
  };

  return (
    <>
      <header className={`admin-header ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
        <div className="header-container">
          {/* Left side - Sidebar Toggle and Logo */}
          <div className="header-left">
            <button 
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle Sidebar"
            >
              <Menu size={24} />
            </button>
            <div className="header-logo-mobile">
              <h1>Canzey</h1>
            </div>
          </div>

          {/* Center - Search Bar */}
          <div className="header-center">
            <div className="header-search">
              <Search className="header-search-icon" size={20} />
              <input
                type="text"
                placeholder="Search products, orders, users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Right side - User info and actions */}
          <div className="header-right">
            <div className="header-actions">
              {/* Notifications */}
              <button className="header-notification-btn">
                <Bell size={20} />
                <span className="header-notification-indicator"></span>
              </button>
            </div>

            <div className="user-section">
              <div className="user-info clickable" onClick={handleProfileClick}>
                <div className="user-avatar">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="User Avatar" />
                  ) : (
                    <div className="avatar-placeholder">
                      {getUserInitials(user?.name)}
                    </div>
                  )}
                </div>
                <div className="user-details">
                  <span className="user-name">{user?.name || 'User'}</span>
                  <span className="user-role">{user?.role || 'Staff'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="mobile-menu">
            <button className="mobile-menu-item" onClick={handleProfileClick}>
              <User size={20} />
              <span>Profile</span>
            </button>
            
            {user?.role === 'admin' && (
              <>
                <button className="mobile-menu-item">
                  <Users size={20} />
                  <span>User Management</span>
                </button>
                <button className="mobile-menu-item">
                  <Shield size={20} />
                  <span>System Settings</span>
                </button>
              </>
            )}
            
            <button className="mobile-menu-item logout" onClick={handleLogout}>
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </header>
    </>
  );
};

export default Header;
