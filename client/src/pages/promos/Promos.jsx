import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import PromoModal from './components/PromoModal';
import Toast from '../../components/ui/Toast';
import { API_BASE_URL } from '../../config/api';
import '../../components/ui/ToggleSwitch.css';
import './Promos.css';

const Promos = () => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({
    key_name: '',
    title: '',
    description: '',
    content_type: 'promo',
    status: 'active',
    priority: 0,
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/content/admin`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setContents(data.content || []);
      }
    } catch (error) {
      console.error('Error fetching contents:', error);
      setToast({ type: 'error', message: 'Failed to fetch contents' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = editingContent 
        ? `${API_BASE_URL}/api/content/admin/${editingContent.id}`
        : `${API_BASE_URL}/api/content/admin`;
      
      const method = editingContent ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          type: 'success',
          message: editingContent ? 'Content updated successfully!' : 'Content created successfully!'
        });
        setShowModal(false);
        resetForm();
        fetchContents();
      } else {
        setToast({
          type: 'error',
          message: data.message || 'Failed to save content'
        });
      }
    } catch (error) {
      console.error('Error saving content:', error);
      setToast({ type: 'error', message: 'Error saving content' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (content) => {
    setEditingContent(content);
    setFormData({
      key_name: content.key_name || '',
      title: content.title || '',
      description: content.description || '',
      content_type: content.content_type || 'promo',
      status: content.status || 'active',
      priority: content.priority || 0,
      start_date: content.start_date ? content.start_date.substring(0, 16) : '',
      end_date: content.end_date ? content.end_date.substring(0, 16) : ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/content/admin/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setToast({ type: 'success', message: 'Content deleted successfully!' });
        fetchContents();
      } else {
        setToast({ type: 'error', message: data.message || 'Failed to delete content' });
      }
    } catch (error) {
      console.error('Error deleting content:', error);
      setToast({ type: 'error', message: 'Error deleting content' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    setContents(prev => prev.map(c => 
      c.id === id ? { ...c, status: newStatus } : c
    ));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/content/admin/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          type: 'success',
          message: `Content ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
        });
      } else {
        setContents(prev => prev.map(c => 
          c.id === id ? { ...c, status: currentStatus } : c
        ));
        setToast({
          type: 'error',
          message: data.message || 'Failed to update status'
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setContents(prev => prev.map(c => 
        c.id === id ? { ...c, status: currentStatus } : c
      ));
      setToast({
        type: 'error',
        message: 'Error updating status'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      key_name: '',
      title: '',
      description: '',
      content_type: 'promo',
      status: 'active',
      priority: 0,
      start_date: '',
      end_date: ''
    });
    setEditingContent(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredContents = contents.filter(content => {
    const matchesSearch = 
      content.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      content.key_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      content.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || content.content_type === filterType;
    
    return matchesSearch && matchesType;
  });

  const getTypeColor = (type) => {
    const colors = {
      promo: '#10b981',
      ad: '#3b82f6',
      notification: '#f59e0b',
      banner: '#EA948A',
      popup: '#F5D6D1',
      other: '#6b7280'
    };
    return colors[type] || colors.other;
  };

  return (
    <Layout>
      <div className="promos-container">
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}

        <div className="promos-header">
          <div className="promos-header-left">
            <Tag size={32} />
            <div>
              <h1>Dynamic Content</h1>
              <p>Manage promotional texts and app content</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={20} />
            Add Content
          </button>
        </div>

        <div className="promos-filters">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search by title, key, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="promo">Promos</option>
            <option value="ad">Ads</option>
            <option value="notification">Notifications</option>
            <option value="banner">Banners</option>
            <option value="popup">Popups</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="promos-table-container">
          {loading && contents.length === 0 ? (
            <div className="loading-spinner">Loading...</div>
          ) : (
            <table className="promos-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContents.map(content => (
                  <tr key={content.id}>
                    <td className="content-key">
                      <code>{content.key_name}</code>
                    </td>
                    <td className="content-title">{content.title}</td>
                    <td className="content-description">
                      {content.description?.substring(0, 80)}
                      {content.description?.length > 80 ? '...' : ''}
                    </td>
                    <td>
                      <span 
                        className="type-badge" 
                        style={{ backgroundColor: getTypeColor(content.content_type) }}
                      >
                        {content.content_type}
                      </span>
                    </td>
                    <td className="content-priority">{content.priority}</td>
                    <td>
                      <span className={`status-badge status-${content.status}`}>
                        {content.status}
                      </span>
                    </td>
                    <td className="actions">
                      <button className="btn-icon" onClick={() => handleEdit(content)}>
                        <Edit size={18} />
                      </button>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={content.status === 'active'}
                          onChange={() => handleStatusToggle(content.id, content.status)}
                        />
                        <span className="slider"></span>
                      </label>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(content.id)}>
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {!loading && filteredContents.length === 0 && (
            <div className="empty-state">
              <Tag size={48} />
              <h3>No content found</h3>
              <p>Create your first promotional content to get started</p>
            </div>
          )}
        </div>

        <PromoModal
          show={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          formData={formData}
          onInputChange={handleInputChange}
          loading={loading}
          isEditing={!!editingContent}
        />
      </div>
    </Layout>
  );
};

export default Promos;
