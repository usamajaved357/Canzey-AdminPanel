import React from 'react';
import { X, Package, MapPin, CreditCard, Ticket, User, Calendar, DollarSign, Truck } from 'lucide-react';
import { API_BASE_URL } from '../../../config/api';
import ShippingSection from './ShippingSection';
import './OrderDetailsModal.css';
import './ShippingSection.css';

const OrderDetailsModal = ({ show, onClose, order, onUpdate }) => {
  if (!show || !order) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'status-delivered';
      case 'shipped': return 'status-shipped';
      case 'processing': return 'status-processing';
      case 'pending': return 'status-pending';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'status-paid';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-cancelled';
      case 'refunded': return 'status-shipped';
      default: return 'status-pending';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="order-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>Order Details</h2>
            <p className="order-number">{order.order_number}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Status & Summary */}
          <div className="order-summary">
            <div className="summary-card">
              <Calendar size={20} />
              <div>
                <span className="label">Order Date</span>
                <span className="value">{formatDate(order.created_at)}</span>
              </div>
            </div>
            <div className="summary-card">
              <DollarSign size={20} />
              <div>
                <span className="label">Total Amount</span>
                <span className="value">${order.total_amount}</span>
              </div>
            </div>
            <div className="summary-card">
              <Package size={20} />
              <div>
                <span className="label">Order Status</span>
                <span className={`status-badge ${getStatusColor(order.order_status)}`}>
                  {order.order_status}
                </span>
              </div>
            </div>
            <div className="summary-card">
              <CreditCard size={20} />
              <div>
                <span className="label">Payment Status</span>
                <span className={`status-badge ${getPaymentStatusColor(order.payment_status)}`}>
                  {order.payment_status}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="section">
            <h3><User size={20} /> Customer Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Name</span>
                <span className="info-value">{order.first_name || 'N/A'} {order.last_name || ''}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email</span>
                <span className="info-value">{order.email || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Shipping Section */}
          <div className="section">
            <h3><Truck size={20} /> Shipping Management</h3>
            <ShippingSection order={order} onUpdate={onUpdate} />
          </div>

          {/* Shipping Address */}
          {order.shipping_address && (
            <div className="section">
              <h3><MapPin size={20} /> Shipping Address</h3>
              <div className="address-box">
                <p><strong>{order.shipping_address.name}</strong></p>
                <p>{order.shipping_address.phone}</p>
                <p>{order.shipping_address.address}</p>
                <p>{order.shipping_address.city}, {order.shipping_address.postal_code}</p>
                <p>{order.shipping_address.country}</p>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="section">
            <h3><Package size={20} /> Order Items</h3>
            <div className="items-list">
              {order.items && order.items.map((item, index) => (
                <div key={index} className="item-card">
                  {item.product_image && (
                    <img 
                      src={`${API_BASE_URL}${item.product_image}`} 
                      alt={item.product_name}
                      className="item-image"
                    />
                  )}
                  <div className="item-details">
                    <h4>{item.product_name}</h4>
                    <p className="item-meta">
                      Quantity: {item.quantity} × ${item.price}
                    </p>
                    {(item.color || item.size) && (
                      <p className="item-variants">
                        {item.color && (
                          <span className="variant-tag">
                            <strong>Color:</strong> {item.color}
                          </span>
                        )}
                        {item.size && (
                          <span className="variant-tag">
                            <strong>Size:</strong> {item.size}
                          </span>
                        )}
                      </p>
                    )}
                    {item.campaign_title && (
                      <p className="campaign-badge">
                        <Ticket size={14} /> {item.campaign_title}
                      </p>
                    )}
                  </div>
                  <div className="item-price">
                    ${item.subtotal}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign Tickets */}
          {order.campaign_entries && order.campaign_entries.length > 0 && (
            <div className="section">
              <h3><Ticket size={20} /> Campaign Tickets ({order.campaign_entries.length})</h3>
              <div className="tickets-grid">
                {order.campaign_entries.map((entry, index) => (
                  <div key={index} className="ticket-card">
                    <div className="ticket-icon">
                      <Ticket size={24} />
                    </div>
                    <div className="ticket-info">
                      <p className="ticket-number">{entry.ticket_number}</p>
                      <p className="ticket-campaign">{entry.campaign_title}</p>
                      <span className={`ticket-status ${entry.status === 'active' ? 'active' : 'inactive'}`}>
                        {entry.status || 'active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

            </div>
          )}
          
          </div>

          {/* Order Items */}
          <div className="section">
            <h3><CreditCard size={20} /> Payment Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Payment Method</span>
                <span className="info-value">{order.payment_method || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Transaction ID</span>
                <span className="info-value">{order.payment_transaction_id || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Payment Status</span>
                <span className={`status-badge ${getPaymentStatusColor(order.payment_status)}`}>
                  {order.payment_status}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="section">
              <h3>Notes</h3>
              <p className="notes-text">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;
