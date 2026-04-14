import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Package, User, MapPin, CreditCard, 
  Calendar, Clock, CheckCircle, Truck, DollarSign, Mail, Phone
} from 'lucide-react';
import Layout from '../../components/layout/Layout';
import Toast from '../../components/ui/Toast';
import ShippingSection from './components/ShippingSection';
import { API_BASE_URL } from '../../config/api';
import './OrderView.css';
import './components/ShippingSection.css';

const OrderView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setOrder(data.order);
      } else {
        setToast({ type: 'error', message: 'Failed to load order' });
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Error loading order details' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'shipped': return 'bg-purple-100 text-purple-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
        </div>
      </Layout>
    );
  }

  if (!order) return <Layout><div className="p-8 text-center">Order not found</div></Layout>;

  return (
    <Layout>
      <div className="order-view-container">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        {/* Header */}
        <div className="order-view-header">
          <button onClick={() => navigate('/orders')} className="back-btn">
            <ArrowLeft size={20} />
            Back to Orders
          </button>
          <div className="header-main">
            <div>
              <h1>Order Details</h1>
              <p className="order-no">#{order.order_number}</p>
            </div>
            <div className={`status-pill ${getStatusColor(order.order_status)}`}>
              <Clock size={16} />
              {order.order_status.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="order-view-grid">
          {/* Left Column: Details */}
          <div className="order-main-col">
            
            {/* Customer Info Card */}
            <div className="view-card">
              <div className="card-title">
                <User size={20} />
                <h2>Customer Information</h2>
              </div>
              <div className="info-row">
                <div className="info-block">
                  <label>Full Name</label>
                  <p>{order.first_name} {order.last_name}</p>
                </div>
                <div className="info-block">
                  <label>Email Address</label>
                  <div className="with-icon">
                    <Mail size={14} />
                    <p>{order.email}</p>
                  </div>
                </div>
                {order.phone_number && (
                  <div className="info-block">
                    <label>Phone Number</label>
                    <div className="with-icon">
                      <Phone size={14} />
                      <p>{order.phone_number}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Address Card */}
            <div className="view-card">
              <div className="card-title">
                <MapPin size={20} />
                <h2>Shipping Address</h2>
              </div>
              {order.shipping_address ? (
                <div className="address-content">
                  <p className="name">{order.shipping_address.name}</p>
                  <p className="phone">{order.shipping_address.phone}</p>
                  <p className="addr">{order.shipping_address.address}</p>
                  <p className="city-zip">{order.shipping_address.city}, {order.shipping_address.postal_code}</p>
                  <p className="country">{order.shipping_address.country}</p>
                </div>
              ) : (
                <p className="no-data">No shipping address provided</p>
              )}
            </div>

            {/* Order Items */}
            <div className="view-card items-card">
              <div className="card-title">
                <Package size={20} />
                <h2>Order Items</h2>
              </div>
              <div className="items-list">
                {order.items && order.items.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <div className="item-img">
                      {item.product_image ? <img src={item.product_image} alt="" /> : <Package size={24} />}
                    </div>
                    <div className="item-info">
                      <h3>{item.product_name}</h3>
                      <p>SKU: {item.product_sku || 'N/A'}</p>
                      <div className="item-meta">
                        {item.color && <span>Color: {item.color}</span>}
                        {item.size && <span>Size: {item.size}</span>}
                      </div>
                    </div>
                    <div className="item-price-qty">
                      <p className="qty">x{item.quantity}</p>
                      <p className="price">${item.unit_price}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="price-summary">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>${order.subtotal}</span>
                </div>
                {parseFloat(order.tax_amount) > 0 && (
                  <div className="summary-row">
                    <span>Tax</span>
                    <span>${order.tax_amount}</span>
                  </div>
                )}
                {parseFloat(order.shipping_amount) > 0 && (
                  <div className="summary-row">
                    <span>Shipping</span>
                    <span>${order.shipping_amount}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <span>Total Amount</span>
                  <span>${order.total_amount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Actions / Shipping */}
          <div className="order-side-col">
            
            {/* Quick Stats */}
            <div className="view-card stats-card">
              <div className="stat-item">
                <Calendar size={18} />
                <div>
                  <label>Order Date</label>
                  <p>{formatDate(order.created_at)}</p>
                </div>
              </div>
              <div className="stat-item">
                <CreditCard size={18} />
                <div>
                  <label>Payment Method</label>
                  <p className="capitalize">{order.payment_method || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Shipping Management Section */}
            <div className="view-card shipping-card">
              <div className="card-title">
                <Truck size={20} />
                <h2>Al-Waseet Shipping</h2>
              </div>
              <div className="shipping-inner">
                 <ShippingSection order={order} onUpdate={fetchOrderDetails} />
              </div>
            </div>

            {/* Admin Notes */}
            <div className="view-card">
              <div className="card-title">
                <Clock size={20} />
                <h2>Admin Notes</h2>
              </div>
              <textarea 
                className="admin-notes-area"
                placeholder="Add private notes about this order..."
                value={order.admin_notes || ''}
                readOnly
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrderView;
