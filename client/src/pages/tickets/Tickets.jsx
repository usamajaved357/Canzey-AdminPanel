import React, { useState, useEffect } from 'react';
import { Search, Filter, Ticket, User, Package, Calendar, Award, Eye } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import Toast from '../../components/ui/Toast';
import { API_BASE_URL } from '../../config/api';
import TicketDetailsModal from './components/TicketDetailsModal';
import './Tickets.css';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [stats, setStats] = useState({
    totalTickets: 0,
    activeTickets: 0,
    totalCampaigns: 0,
    winners: 0
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/tickets/admin/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setTickets(data.tickets || []);
        calculateStats(data.tickets || []);
      } else {
        setToast({ type: 'error', message: 'Failed to fetch tickets' });
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setToast({ type: 'error', message: 'Error loading tickets' });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ticketsData) => {
    const totalTickets = ticketsData.length;
    const activeTickets = ticketsData.filter(t => t.status === 'active').length;
    const uniqueCampaigns = new Set(ticketsData.map(t => t.campaign_id)).size;
    const winners = ticketsData.filter(t => t.is_winner).length;

    setStats({
      totalTickets,
      activeTickets,
      totalCampaigns: uniqueCampaigns,
      winners
    });
  };

  const handleMarkWinner = async (ticketId, isWinner) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/tickets/admin/mark-winner/${ticketId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_winner: isWinner })
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        const updatedTickets = tickets.map(t => 
          t.id === ticketId ? { ...t, is_winner: isWinner, won_at: isWinner ? new Date().toISOString() : null } : t
        );
        setTickets(updatedTickets);
        calculateStats(updatedTickets);
        
        // Update selected ticket in modal if open
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket({ ...selectedTicket, is_winner: isWinner, won_at: isWinner ? new Date().toISOString() : null });
        }

        setToast({ type: 'success', message: data.message });
      } else {
        setToast({ type: 'error', message: data.message });
      }
    } catch (error) {
      console.error('Error marking winner:', error);
      setToast({ type: 'error', message: 'Failed to update winner status' });
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.campaign_title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (filterStatus === 'winners') {
      matchesFilter = ticket.is_winner === 1 || ticket.is_winner === true;
    } else if (filterStatus !== 'all') {
      matchesFilter = ticket.status === filterStatus;
    }
    
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const statsData = [
    {
      icon: <Ticket size={24} />,
      title: 'Total Tickets',
      value: stats.totalTickets.toString(),
      color: 'from-violet-500 to-purple-600'
    },
    {
      icon: <Award size={24} />,
      title: 'Winners',
      value: stats.winners.toString(),
      color: 'from-amber-500 to-orange-600'
    },
    {
      icon: <Package size={24} />,
      title: 'Campaigns',
      value: stats.totalCampaigns.toString(),
      color: 'from-blue-500 to-cyan-600'
    },
    {
      icon: <Calendar size={24} />,
      title: 'Active Tickets',
      value: stats.activeTickets.toString(),
      color: 'from-green-500 to-emerald-600'
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto">
          {toast && (
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onClose={() => setToast(null)} 
            />
          )}

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Campaign Tickets
            </h1>
            <p className="text-gray-600 text-lg">Manage tickets and announce winners</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statsData.map((stat, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white mb-4`}>
                  {stat.icon}
                </div>
                <p className="text-gray-600 text-sm mb-1">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-8 border border-gray-100">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search tickets, orders, customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Filter */}
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-12 pr-8 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none bg-white cursor-pointer transition-all min-w-[180px]"
                >
                  <option value="all">All Tickets</option>
                  <option value="active">Active Only</option>
                  <option value="winners">Winners</option>
                  <option value="used">Used</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ticket Number</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Campaign</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Product ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Customer</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Order</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                          <span className="ml-3 text-gray-600">Loading tickets...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => (
                      <tr key={ticket.id} className={`hover:bg-gray-50 transition-colors ${ticket.is_winner ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Ticket size={18} className={ticket.is_winner ? "text-amber-500" : "text-violet-600"} />
                            <div className="flex flex-col">
                              <span className={`font-mono font-bold ${ticket.is_winner ? "text-amber-600" : "text-violet-600"}`}>
                                {ticket.ticket_number}
                              </span>
                              {ticket.is_winner ? (
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">★ Winner</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{ticket.campaign_title}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-gray-400" />
                            <span className="font-mono text-sm font-medium text-violet-600 bg-violet-50 px-2 py-1 rounded">
                              {ticket.product_id || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${ticket.is_winner ? 'from-amber-400 to-orange-500' : 'from-violet-500 to-purple-600'} flex items-center justify-center text-white text-sm font-semibold`}>
                              {ticket.customer_name?.charAt(0) || 'U'}
                            </div>
                            <span className="text-gray-900 font-medium">{ticket.customer_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-gray-500">{ticket.order_number || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">{formatDate(ticket.created_at)}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button 
                              onClick={() => setSelectedTicket(ticket)}
                              className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-600 rounded-xl font-bold text-sm hover:bg-violet-600 hover:text-white transition-all border border-violet-100"
                            >
                              <Eye size={16} /> Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-12">
                        <div className="text-center">
                          <Ticket size={48} className="mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg font-medium">No tickets found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {selectedTicket && (
        <TicketDetailsModal 
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onMarkWinner={handleMarkWinner}
        />
      )}
    </Layout>
  );
};

export default Tickets;
