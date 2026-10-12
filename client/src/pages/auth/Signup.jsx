import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, AlertCircle, Shield, Phone } from 'lucide-react';
import { API_ENDPOINTS } from '../../config/api';
import './Auth.css';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPendingApproval, setShowPendingApproval] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          role: formData.role
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresApproval) {
          // Show pending approval page
          setShowPendingApproval(true);
        } else {
          // Store token and user data (if approved immediately)
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          navigate('/dashboard');
        }
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Show pending approval page if registration is pending
  if (showPendingApproval) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-icon" style={{ background: '#f59e0b' }}>
                <AlertCircle size={32} />
              </div>
              <h1>Account Pending Approval</h1>
            </div>
            <p className="auth-subtitle">Your registration has been submitted</p>
          </div>

          <div className="pending-approval-content">
            <div className="pending-message">
              <h3>🎉 Registration Successful!</h3>
              <p>
                Thank you for registering with Canzey Admin Dashboard. 
                Your account has been created and is currently pending approval by an administrator.
              </p>
              
              <div className="pending-info">
                <h4>What happens next?</h4>
                <ul>
                  <li>✅ Your account has been created</li>
                  <li>⏳ An administrator will review your registration</li>
                  <li>📧 You'll receive an email once approved</li>
                  <li>🚀 Then you can sign in and access the dashboard</li>
                </ul>
              </div>

              <div className="pending-actions">
                <button 
                  onClick={() => navigate('/signin')} 
                  className="auth-btn"
                  style={{ marginTop: '1rem' }}
                >
                  Go to Sign In
                </button>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Already approved? <Link to="/signin" className="auth-link">Sign in here</Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Background Design */}
        <div className="auth-bg">
          <div className="bg-circle bg-circle-1"></div>
          <div className="bg-circle bg-circle-2"></div>
          <div className="bg-circle bg-circle-3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo/Header */}
        <div className="auth-header">
          <div className="auth-logo">
            <p className="auth-wordmark">Canzey</p>
            <h1>Create Account</h1>
          </div>
          <p className="auth-subtitle">Join Canzey Admin Dashboard</p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* First Name Input */}
          <div className="form-group">
            <label htmlFor="firstName">First Name *</label>
            <div className="input-wrapper">
              <User className="input-icon" size={20} />
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                required
              />
            </div>
          </div>

          {/* Last Name Input */}
          <div className="form-group">
            <label htmlFor="lastName">Last Name *</label>
            <div className="input-wrapper">
              <User className="input-icon" size={20} />
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                required
              />
            </div>
          </div>

          {/* Email Input */}
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={20} />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {/* Phone Input */}
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <div className="input-wrapper">
              <Phone className="input-icon" size={20} />
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          {/* Role Input */}
          <div className="form-group">
            <label htmlFor="role">Role *</label>
            <div className="input-wrapper">
              <Shield className="input-icon" size={20} />
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="">Select your role</option>
                <option value="user">User</option>
                <option value="staff">Staff Member</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={20} />
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password (min 6 characters)"
                required
                minLength="6"
              />
            </div>
          </div>

          {/* Confirm Password Input */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={20} />
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                minLength="6"
              />
            </div>
          </div>

          {/* Terms & Conditions */}
          <label className="checkbox-label">
            <input type="checkbox" required />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="auth-link">
                Terms & Conditions
              </Link>
            </span>
          </label>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="auth-btn"
            disabled={loading}
          >
            {loading ? (
              <span>Creating account...</span>
            ) : (
              <>
                <UserPlus size={20} />
                <span>Sign Up</span>
              </>
            )}
          </button>

          {/* Login Link */}
          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>

      {/* Background Design */}
      <div className="auth-bg">
        <div className="bg-circle bg-circle-1"></div>
        <div className="bg-circle bg-circle-2"></div>
        <div className="bg-circle bg-circle-3"></div>
      </div>
    </div>
  );
};

export default Signup;
