import React, { useState, useEffect } from 'react';
import { Plus, Edit, Package, Search, Zap, Clock, Trophy, LayoutGrid, Ticket, Lock, Eye } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import ProductModal from './components/ProductModal';
import Toast from '../../components/ui/Toast';
import { API_ENDPOINTS, getAuthHeaders, getImageUrl, API_BASE_URL } from '../../config/api';
import '../../components/ui/ToggleSwitch.css';
import './Products.css';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [drawTab, setDrawTab] = useState('all');
  const [isLocked, setIsLocked] = useState(false); // true when viewing a past-draw product
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    sku: '',
    price: '',
    sale_price: '',
    stock_quantity: '',
    status: 'active',
    category: '',
    sub_category: '',
    for_gender: '',
    is_customized: false,
    tags: '',
    campaign_id: '',
    tickets_required: '',
    countdown_start_tickets: '',
    draw_date: '',
    prize_end_date: '',
    colors: [],
    sizes: []
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.PRODUCTS.LIST, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        console.log('📦 [DEBUG] Products fetched:', data.products?.length);
        if (data.products?.length > 0) {
          console.log('📦 [DEBUG] Sample product prize info:', {
            id: data.products[0].id,
            name: data.products[0].name,
            tickets: data.products[0].tickets_required,
            countdown: data.products[0].countdown_start_tickets
          });
        }
        setProducts(data.products || []);
      } else {
        setToast({ type: 'error', message: 'Failed to fetch products' });
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setToast({ type: 'error', message: 'Error fetching products' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/campaigns', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  useEffect(() => {
    console.log('🚀 [VERSION] Canzey Admin Dashboard v' + __APP_VERSION__ + ' - Build: ' + __BUILD_DATE__);
    fetchProducts();
    fetchCampaigns();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddColor = (color) => {
    setFormData(prev => ({
      ...prev,
      colors: [...prev.colors, color]
    }));
  };

  const handleRemoveColor = (index) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index)
    }));
  };

  const handleAddSize = (sizeData) => {
    // Accept either string or object { size, stock_quantity }
    const sizeObj = typeof sizeData === 'string' 
      ? { size: sizeData, stock_quantity: 0 } 
      : sizeData;
    setFormData(prev => ({
      ...prev,
      sizes: [...prev.sizes, sizeObj]
    }));
  };

  const handleRemoveSize = (index) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index)
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedImages(prev => [...prev, ...files]);
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

  const handleStatusToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, status: newStatus } : p
    ));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.PRODUCTS.UPDATE(id), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await response.json();
      if (!data.success) {
        setProducts(prev => prev.map(p => 
          p.id === id ? { ...p, status: currentStatus } : p
        ));
        setToast({ type: 'error', message: 'Failed to update status' });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setProducts(prev => prev.map(p => 
        p.id === id ? { ...p, status: currentStatus } : p
      ));
      setToast({ type: 'error', message: 'Error updating status' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.PRODUCTS.DELETE(id), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setToast({ type: 'success', message: 'Product deleted successfully' });
        if (showModal) setShowModal(false);
        fetchProducts();
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to delete product' });
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      setToast({ type: 'error', message: 'Error deleting product' });
    }
  };

  const saveProductPrize = async (productId) => {
    try {
      const token = localStorage.getItem('token');
      const prizeData = {
        product_id: productId,
        campaign_id: formData.campaign_id,
        tickets_required: parseInt(formData.tickets_required),
        countdown_start_tickets: parseInt(formData.countdown_start_tickets) || 0
      };

      const response = await fetch(`${API_BASE_URL}/api/admin/product-prizes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prizeData)
      });

      const result = await response.json();
      if (!result.success) {
        console.error('Failed to save product prize:', result.message);
      }
    } catch (error) {
      console.error('Error saving product prize:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = editingProduct 
        ? API_ENDPOINTS.PRODUCTS.UPDATE(editingProduct.id)
        : API_ENDPOINTS.PRODUCTS.CREATE;
      
      const method = editingProduct ? 'PUT' : 'POST';

      // Create FormData for file upload
      const formDataToSend = new FormData();
      
      // Add all form fields
      formDataToSend.append('name', formData.name);
      formDataToSend.append('slug', formData.slug || '');
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('sku', formData.sku || '');
      formDataToSend.append('price', formData.price);
      formDataToSend.append('sale_price', formData.sale_price || '');
      formDataToSend.append('stock_quantity', formData.stock_quantity || 0);
      formDataToSend.append('status', formData.status);
      formDataToSend.append('category', formData.category || '');
      formDataToSend.append('sub_category', formData.sub_category || '');
      formDataToSend.append('for_gender', formData.for_gender || '');
      formDataToSend.append('is_customized', formData.is_customized ? '1' : '0');
      formDataToSend.append('tags', formData.tags || '');
      formDataToSend.append('campaign_id', formData.campaign_id || '');
      formDataToSend.append('tickets_required', formData.tickets_required || '');
      formDataToSend.append('countdown_start_tickets', formData.countdown_start_tickets || '');
      formDataToSend.append('draw_date', formData.draw_date || '');
      formDataToSend.append('prize_end_date', formData.prize_end_date || '');
      formDataToSend.append('colors', JSON.stringify(formData.colors || []));
      formDataToSend.append('sizes', JSON.stringify(formData.sizes || []));
      
      // Add existing images if editing
      if (editingProduct && existingImages.length > 0) {
        formDataToSend.append('existing_images', JSON.stringify(existingImages));
      }
      
      // Add new image files
      selectedImages.forEach(file => {
        formDataToSend.append('images', file);
      });

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          type: 'success',
          message: editingProduct ? 'Product updated successfully!' : 'Product created successfully!'
        });
        setShowModal(false);
        resetForm();
        fetchProducts();
      } else {
        setToast({
          type: 'error',
          message: data.error || data.message || 'Failed to save product'
        });
      }
    } catch (error) {
      console.error('Error saving product:', error);
      setToast({ type: 'error', message: 'Error saving product' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (product) => {
    console.log('📝 [DEBUG] Editing product:', product.id, product.name);
    
    let tickets = product.tickets_required || '';
    let countdown = product.countdown_start_tickets || '';
    let drawDate = product.draw_date || '';
    let prizeEndDate = product.prize_end_date || '';

    // If prize info is missing from list view, try fetching individually
    if (!tickets && product.campaign_id) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/product-prizes?product_id=${product.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          const prizeInfo = data.product_prizes.find(pp => pp.product_id === product.id);
          if (prizeInfo) {
            tickets = prizeInfo.tickets_required;
            countdown = prizeInfo.countdown_start_tickets;
            drawDate = prizeInfo.draw_date;
            prizeEndDate = prizeInfo.end_date;
            console.log('🎯 [DEBUG] Found prize info via secondary fetch:', { tickets, countdown, drawDate, prizeEndDate });
          }
        }
      } catch (err) {
        console.error('Error fetching secondary prize info:', err);
      }
    }

    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      slug: product.slug || '',
      description: product.description || '',
      sku: product.sku || '',
      price: product.price || '',
      sale_price: product.sale_price || '',
      stock_quantity: product.stock_quantity || 0,
      status: product.status || 'active',
      category: product.category || '',
      sub_category: product.sub_category || '',
      for_gender: product.for_gender || '',
      is_customized: product.is_customized === 1 || product.is_customized === true,
      tags: product.tags || '',
      campaign_id: product.campaign_id || '',
      tickets_required: tickets || '',
      countdown_start_tickets: countdown || '',
      draw_date: drawDate || '',
      prize_end_date: prizeEndDate || '',
      colors: product.colors || [],
      sizes: product.sizes || []
    });
    
    // Set existing images
    const existingImageUrls = product.images?.map(img => img.image_url) || [];
    setExistingImages(existingImageUrls);
    
    // Clear new images
    setSelectedImages([]);
    setImagePreviews([]);
    
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      sku: '',
      price: '',
      sale_price: '',
      stock_quantity: '',
      status: 'active',
      category: '',
      sub_category: '',
      for_gender: '',
      is_customized: false,
      tags: '',
      campaign_id: '',
      tickets_required: '',
      countdown_start_tickets: '',
      draw_date: '',
      prize_end_date: '',
      colors: [],
      sizes: []
    });
    setEditingProduct(null);
    setSelectedImages([]);
    setImagePreviews([]);
    setExistingImages([]);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Open modal in VIEW-ONLY mode for past/locked draws
  const handleView = (product) => {
    handleEdit(product);
    setIsLocked(true);
  };


  // ── Draw tab classification ──────────────────────────────────────────────
  const now = new Date();

  const isPastDraw = (p) =>
    p.campaign_id && p.has_winner === 1;


  const isReadyForDraw = (p) =>
    p.campaign_id &&
    !isPastDraw(p) &&
    (
      (p.tickets_remaining !== null && p.tickets_remaining !== undefined && p.tickets_remaining <= 0) ||
      (p.prize_end_date && new Date(p.prize_end_date) <= now) ||
      (p.draw_date      && new Date(p.draw_date)      <= now)   // ← draw date has passed
    );

  const isActiveDraw = (p) =>
    p.campaign_id &&
    !isPastDraw(p) &&
    !isReadyForDraw(p) &&
    p.tickets_remaining > 0 &&
    (!p.draw_date || new Date(p.draw_date) > now);   // ← future draw date only


  const tabCounts = {
    all:      products.length,
    active:   products.filter(isActiveDraw).length,
    upcoming: products.filter(isReadyForDraw).length,
    past:     products.filter(isPastDraw).length,
  };

  const filteredProducts = products
    .filter(product => {
      if (drawTab === 'active')   return isActiveDraw(product);
      if (drawTab === 'upcoming') return isReadyForDraw(product);
      if (drawTab === 'past')     return isPastDraw(product);
      return true; // 'all'
    })
    .filter(product =>
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <Layout>
      <div className="products-container">
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}

        <div className="products-header">
          <div className="products-header-left">
            <Package size={32} />
            <div>
              <h1>Products</h1>
              <p>Manage your product catalog</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={20} />
            Add Product
          </button>
        </div>

        {/* ── Draw Status Tabs ── */}
        <div className="products-draw-tabs">
          <button
            className={`products-draw-tab ${drawTab === 'all' ? 'active' : ''}`}
            onClick={() => setDrawTab('all')}
          >
            <LayoutGrid size={15} /> All Products
            <span className="tab-count">{tabCounts.all}</span>
          </button>
          <button
            className={`products-draw-tab ${drawTab === 'active' ? 'active' : ''}`}
            onClick={() => setDrawTab('active')}
          >
            <Zap size={15} /> Active Draw
            <span className="tab-count tab-count-active">{tabCounts.active}</span>
          </button>
          <button
            className={`products-draw-tab ${drawTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setDrawTab('upcoming')}
          >
            <Clock size={15} /> Ready for Draw
            <span className="tab-count tab-count-upcoming">{tabCounts.upcoming}</span>
          </button>
          <button
            className={`products-draw-tab ${drawTab === 'past' ? 'active' : ''}`}
            onClick={() => setDrawTab('past')}
          >
            <Trophy size={15} /> Past Draws
            <span className="tab-count tab-count-past">{tabCounts.past}</span>
          </button>
        </div>

        <div className="products-filters">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="products-table-container">
          {loading && products.length === 0 ? (
            <div className="loading-spinner">Loading...</div>
          ) : (
            <table className="products-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Price</th>
                  {/* Past Draws: replace Stock+Status with Winner column */}
                  {drawTab === 'past' ? (
                    <th colSpan={2}>🏆 Winner</th>
                  ) : (
                    <>
                      <th>{drawTab === 'active' ? 'Tickets' : 'Stock'}</th>
                      <th>Status</th>
                    </>
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => {
                  const sold = (product.tickets_required ?? 0) - (product.tickets_remaining ?? 0);
                  const pct  = product.tickets_required > 0
                    ? Math.min(100, Math.round((sold / product.tickets_required) * 100))
                    : 0;
                  const wonDate = product.winner_won_at
                    ? new Date(product.winner_won_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : null;

                  return (
                    <tr key={product.id} className={product.has_winner === 1 ? 'row-past-draw' : ''}>
                      <td>
                        {product.main_image_url ? (
                          <img src={getImageUrl(product.main_image_url)} alt={product.name} className="product-image" />
                        ) : (
                          <div className="product-image-placeholder">
                            <Package size={20} />
                          </div>
                        )}
                      </td>

                      {/* Name + prize badges */}
                      <td className="product-name">
                        {product.name}
                        {product.campaign_id && drawTab !== 'past' && (
                          <div className="product-status-alerts">
                            {product.tickets_remaining !== null && product.tickets_remaining !== undefined && product.tickets_remaining <= 0 && (
                              <span className="tag-badge tag-sold-out">SOLD OUT</span>
                            )}
                            {product.prize_end_date ? (
                              <span className={`tag-badge ${new Date(product.prize_end_date) <= new Date() ? 'tag-ended' : 'tag-ending'}`}>
                                🗓 {new Date(product.prize_end_date) <= new Date() ? 'Ended' : 'Ends'} {new Date(product.prize_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            ) : (
                              <span className="tag-badge tag-no-date">No End Date</span>
                            )}
                            {product.draw_date ? (
                              <span className="tag-badge tag-draw-set">
                                🎯 Draw: {new Date(product.draw_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <span className="tag-badge tag-no-draw">No Draw Date</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td>{product.sku || '-'}</td>

                      <td>
                        {product.sale_price ? (
                          <div className="price-display">
                            <span className="sale-price">${product.sale_price}</span>
                            <span className="original-price">${product.price}</span>
                          </div>
                        ) : (
                          <span>${product.price}</span>
                        )}
                      </td>

                      {/* ── Past Draws: winner cell ── */}
                      {drawTab === 'past' ? (
                        <td colSpan={2} className="winner-cell">
                          {product.winner_name ? (
                            <div className="winner-cell-inner">
                              <div className="winner-cell-avatar">
                                {product.winner_name[0]?.toUpperCase()}
                              </div>
                              <div className="winner-cell-info">
                                <span className="winner-cell-name">{product.winner_name}</span>
                                <span className="winner-cell-ticket">
                                  <Ticket size={12} /> {product.winner_ticket}
                                </span>
                                {wonDate && <span className="winner-cell-date">Won {wonDate}</span>}
                              </div>
                            </div>
                          ) : (
                            <span className="tag-badge tag-no-date">—</span>
                          )}
                        </td>
                      ) : (
                        <>
                          {/* ── Active: ticket progress bar ── */}
                          {drawTab === 'active' ? (
                            <td className="tickets-progress-cell">
                              <div className="tickets-progress-wrap">
                                <div className="tickets-progress-labels">
                                  <span>{sold}/{product.tickets_required}</span>
                                  <span className="tickets-pct">{pct}%</span>
                                </div>
                                <div className="tickets-progress-bar">
                                  <div className="tickets-progress-fill" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                          ) : (
                            <td>
                              <span className={`stock-badge ${product.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                {product.stock_quantity}
                              </span>
                            </td>
                          )}
                          <td>
                            <span className={`status-badge status-${product.status}`}>
                              {product.status}
                            </span>
                          </td>
                        </>
                      )}

                      <td className="actions">
                        {isPastDraw(product) || isReadyForDraw(product) ? (
                          // Locked: draw completed or draw date passed
                          <button
                            className="btn-icon btn-icon-locked"
                            onClick={() => handleView(product)}
                            title={isPastDraw(product) ? 'Draw completed — view only' : 'Draw date passed — view only'}
                          >
                            <Lock size={16} />
                          </button>
                        ) : (
                          <button className="btn-icon" onClick={() => { setIsLocked(false); handleEdit(product); }}>
                            <Edit size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Product Modal */}
        <ProductModal
          show={showModal}
          onClose={() => { setShowModal(false); setIsLocked(false); }}
          onSubmit={handleSubmit}
          formData={formData}
          onInputChange={handleInputChange}
          existingImages={existingImages}
          imagePreviews={imagePreviews}
          selectedImages={selectedImages}
          onImageChange={handleImageChange}
          onRemoveExistingImage={removeExistingImage}
          onRemoveNewImage={removeNewImage}
          loading={loading}
          isEditing={!!editingProduct}
          isLocked={isLocked}
          onDelete={() => handleDelete(editingProduct?.id)}
          onAddColor={handleAddColor}
          onRemoveColor={handleRemoveColor}
          onAddSize={handleAddSize}
          onRemoveSize={handleRemoveSize}
          campaigns={campaigns}
          allProducts={products}
          editingProductId={editingProduct?.id || null}
        />
      </div>
    </Layout>
  );
};

export default Products;
