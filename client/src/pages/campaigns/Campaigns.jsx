import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import CampaignDetailModal from '../../components/CampaignDetailModal/CampaignDetailModal';
import { Plus, Eye, X } from 'lucide-react';
import { getImageUrl, API_BASE_URL } from '../../config/api';
import './Campaigns.css';

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'featured',
    status: 'active',
    start_at: '',
    end_at: '',
    use_end_date: true
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/campaigns`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns);
      } else {
        console.error('Failed to fetch campaigns');
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCampaignActive = (c) => c.status === 'active' && c.active_prizes_count > 0;
  const isCampaignCompleted = (c) => c.status === 'closed' || (c.status === 'active' && c.active_prizes_count === 0);

  const filteredCampaigns = campaigns.filter(c => {
    if (activeTab === 'active') return isCampaignActive(c);
    if (activeTab === 'completed') return isCampaignCompleted(c);
    return true; // 'all'
  });

  const counts = {
    all: campaigns.length,
    active: campaigns.filter(isCampaignActive).length,
    completed: campaigns.filter(isCampaignCompleted).length
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const totalImages = existingImages.length + selectedImages.length + files.length;
    
    if (totalImages > 5) {
      alert('Maximum 5 images allowed');
      return;
    }
    
    // Add new files
    setSelectedImages(prev => [...prev, ...files]);
    
    // Create previews
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeNewImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingCampaign 
        ? `${API_BASE_URL}/api/admin/campaigns/${editingCampaign.id}`
        : `${API_BASE_URL}/api/admin/campaigns`;
      
      const method = editingCampaign ? 'PUT' : 'POST';
      
      // Create FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('category', formData.category);
      formDataToSend.append('status', formData.status);
      formDataToSend.append('start_at', formData.start_at || '');
      formDataToSend.append('end_at', formData.end_at || '');
      formDataToSend.append('use_end_date', formData.use_end_date);
      
      // Add existing images if editing
      if (editingCampaign && existingImages.length > 0) {
        formDataToSend.append('existing_images', JSON.stringify(existingImages));
      }
      
      // Add new image files
      selectedImages.forEach(file => {
        formDataToSend.append('images', file);
      });
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend
      });

      if (response.ok) {
        await fetchCampaigns();
        setShowModal(false);
        setEditingCampaign(null);
        setFormData({
          title: '',
          description: '',
          status: 'active',
          start_at: '',
          end_at: '',
          use_end_date: true
        });
        setSelectedImages([]);
        setImagePreviews([]);
        setExistingImages([]);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      alert('Error saving campaign');
    }
  };

  const handleEdit = (campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      title: campaign.title,
      description: campaign.description || '',
      category: campaign.category || 'featured',
      status: campaign.status,
      start_at: campaign.start_at ? new Date(campaign.start_at).toISOString().slice(0, 16) : '',
      end_at: campaign.end_at ? new Date(campaign.end_at).toISOString().slice(0, 16) : '',
      use_end_date: campaign.use_end_date !== 0 && campaign.use_end_date !== false
    });
    setSelectedImages([]);
    setImagePreviews([]);
    // Set existing images from campaign
    const existingImgUrls = campaign.images?.map(img => img.image_url) || (campaign.image_url ? [campaign.image_url] : []);
    setExistingImages(existingImgUrls);
    setShowModal(true);
  };

  const handleDelete = async (campaignId) => {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchCampaigns();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Error deleting campaign');
    }
  };

  const openCreateModal = () => {
    setEditingCampaign(null);
    setFormData({
      title: '',
      description: '',
      status: 'active',
      start_at: '',
      end_at: '',
      use_end_date: true
    });
    setSelectedImages([]);
    setImagePreviews([]);
    setExistingImages([]);
    setShowModal(true);
  };

  const prizeStatus = (campaign) => {
    if (campaign.status === 'inactive') return { label: 'Inactive', className: 'status-inactive' };
    if (campaign.status === 'closed') return { label: 'Closed', className: 'status-closed' };
    if (Number(campaign.active_prizes_count) === 0) return { label: 'Sold out', className: 'status-closed' };
    return { label: 'Active', className: 'status-active' };
  };

  const endDateLabel = (campaign) => {
    const usesEndDate = campaign.use_end_date && campaign.end_at;
    if (!usesEndDate) return 'No end date';
    return new Date(campaign.end_at).toLocaleDateString();
  };

  const handleViewDetails = (campaign) => {
    setSelectedCampaign(campaign);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedCampaign(null);
  };

  const handleEditFromDetail = (campaign) => {
    setShowDetailModal(false);
    handleEdit(campaign);
  };

  const handleDeleteFromDetail = async (campaignId) => {
    setShowDetailModal(false);
    await handleDelete(campaignId);
  };

  if (loading) {
    return (
      <Layout>
        <div className="campaigns-container">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="campaigns-container">
      <div className="campaigns-header">
        <h1>Prize Management</h1>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          Create New Prize
        </button>
      </div>

      <div className="campaigns-tabs">
        <button 
          className={`campaigns-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Prizes <span className="tab-count">{counts.all}</span>
        </button>
        <button 
          className={`campaigns-tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active <span className="tab-count">{counts.active}</span>
        </button>
        <button 
          className={`campaigns-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Sold Out / Ended <span className="tab-count">{counts.completed}</span>
        </button>
      </div>

      <div className="campaigns-table-container">
        <table className="campaigns-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>Category</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCampaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <div className="campaign-image-cell">
                    {campaign.image_url || (campaign.images && campaign.images.length > 0) ? (
                      <img 
                        src={getImageUrl(campaign.image_url || campaign.images[0].image_url)} 
                        alt={campaign.title} 
                        className="campaign-thumbnail" 
                      />
                    ) : (
                      <div className="campaign-no-image">No Image</div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="campaign-title-cell">
                    <strong>{campaign.title}</strong>
                    <div className="campaign-subtitle">ID: {campaign.id}</div>
                  </div>
                </td>
                <td>
                  <span className={`category-badge category-${campaign.category || 'featured'}`}>
                    {campaign.category || 'featured'}
                  </span>
                </td>
                <td>{campaign.start_at ? new Date(campaign.start_at).toLocaleDateString() : 'No limit'}</td>
                <td>{endDateLabel(campaign)}</td>
                <td>
                  <span className={`status-badge ${prizeStatus(campaign).className}`}>
                    {prizeStatus(campaign).label}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn-view" 
                      onClick={() => handleViewDetails(campaign)}
                      title="View Details"
                    >
                      <Eye size={14} />
                      Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {campaigns.length === 0 && (
          <div className="no-campaigns">
            <p>No prizes found. Create your first prize!</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingCampaign ? 'Edit Prize' : 'Create New Prize'}</h2>
              <button 
                className="modal-close" 
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="campaign-form">
              <div className="form-group">
                <label htmlFor="title">Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  <option value="exclusive">Exclusive</option>
                  <option value="cash">Cash</option>
                  <option value="electronics">Electronics</option>
                  <option value="featured">Featured</option>
                  <option value="new">New</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div className="form-group">
                <label>Prize Images (Max 5)</label>
                
                {/* Existing Images */}
                {existingImages.length > 0 && (
                  <div className="images-grid">
                    <p className="images-label">Current Images:</p>
                    <div className="image-previews">
                      {existingImages.map((imgUrl, index) => (
                        <div key={`existing-${index}`} className="image-preview-item">
                          <img src={getImageUrl(imgUrl)} alt={`Prize ${index + 1}`} />
                          <button
                            type="button"
                            className="remove-image-btn"
                            onClick={() => removeExistingImage(index)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="images-grid">
                    <p className="images-label">New Images:</p>
                    <div className="image-previews">
                      {imagePreviews.map((preview, index) => (
                        <div key={`new-${index}`} className="image-preview-item">
                          <img src={preview} alt={`New ${index + 1}`} />
                          <button
                            type="button"
                            className="remove-image-btn"
                            onClick={() => removeNewImage(index)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Input */}
                {(existingImages.length + selectedImages.length) < 5 && (
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      id="images"
                      name="images"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="file-input"
                    />
                    <label htmlFor="images" className="file-input-label">
                      Choose Images ({5 - existingImages.length - selectedImages.length} remaining)
                    </label>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="start_at">Start Date</label>
                  <input
                    type="datetime-local"
                    id="start_at"
                    name="start_at"
                    value={formData.start_at}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end_at">End Date</label>
                  <input
                    type="datetime-local"
                    id="end_at"
                    name="end_at"
                    value={formData.end_at}
                    onChange={handleInputChange}
                    disabled={!formData.use_end_date}
                    style={{
                      opacity: formData.use_end_date ? 1 : 0.6,
                      background: formData.use_end_date ? 'white' : '#f1f5f9'
                    }}
                  />
                  <div style={{ marginTop: '12px' }}>
                    <label 
                      className={`switch-container ${formData.use_end_date ? 'active' : ''}`}
                      htmlFor="use_end_date"
                    >
                      <div className="switch">
                        <input
                          type="checkbox"
                          id="use_end_date"
                          name="use_end_date"
                          checked={formData.use_end_date}
                          onChange={handleInputChange}
                        />
                        <span className="slider"></span>
                      </div>
                      <div className="switch-label-group">
                        <span className="switch-label-main">Close on this date</span>
                        <span className="switch-label-sub">
                          {formData.use_end_date
                            ? 'The prize stops when this date passes.'
                            : 'Off. The prize stays open until the tickets run out.'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCampaign ? 'Update Prize' : 'Create Prize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Detail Modal */}
      <CampaignDetailModal
        campaign={selectedCampaign}
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
      />
      </div>
    </Layout>
  );
};

export default Campaigns;
