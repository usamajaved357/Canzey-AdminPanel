import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, MapPin, Package, RefreshCw, Send, CheckCircle, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../../config/api';

const ShippingSection = ({ order, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [showShipForm, setShowShipForm] = useState(false);
  
  const [formData, setFormData] = useState({
    city_id: '',
    region_id: '',
    package_size: 'Package Size - Average Small Size 0.5kg ~ 1kg (2000 IQD)',
    replacement: '0',
    type_name: 'Regular', // or Urgent
    items_number: '1',
    location: '',
    notes: ''
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (order?.shipping_track_id) {
      fetchTrackingInfo();
    }
    fetchCities();
  }, [order]);

  // Smart Matching: Try to match order city with Al-Waseet city list
  useEffect(() => {
    if (cities.length > 0 && order?.shipping_address?.city && !formData.city_id) {
      const orderCity = order.shipping_address.city.toLowerCase().trim();
      const matchedCity = cities.find(c => 
        (c.city_name || c.name || '').toLowerCase().trim().includes(orderCity) || 
        orderCity.includes((c.city_name || c.name || '').toLowerCase().trim())
      );
      
      if (matchedCity) {
        console.log(`✅ Auto-matched city: ${matchedCity.city_name || matchedCity.name}`);
        setFormData(prev => ({ ...prev, city_id: matchedCity.id }));
        fetchRegions(matchedCity.id);
      }
    }
  }, [cities, order]);

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

  const fetchTrackingInfo = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/admin/shipping/status/${order.shipping_track_id}`, { headers });
      if (res.data.success) setTrackingInfo(res.data.data);
    } catch (err) {
      console.error('Error fetching tracking:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCityChange = (e) => {
    const cityId = e.target.value;
    setFormData({ ...formData, city_id: cityId, region_id: '' });
    if (cityId) fetchRegions(cityId);
    else setRegions([]);
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    if (!formData.city_id || !formData.region_id) {
      alert('Please select City and Region');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        orderId: order.id,
        shippingData: {
          ...formData,
          client_name: `${order.shipping_address?.name || order.first_name + ' ' + order.last_name}`,
          client_mobile: order.shipping_address?.phone || '0000000000',
          price: order.total_amount,
          location: formData.location || order.shipping_address?.address || '',
          notes: formData.notes || order.notes || ''
        }
      };

      const res = await axios.post(`${API_BASE_URL}/api/admin/shipping/create`, payload, { headers });
      if (res.data.success) {
        alert('Shipment created successfully!');
        setShowShipForm(false);
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      alert('Failed to create shipment: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (trackingInfo) {
    return (
      <div className="shipping-info-box">
        <div className="shipping-info-header">
          <div className="company-logo">
            <Truck size={20} />
            <span>Al-Waseet Shipping</span>
          </div>
          <button className="refresh-btn" onClick={fetchTrackingInfo} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Update Status
          </button>
        </div>
        
        <div className="tracking-main">
          <div className="track-id">
            <span className="label">Tracking ID</span>
            <span className="value">#{order.shipping_track_id}</span>
          </div>
          <div className="track-status">
            <span className="label">Current Status</span>
            <span className={`status-text ${trackingInfo.status_name?.toLowerCase().includes('deliver') ? 'delivered' : 'pending'}`}>
              {trackingInfo.status_name}
            </span>
          </div>
        </div>

        {trackingInfo.price && (
          <div className="track-details-row">
            <span>Price: {trackingInfo.price} IQD</span>
            <span>Items: {trackingInfo.items_number}</span>
          </div>
        )}

        <div className="track-footer">
           <div className="footer-links" style={{ display: 'flex', gap: '20px', marginTop: '16px' }}>
             <a 
               href={`https://al-waseet.com/track?id=${order.shipping_track_id}`} 
               target="_blank" rel="noreferrer"
               className="track-link"
               style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6366f1', textDecoration: 'none', fontWeight: '800' }}
             >
               <ExternalLink size={14} />
               Track Package
             </a>
             
             {order.shipping_label_url && (
               <a 
                 href={`${API_BASE_URL}${order.shipping_label_url}`} 
                 target="_blank" rel="noreferrer"
                 className="print-link"
                 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', textDecoration: 'none', fontWeight: '800' }}
               >
                 <RefreshCw size={14} />
                 Print Label (Saved)
               </a>
             )}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shipping-section-container">
      {!showShipForm ? (
        <div className="no-shipment">
          <Truck size={32} />
          <p>This order has not been shipped yet.</p>
          <button className="primary-btn" onClick={() => setShowShipForm(true)}>
            <Send size={16} /> Process Shipment with Al-Waseet
          </button>
        </div>
      ) : (
        <form className="ship-form" onSubmit={handleCreateShipment}>
          <div className="form-header">
            <h4>Create Al-Waseet Shipment</h4>
            <button type="button" className="close-form" onClick={() => setShowShipForm(false)}>×</button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>City</label>
              <select value={formData.city_id} onChange={handleCityChange} required>
                <option value="">Select City</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.city_name || c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Region</label>
              <select 
                value={formData.region_id} 
                onChange={(e) => setFormData({...formData, region_id: e.target.value})} 
                required
                disabled={!formData.city_id}
              >
                <option value="">Select Region</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.region_name || r.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Type</label>
              <select value={formData.type_name} onChange={(e) => setFormData({...formData, type_name: e.target.value})}>
                <option value="Regular">Regular</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label>No. of Items</label>
              <input 
                type="number" 
                value={formData.items_number} 
                onChange={(e) => setFormData({...formData, items_number: e.target.value})}
                min="1"
              />
            </div>
          </div>

          <div className="form-group full-width">
            <label>Package Size</label>
            <select value={formData.package_size} onChange={(e) => setFormData({...formData, package_size: e.target.value})}>
              <option value="Package Size - Average Small Size 0.5kg ~ 1kg (2000 IQD)">Small (2,000 IQD)</option>
              <option value="Package Size - Average Medium Size 1kg ~ 5kg (4000 IQD)">Medium (4,000 IQD)</option>
              <option value="Package Size - Average Big Size 5kg ~ 15kg (6000 IQD)">Big (6,000 IQD)</option>
            </select>
          </div>

          <div className="form-group full-width">
            <label>Specific Location (Optional)</label>
            <input 
              type="text" 
              placeholder="Detailed address..." 
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-btn" onClick={() => setShowShipForm(false)}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Processing...' : 'Create Shipment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ShippingSection;
