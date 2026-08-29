import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Truck, RefreshCw, Send, Download, FlaskConical, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../../config/api';
import '../../../components/ui/ToggleSwitch.css';

const TEST_MODE_KEY = 'zmcOrderTestMode';

const isTestShipment = (order) =>
  Boolean(order?.shipping_company?.includes('(Test)'));

const ShippingSection = ({ order, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [showShipForm, setShowShipForm] = useState(false);
  const [testMode, setTestMode] = useState(() => {
    try {
      return localStorage.getItem(TEST_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [formData, setFormData] = useState({
    city_id: '',
    region_id: '',
    total_weight: '1',
    content_type: 'XPS',
    service_type: 'NCND',
    items_number: '1',
    location: '',
    notes: ''
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const hasShipment = Boolean(order?.shipping_track_id);
  const showTestBadge = testMode || isTestShipment(order);
  const labelEnv = showTestBadge ? 'sandbox' : 'prod';

  useEffect(() => {
    if (order?.shipping_track_id) {
      fetchTrackingInfo();
    } else {
      setTrackingInfo(null);
    }
    fetchCities();
  }, [order?.id, order?.shipping_track_id]);

  useEffect(() => {
    try {
      localStorage.setItem(TEST_MODE_KEY, testMode ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [testMode]);

  useEffect(() => {
    if (cities.length > 0 && order?.shipping_address?.city && !formData.city_id) {
      const orderCity = order.shipping_address.city.toLowerCase().trim();
      const matchedCity = cities.find(c =>
        (c.city_name || c.name || '').toLowerCase().trim().includes(orderCity) ||
        orderCity.includes((c.city_name || c.name || '').toLowerCase().trim())
      );

      if (matchedCity) {
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
    if (!order?.shipping_track_id) return;
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/admin/shipping/status/${order.shipping_track_id}?env=${labelEnv}`,
        { headers }
      );
      if (res.data.success) setTrackingInfo(res.data.data);
    } catch (err) {
      console.error('Error fetching tracking:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadLabel = async (trackId, env = labelEnv) => {
    const response = await axios.get(
      `${API_BASE_URL}/api/admin/shipping/label/${trackId}?env=${env}&orderId=${order.id}`,
      { headers, responseType: 'blob' }
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ZMC-Label-${trackId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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
        isTest: testMode,
        shippingData: {
          ...formData,
          env: testMode ? 'sandbox' : 'prod',
          client_name: `${order.shipping_address?.name || order.first_name + ' ' + order.last_name}`,
          client_mobile: order.shipping_address?.phone || '0000000000',
          price: order.total_amount,
          location: formData.location || order.shipping_address?.address || '',
          notes: formData.notes || order.notes || ''
        }
      };

      const res = await axios.post(`${API_BASE_URL}/api/admin/shipping/create`, payload, { headers });
      if (res.data.success) {
        if (res.data.labelAvailable && res.data.trackId) {
          try {
            await downloadLabel(res.data.trackId, res.data.env || labelEnv);
          } catch (downloadErr) {
            console.error('Auto label download failed:', downloadErr);
          }
        }
        alert(res.data.message || 'Shipment created successfully!');
        setShowShipForm(false);
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      alert('Failed to create shipment: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleManualLabelDownload = async () => {
    if (!order?.shipping_track_id) return;
    try {
      setLoading(true);
      await downloadLabel(order.shipping_track_id, labelEnv);
      alert('Label downloaded — order marked as shipped.');
      if (onUpdate) onUpdate();
    } catch (err) {
      alert('Failed to download label. It might not be available yet.');
    } finally {
      setLoading(false);
    }
  };

  const renderTestModeRow = () => (
    <div className="shipping-test-row">
      <div className="shipping-test-toggle">
        <label className="toggle-switch" title="Use ZMC sandbox for this order">
          <input
            type="checkbox"
            checked={testMode}
            onChange={(e) => setTestMode(e.target.checked)}
            disabled={hasShipment}
          />
          <span className="slider" />
        </label>
        <div>
          <span className="shipping-test-label">Test Mode (Sandbox)</span>
          <Link to="/settings" className="shipping-test-link">
            Open full testing page <ExternalLink size={12} />
          </Link>
        </div>
      </div>
      {showTestBadge && (
        <span className="testing-shipment-tag">
          <FlaskConical size={12} />
          Testing Shipment
        </span>
      )}
    </div>
  );

  if (hasShipment) {
    return (
      <div className="shipping-section-container">
        {renderTestModeRow()}
        <div className="shipping-info-box">
          <div className="shipping-info-header">
            <div className="company-logo">
              <Truck size={20} />
              <span>{order.shipping_company || 'ZMC Cargo'}</span>
            </div>
            <button className="refresh-btn" onClick={fetchTrackingInfo} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Update Status
            </button>
          </div>

          <div className="tracking-main">
            <div className="track-id">
              <span className="label">ZMC Tracking Ref</span>
              <span className="value">#{order.shipping_track_id}</span>
            </div>
            <div className="track-status">
              <span className="label">Current Status</span>
              <span className={`status-text ${trackingInfo?.status_name?.toLowerCase().includes('deliver') ? 'delivered' : 'pending'}`}>
                {trackingInfo?.status_name || order.shipping_status || 'Pending'}
              </span>
            </div>
          </div>

          <div className="track-footer">
            <button type="button" className="label-download-btn" onClick={handleManualLabelDownload} disabled={loading}>
              <Download size={14} />
              {loading ? 'Downloading...' : 'Download / Print Label'}
            </button>
            <span className="label-hint">Printing the label marks this order as shipped.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shipping-section-container">
      {renderTestModeRow()}

      {!showShipForm ? (
        <div className="no-shipment">
          <Truck size={32} />
          <p>This order has not been shipped yet.</p>
          <button className="primary-btn" onClick={() => setShowShipForm(true)}>
            <Send size={16} /> Process Shipment with ZMC Cargo
          </button>
        </div>
      ) : (
        <form className="ship-form" onSubmit={handleCreateShipment}>
          <div className="form-header">
            <h4>Create ZMC Cargo Shipment</h4>
            <button type="button" className="close-form" onClick={() => setShowShipForm(false)}>×</button>
          </div>

          {testMode && (
            <div className="ship-form-test-notice">
              Sandbox booking — reference will be prefixed with <strong>TEST-ORDER</strong>. No live courier pickup.
            </div>
          )}

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
                onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                required
                disabled={!formData.city_id}
              >
                <option value="">Select Region</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.region_name || r.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Total Weight (kg)</label>
              <input
                type="number"
                value={formData.total_weight}
                onChange={(e) => setFormData({ ...formData, total_weight: e.target.value })}
                min="0.1"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label>No. of Items</label>
              <input
                type="number"
                value={formData.items_number}
                onChange={(e) => setFormData({ ...formData, items_number: e.target.value })}
                min="1"
              />
            </div>
          </div>

          <div className="form-group full-width">
            <label>Specific Location (Optional)</label>
            <input
              type="text"
              placeholder="Detailed address..."
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-btn" onClick={() => setShowShipForm(false)}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Processing...' : testMode ? 'Create Test Shipment' : 'Create Shipment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ShippingSection;
