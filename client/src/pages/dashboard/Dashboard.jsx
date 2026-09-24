import React, { useState, useEffect } from 'react';
import { ShoppingCart, Users, DollarSign, Activity, ArrowUpRight, Clock, Package, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { API_BASE_URL } from '../../config/api';
import './Dashboard.css';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalOrders: 0,
        totalCustomers: 0,
        activeOrders: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/admin/dashboard/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
                setRecentOrders(data.recentOrders);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statsData = [
        {
            title: 'Total Revenue',
            value: `$${stats.totalRevenue.toLocaleString()}`,
            icon: <DollarSign size={24} />,
            color: 'bg-rose-100 text-rose-600',
            trend: '+12%',
            trendColor: 'text-green-500'
        },
        {
            title: 'Total Orders',
            value: stats.totalOrders.toString(),
            icon: <ShoppingCart size={24} />,
            color: 'bg-blue-100 text-blue-600',
            trend: '+8%',
            trendColor: 'text-green-500'
        },
        {
            title: 'Customers',
            value: stats.totalCustomers.toString(),
            icon: <Users size={24} />,
            color: 'bg-pink-100 text-pink-600',
            trend: '+15%',
            trendColor: 'text-green-500'
        },
        {
            title: 'Active Orders',
            value: stats.activeOrders.toString(),
            icon: <Activity size={24} />,
            color: 'bg-orange-100 text-orange-600',
            trend: '+5%',
            trendColor: 'text-green-500'
        }
    ];

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    };

    return (
        <Layout>
            <div className="dashboard-content">
                <div className="dashboard-header">
                    <div className="header-info">
                        <h1 className="header-title">Dashboard Overview</h1>
                        <p className="header-subtitle">Welcome back! Here's what's happening with your store today.</p>
                    </div>
                    <div className="header-status">
                        <span className="status-dot"></span>
                        Live
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    {statsData.map((stat, index) => (
                        <div key={index} className="stats-card">
                            <div className="stats-card-header">
                                <div className={`stats-icon ${stat.color}`}>
                                    {stat.icon}
                                </div>
                            </div>
                            <div className="stats-body">
                                <p className="stats-label">{stat.title}</p>
                                <h3 className="stats-value">{stat.value}</h3>
                            </div>
                            <div className="stats-footer">
                                <span className={`trend ${stat.trendColor}`}>
                                    <ArrowUpRight size={14} /> {stat.trend}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="dashboard-lower-grid">
                    {/* Recent Orders */}
                    <div className="dashboard-section recent-orders">
                        <div className="section-header">
                            <div className="section-title-box">
                                <Package size={20} className="text-rose-600" />
                                <h3>Recent Orders</h3>
                            </div>
                            <Link to="/orders" className="view-all-btn">View All</Link>
                        </div>
                        <div className="table-container">
                            {loading ? (
                                <div className="loading-spinner">Loading...</div>
                            ) : recentOrders.length > 0 ? (
                                <table className="dashboard-table">
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Customer</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentOrders.map((order) => (
                                            <tr key={order.id}>
                                                <td className="font-mono text-sm">#{order.order_number.slice(-8)}</td>
                                                <td>{order.customer_name}</td>
                                                <td className="font-bold">${order.total_amount}</td>
                                                <td>
                                                    <span className={`status-pill ${order.order_status}`}>
                                                        {order.order_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">No recent orders</div>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="dashboard-section recent-activity">
                        <div className="section-header">
                            <div className="section-title-box">
                                <Activity size={20} className="text-rose-600" />
                                <h3>Recent Activity</h3>
                            </div>
                        </div>
                        <div className="activity-list">
                            {recentOrders.map((order, index) => (
                                <div key={index} className="activity-item">
                                    <div className="activity-icon-box">
                                        <Clock size={18} />
                                    </div>
                                    <div className="activity-text">
                                        <p><strong>New Order</strong> placed by {order.customer_name}</p>
                                        <span>{formatDate(order.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                            {recentOrders.length === 0 && (
                                <div className="empty-state">No recent activity</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
