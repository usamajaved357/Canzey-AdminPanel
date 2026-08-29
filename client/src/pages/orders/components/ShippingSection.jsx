import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Truck, RefreshCw, Send, Download, FlaskConical, ExternalLink, MapPin, Package } from 'lucide-react';
import { API_BASE_URL } from '../../../config/api';
import '../../../components/ui/ToggleSwitch.css';

const TEST_MODE_KEY = 'zmcOrderTestMode';

const isTestShipment = (order) =>
  Boolean(order?.shipping_company?.includes('(Test)'));

const getTotalItemCount = (order) =>
  (order?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 1;

const buildLocationLine = (addr) => {
  if (!addr) return '';
  const parts = [addr.address, addr.city, addr.postal_code, addr.country].filter(Boolean);
  return parts.join(', ');
};

const ShippingSection = ({ order, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [showShipForm, setShowShipForm] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
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
  const itemCount = getTotalItemCount(order);

  const fetchCities = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/shipping/cities`, { headers });
      if (res.data.success) setCities(res.data.data || []);
    } catch (err) {
      console.error('Error fetching cities:', err);
    }
  }, [token]);

  const fetchRegionsForCity = useCallback(async (cityId) => {
    if (!cityId) return [];
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/shipping/regions/${cityId}`, { headers });
      if (res.data.success) return res.data.data || [];
    } catch (err) {
      console.error('Error fetching regions:', err);
    }
    return [];
  }, [token]);

  const applyOrderPrefill = useCallback(async (cityList) => {
    const addr = order?.shipping_address;
    const count = getTotalItemCount(order);
    const base = {
      total_weight: String(Math.max(1, count)),
      items_number: String(count),
      location: buildLocationLine(addr) || addr?.address || '',
      notes: order?.customer_notes || order?.notes || '',
      content_type: 'XPS',
      service_type: 'NCND',
    };

    if (!addr?.city || !cityList.length) {
      setFormData(prev => ({ ...prev, ...base }));
      setPrefilled(true);
      return;
    }

    const orderCity = addr.city.toLowerCase().trim();
    const matchedCity = cityList.find(c => {
      const zmcCity = (c.city_name || c.name || '').toLowerCase().trim();
      return zmcCity === orderCity || zmcCity.includes(orderCity) || orderCity.includes(zmcCity);
    });

    if (!matchedCity) {
      setFormData(prev => ({ ...prev, ...base }));
      setPrefilled(true);
      return;
    }

    const cityId = String(matchedCity.id);
    const regionList = await fetchRegionsForCity(matchedCity.id);
    setRegions(regionList);

    setFormData({
      ...base,
      city_id: cityId,
      region_id: regionList.length ? String(regionList[0].id) : '',
    });
    setPrefilled(true);
  }, [order, fetchRegionsForCity]);

  useEffect(() => {
    if (order?.shipping_track_id) {
      fetchTrackingInfo();
    } else {
      setTrackingInfo(null);
    }
    fetchCities();
    setPrefilled(false);
  }, [order?.id, order?.shipping_track_id]);

  useEffect(() => {
    try {
      localStorage.setItem(TEST_MODE_KEY, testMode ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [testMode]);

  useEffect(() => {
    if (showShipForm && cities.length > 0 && !prefilled) {
      applyOrderPrefill(cities);
    }
  }, [showShipForm, cities, prefilled, applyOrderPrefill]);

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

  const handleOpenShipForm = () => {
    setPrefilled(false);
    setShowShipForm(true);
  };

  const handleCityChange = async (e) => {
    const cityId = e.target.value;
    setFormData(prev => ({ ...prev, city_id: cityId, region_id: '' }));
    if (cityId) {
      const regionList = await fetchRegionsForCity(cityId);
      setRegions(regionList);
      if (regionList.length > 0) {
        setFormData(prev => ({ ...prev, city_id: cityId, region_id: String(regionList[0].id) }));
      }
    } else {
      setRegions([]);
    }
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
          client_name: order.shipping_address?.name || `${order.first_name} ${order.last_name}`.trim(),
          client_mobile: order.shipping_address?.phone || order.phone_number || '0000000000',
          price: order.total_amount,
          location: formData.location || buildLocationLine(order.shipping_address) || '',
          notes: formData.notes || order.customer_notes || ''
        }
      };

      const res = await axios.post(`${API_BASE_URL}/api/admin/shipping/create`, payload, { headers });
      if (res.data.success) {
        let labelDownloaded = false;
        if (res.data.labelAvailable && res.data.trackId) {
          try {
            await downloadLabel(res.data.trackId, res.data.env || labelEnv);
            labelDownloaded = true;
          } catch (downloadErr) {
            console.error('Auto label download failed:', downloadErr);
          }
        }

        const statusMsg = labelDownloaded || res.data.orderStatus === 'shipped'
          ? 'Shipment created — label ready. Order marked as SHIPPED.'
          : res.data.message || 'Shipment created successfully!';

        alert(statusMsg);
        setShowShipForm(false);
        if (onUpdate) await onUpdate();
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
      if (onUpdate) await onUpdate();
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

  const renderPrefillSummary = () => {
    const addr = order?.shipping_address;
    if (!addr) return null;
    return (
      <div className="ship-prefill-card">
        <div className="ship-prefill-title">
          <MapPin size={14} />
          Order delivery details
        </div>
        <div className="ship-prefill-grid">
          <div><span>Name</span><strong>{addr.name || '—'}</strong></div>
          <div><span>Phone</span><strong>{addr.phone || '—'}</strong></div>
          <div><span>City</span><strong>{addr.city || '—'}</strong></div>
          <div><span>Items</span><strong>{itemCount}</strong></div>
        </div>
        <p className="ship-prefill-address">{buildLocationLine(addr)}</p>
      </div>
    );
  };

  if (hasShipment) {
    return (
      <div className="shipping-section-container embedded">
        {renderTestModeRow()}
        <div className="shipping-info-box">
          <div className="shipping-info-header">
            <div className="company-logo">
              <Truck size={20} />
              <span>{order.shipping_company || 'ZMC Cargo'}</span>
            </div>
            <button type="button" className="refresh-btn" onClick={fetchTrackingInfo} disabled={loading}>
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
              <span className="label">Order Status</span>
              <span className={`status-text ${order.order_status === 'shipped' ? 'shipped' : 'pending'}`}>
                {order.order_status?.toUpperCase() || 'PENDING'}
              </span>
            </div>
          </div>

          <div className="track-footer">
            <button type="button" className="label-download-btn" onClick={handleManualLabelDownload} disabled={loading}>
              <Download size={14} />
              {loading ? 'Downloading...' : 'Download / Print Label'}
            </button>
            <span className="label-hint">Label download marks this order as shipped.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shipping-section-container embedded">
      {renderTestModeRow()}

      {!showShipForm ? (
        <div className="no-shipment">
          <div className="no-shipment-icon">
            <Truck size={28} />
          </div>
          <h4>Ready to ship</h4>
          <p>This order has not been shipped yet. ZMC fields will auto-fill from the customer address.</p>
          {order?.shipping_address && (
            <div className="no-shipment-preview">
              <Package size={14} />
              {itemCount} item(s) → {order.shipping_address.city}, {order.shipping_address.country}
            </div>
          )}
          <button type="button" className="primary-btn ship-cta" onClick={handleOpenShipForm}>
            <Send size={16} /> Create Shipment
          </button>
        </div>
      ) : (
        <form className="ship-form" onSubmit={handleCreateShipment}>
          <div className="form-header">
            <h4>Create ZMC Cargo Shipment</h4>
            <button type="button" className="close-form" onClick={() => setShowShipForm(false)} aria-label="Close">×</button>
          </div>

          {renderPrefillSummary()}

          {testMode && (
            <div className="ship-form-test-notice">
              Sandbox booking — reference prefixed with <strong>TEST-ORDER</strong>.
            </div>
          )}

          {prefilled && formData.city_id && (
            <div className="ship-form-autofill-notice">
              Auto-filled city, region, items ({formData.items_number}), and delivery address.
            </div>
          )}

          {prefilled && order?.shipping_address?.city && !formData.city_id && (
            <div className="ship-form-autofill-warning">
              City &quot;{order.shipping_address.city}&quot; did not match ZMC list — select manually.
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>City</label>
              <select value={formData.city_id} onChange={handleCityChange} required>
                <option value="">Select City</option>
                {cities.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.city_name || c.name}</option>
                ))}
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
                {regions.map(r => (
                  <option key={r.id} value={String(r.id)}>{r.region_name || r.name}</option>
                ))}
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
            <label>Delivery Location</label>
            <textarea
              rows={3}
              placeholder="Street, city, postal code..."
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-btn" onClick={() => setShowShipForm(false)}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Processing...' : testMode ? 'Create Test Shipment' : 'Create & Print Label'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ShippingSection;
