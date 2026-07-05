import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/layout/Layout';
import { API_BASE_URL } from '../../config/api';
import './Settings.css';

const Settings = () => {
  const [testingZmc, setTestingZmc] = useState(false);
  const [zmcStatus, setZmcStatus] = useState(null);

  // For the test booking form
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [formData, setFormData] = useState({
    client_name: 'Farhan Test',
    client_mobile: '07701234567',
    city_id: '',
    region_id: '',
    location: 'Mansour, 14th Ramadan Street, Near Mansour Mall',
    price: '1000',
    total_weight: '1'
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/shipping/cities`, { headers });
      if (res.data.success) setCities(res.data.data);
    } catch (err) {
      console.error('Error fetching cities:', err);
    }
  };

  const fetchRegions = async (cityId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/shipping/regions/${cityId}`, { headers });
      if (res.data.success) setRegions(res.data.data);
    } catch (err) {
      console.error('Error fetching regions:', err);
    }
  };

  const handleCityChange = (e) => {
    const cityId = e.target.value;
    setFormData({ ...formData, city_id: cityId, region_id: '' });
    if (cityId) fetchRegions(cityId);
    else setRegions([]);
  };

  const testZmcConnection = async () => {
    try {
      setTestingZmc(true);
      setZmcStatus(null);
      const res = await axios.get(`${API_BASE_URL}/api/admin/shipping/test-connection`, { headers });
      if (res.data.success) {
        setZmcStatus({ success: true, message: res.data.message });
      } else {
        setZmcStatus({ success: false, message: res.data.message });
      }
    } catch (err) {
      setZmcStatus({ success: false, message: err.response?.data?.message || err.message });
    } finally {
      setTestingZmc(false);
    }
  };

  const handleTestBook = async (e) => {
    e.preventDefault();
    if (!formData.city_id || !formData.region_id) {
      alert('Please select City and Region');
      return;
    }
    
    try {
      setIsBooking(true);
      setBookingStatus(null);
      
      const payload = {
        shippingData: {
          ...formData,
          content_type: 'XPS',
          service_type: 'NCND',
          items_number: '1'
        }
      };

      const res = await axios.post(`${API_BASE_URL}/api/admin/shipping/test-book`, payload, { headers });
      if (res.data.success) {
        setBookingStatus({ success: true, message: res.data.message, trackId: res.data.trackId });
      } else {
        setBookingStatus({ success: false, message: res.data.message });
      }
    } catch (err) {
      setBookingStatus({ success: false, message: err.response?.data?.message || err.message });
    } finally {
      setIsBooking(false);
    }
  };

  const handleDownloadLabel = async () => {
    if (!bookingStatus?.trackId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/shipping/label/${bookingStatus.trackId}`, { 
        headers,
        responseType: 'blob' 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ZMC-Label-${bookingStatus.trackId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download label. It might not be available yet.');
    }
  };

  return (
    <Layout>
      <div className="settings-page">
        <div className="settings-container">
          <div className="settings-header">
            <h1 className="settings-title">Testing & Settings</h1>
            <p className="settings-subtitle">Manage application configuration and integrations.</p>
          </div>
          
          <div className="settings-grid">
            <div className="settings-card">
              <div className="settings-card-header">
                <h2>Shipping Integration</h2>
                <span className="badge active">ZMC Cargo</span>
              </div>
              <p className="settings-card-text">Test your connection to the ZMC Cargo API endpoint.</p>
              
              <button 
                className="zmc-test-btn"
                onClick={testZmcConnection}
                disabled={testingZmc}
              >
                {testingZmc ? 'Testing...' : 'Test ZMC Connection'}
              </button>
              
              {zmcStatus && (
                <div className={`zmc-status-message ${zmcStatus.success ? 'success' : 'error'}`}>
                  {zmcStatus.message}
                </div>
              )}
            </div>

            <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
              <div className="settings-card-header">
                <h2>Test Shipment Booking</h2>
              </div>
              <p className="settings-card-text">Book a dummy shipment to the ZMC sandbox to verify it works end-to-end.</p>
              
              <form className="settings-form" onSubmit={handleTestBook}>
                <div className="form-group-row">
                  <div className="form-group">
                    <label>City</label>
                    <select value={formData.city_id} onChange={handleCityChange} required>
                      <option value="">Select City</option>
                      {cities.map(c => <option key={c.id} value={c.id}>{c.city_name || c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Region</label>
                    <select value={formData.region_id} onChange={(e) => setFormData({...formData, region_id: e.target.value})} required disabled={!formData.city_id}>
                      <option value="">Select Region</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.region_name || r.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Specific Address / Location</label>
                  <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required />
                </div>
                
                <div className="form-group-row">
                  <div className="form-group">
                    <label>Client Name</label>
                    <input type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Client Phone</label>
                    <input type="text" value={formData.client_mobile} onChange={e => setFormData({...formData, client_mobile: e.target.value})} required />
                  </div>
                </div>
                
                <button type="submit" className="action-btn" disabled={isBooking}>
                  {isBooking ? 'Booking...' : 'Create Test Shipment'}
                </button>
              </form>

              {bookingStatus && (
                <div className={`booking-status-message ${bookingStatus.success ? 'success' : 'error'}`}>
                  {bookingStatus.message}
                  {bookingStatus.trackId && (
                    <div style={{ marginTop: '15px' }}>
                      <p><strong>Tracking ID:</strong> {bookingStatus.trackId}</p>
                      <button 
                        type="button" 
                        className="action-btn" 
                        style={{ marginTop: '10px', backgroundColor: '#28a745' }}
                        onClick={handleDownloadLabel}
                      >
                        Download Waybill Label
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
