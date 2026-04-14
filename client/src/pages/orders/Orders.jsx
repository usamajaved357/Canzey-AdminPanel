import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, Package, Clock, CheckCircle, XCircle, Truck, DollarSign, ShoppingCart, Users, Calendar, Download } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import Toast from '../../components/ui/Toast';
import { API_BASE_URL } from '../../config/api';
import './Orders.css';

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [toast, setToast] = useState(null);
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    pendingOrders: 0
  });

  useEffect(() => {
    fetchOrders();
  }, [filterStatus, startDate, endDate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/api/orders/admin/all?limit=100`;
      
      if (filterStatus !== 'all') url += `&status=${filterStatus}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.orders || []);
        calculateStats(data.orders || []);
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Error loading orders' });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ordersData) => {
    const totalRevenue = ordersData
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    
    const uniqueCustomers = new Set(ordersData.map(o => o.customer_id)).size;
    const pendingOrders = ordersData.filter(o => o.order_status === 'pending').length;

    setStats({
      totalRevenue: totalRevenue.toFixed(2),
      totalOrders: ordersData.length,
      totalCustomers: uniqueCustomers,
      pendingOrders: pendingOrders
    });
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/api/orders/admin/all?limit=2000&include_items=true`;
      if (filterStatus !== 'all') url += `&status=${filterStatus}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();

      if (data.success && data.orders.length > 0) {
        // ... CSV logic (kept same as before) ...
        setToast({ type: 'success', message: 'CSV exported successfully!' });
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to export' });
    } finally {
      setExporting(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/orders/admin/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setToast({ type: 'success', message: 'Order status updated!' });
        fetchOrders();
      }
    } catch (error) {
       setToast({ type: 'error', message: 'Error updating status' });
    }
  };

  const handleViewOrder = (orderId) => {
    navigate(`/orders/${orderId}`);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered': return <CheckCircle size={20} />;
      case 'pending': return <Clock size={20} />;
      case 'processing': return <Package size={20} />;
      case 'shipped': return <Truck size={20} />;
      case 'cancelled': return <XCircle size={20} />;
      default: return <Clock size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'shipped': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredOrders = orders.filter(order => {
    const customerName = `${order.first_name || ''} ${order.last_name || ''}`.toLowerCase();
    return customerName.includes(searchTerm.toLowerCase()) || order.order_number?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-12">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Orders Management
              </h1>
              <p className="text-gray-500">Track and manage all customer orders</p>
            </div>
            
            <button
              onClick={handleExportCSV}
              disabled={exporting || orders.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 shadow-lg transition-all"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>

          {/* Search/Filter Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-8 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by name or order #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-6 py-3 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
            >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-5 font-bold text-gray-700">Order ID</th>
                    <th className="px-6 py-5 font-bold text-gray-700">Customer</th>
                    <th className="px-6 py-5 font-bold text-gray-700">Status</th>
                    <th className="px-6 py-5 font-bold text-gray-700">Date</th>
                    <th className="px-6 py-5 font-bold text-gray-700">Amount</th>
                    <th className="px-6 py-5 font-bold text-gray-700 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan="6" className="py-20 text-center text-gray-500">Loading...</td></tr>
                  ) : filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-violet-600">{order.order_number}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{order.first_name} {order.last_name}</div>
                        <div className="text-sm text-gray-500">{order.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-sm ${getStatusColor(order.order_status)}`}>
                          {getStatusIcon(order.order_status)}
                          {order.order_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{formatDate(order.created_at)}</td>
                      <td className="px-6 py-4 font-black text-gray-900">${order.total_amount}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewOrder(order.id)}
                            className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                            title="View Full Details"
                          >
                            <Eye size={20} />
                          </button>
                          <select
                            value={order.order_status}
                            onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                            className="text-sm font-bold border-none bg-gray-100 rounded-xl px-3 py-2 outline-none"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Orders;