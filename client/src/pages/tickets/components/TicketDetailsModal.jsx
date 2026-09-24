import React, { useState } from 'react';
import { X, Ticket, User, Package, Calendar, Award, ExternalLink, CheckCircle } from 'lucide-react';
import './TicketDetailsModal.css';

const TicketDetailsModal = ({ ticket, onClose, onMarkWinner }) => {
  const [processing, setProcessing] = useState(false);

  if (!ticket) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleToggleWinner = async () => {
    setProcessing(true);
    await onMarkWinner(ticket.id, !ticket.is_winner);
    setProcessing(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ticket-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-title">
            <h2>Ticket Details</h2>
            <span className="ticket-number-sub">{ticket.ticket_number}</span>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          {/* Main Info Card */}
          <div className="ticket-main-card">
            <div className="ticket-icon-bg">
              <Ticket size={40} className="text-white" />
            </div>
            <div className="ticket-status-badge-container">
               {ticket.is_winner ? (
                 <span className="winner-badge pulse">
                   <Award size={16} /> WINNER
                 </span>
               ) : (
                 <span className={`status-badge ${ticket.status}`}>
                   {ticket.status.toUpperCase()}
                 </span>
               )}
            </div>
            <h3 className="ticket-no">{ticket.ticket_number}</h3>
            <p className="created-at">Issued on {formatDate(ticket.created_at)}</p>
          </div>

          <div className="details-grid">
            {/* Campaign Section */}
            <div className="info-section card">
              <div className="section-header">
                <Package size={20} className="text-rose-600" />
                <h3>Campaign Info</h3>
              </div>
              <div className="info-content">
                <div className="info-row">
                  <span className="label">Campaign</span>
                  <span className="value">{ticket.campaign_title || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Campaign ID</span>
                  <span className="value">#{ticket.campaign_id}</span>
                </div>
                <div className="info-row">
                  <span className="label">Product ID</span>
                  <span className="value">
                    <span className="product-id-badge">
                      <Package size={14} />
                      {ticket.product_id || 'N/A'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Section */}
            <div className="info-section card">
              <div className="section-header">
                <User size={20} className="text-rose-600" />
                <h3>Customer Info</h3>
              </div>
              <div className="info-content">
                <div className="info-row">
                  <span className="label">Name</span>
                  <span className="value">{ticket.customer_name}</span>
                </div>
                <div className="info-row">
                  <span className="label">Email</span>
                  <span className="value">{ticket.customer_email || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Customer ID</span>
                  <span className="value">#{ticket.customer_id}</span>
                </div>
              </div>
            </div>

            {/* Order Section */}
            <div className="info-section card">
              <div className="section-header">
                <Calendar size={20} className="text-rose-600" />
                <h3>Transaction Info</h3>
              </div>
              <div className="info-content">
                <div className="info-row">
                  <span className="label">Order Number</span>
                  <span className="value font-mono">{ticket.order_number || 'Internal'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Purchase Price</span>
                  <span className="value">IQD {Number(ticket.total_price || 0).toLocaleString()}</span>
                </div>
                <div className="info-row">
                  <span className="label">Source</span>
                  <span className="value capitalize">{ticket.source || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Winner Section */}
            {ticket.is_winner && (
              <div className="info-section card winner-details">
                <div className="section-header">
                  <Award size={20} className="text-amber-600" />
                  <h3>Winner Details</h3>
                </div>
                <div className="info-content">
                  <div className="info-row">
                    <span className="label">Won At</span>
                    <span className="value">{formatDate(ticket.won_at)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button 
              className={`winner-action-btn ${ticket.is_winner ? 'remove-winner' : 'mark-winner'}`}
              onClick={handleToggleWinner}
              disabled={processing}
            >
              {processing ? (
                <div className="spinner-small"></div>
              ) : ticket.is_winner ? (
                <>
                  <X size={20} /> Remove Winner Status
                </>
              ) : (
                <>
                  <CheckCircle size={20} /> Mark this Ticket as Winner
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
