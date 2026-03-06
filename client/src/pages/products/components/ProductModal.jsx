import React, { useState } from 'react';
import { X, Package, Trash2, Trophy, ChevronDown } from 'lucide-react';
import { getImageUrl } from '../../../config/api';
import './ProductModal.css';

// Predefined options
const PREDEFINED_COLORS = [
  { name: 'Black', code: '#000000' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Red', code: '#EF4444' },
  { name: 'Blue', code: '#3B82F6' },
  { name: 'Navy', code: '#1E3A5F' },
  { name: 'Green', code: '#22C55E' },
  { name: 'Yellow', code: '#EAB308' },
  { name: 'Orange', code: '#F97316' },
  { name: 'Pink', code: '#EC4899' },
  { name: 'Purple', code: '#A855F7' },
  { name: 'Gray', code: '#6B7280' },
  { name: 'Brown', code: '#92400E' },
  { name: 'Beige', code: '#D4A574' },
  { name: 'Maroon', code: '#7F1D1D' },
  { name: 'Teal', code: '#14B8A6' },
];

const PREDEFINED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

const PREDEFINED_TAGS = [
  'New Arrival',
  'Summer',
  'Winter',
  'Spring',
  'Fall',
  'Best Seller',
  'Trending',
  'Sale',
  'Limited Edition',
  'Exclusive',
];

const ProductModal = ({
  show,
  onClose,
  onSubmit,
  formData,
  onInputChange,
  existingImages,
  imagePreviews,
  selectedImages,
  onImageChange,
  onRemoveExistingImage,
  onRemoveNewImage,
  loading,
  isEditing,
  isLocked = false,   // ← read-only mode for past/completed draws
  onDelete,
  onAddColor,
  onRemoveColor,
  onAddSize,
  onRemoveSize,
  campaigns = [],
  allProducts = [],       // ← full products list to detect taken prizes
  editingProductId = null // ← id of product being edited (null when creating)
}) => {
  const [newColorName, setNewColorName] = useState('');
  const [newColorCode, setNewColorCode] = useState('#000000');
  const [newSize, setNewSize] = useState('');
  const [showPrizeDropdown, setShowPrizeDropdown] = useState(false);

  // Compute set of campaign IDs already linked to OTHER products
  // (exclude the product currently being edited so it can keep/change its own prize)
  const takenCampaignIds = new Set(
    allProducts
      .filter(p => p.campaign_id && p.id !== editingProductId)
      .map(p => p.campaign_id)
  );

  // Filter campaigns: hide taken ones from the dropdown (unless it's the currently selected one)
  const availableCampaigns = campaigns.filter(
    c => c.status === 'active' && !takenCampaignIds.has(c.id)
  );

  // Get selected prize details
  const getSelectedPrize = () => {
    if (!formData.campaign_id) return null;
    return campaigns.find(c => c.id === parseInt(formData.campaign_id));
  };

  const handlePrizeSelect = (campaignId) => {
    onInputChange({ target: { name: 'campaign_id', value: campaignId } });
    setShowPrizeDropdown(false);
  };

  // Check if color is already added
  const isColorAdded = (colorName) => {
    return formData.colors?.some(c => c.name === colorName);
  };

  // Check if size is already added
  const isSizeAdded = (size) => {
    return formData.sizes?.some(s => (typeof s === 'string' ? s : s.size) === size);
  };

  // Get current tags as array
  const getCurrentTags = () => {
    if (!formData.tags) return [];
    if (Array.isArray(formData.tags)) return formData.tags;
    return formData.tags.split(',').map(t => t.trim()).filter(t => t);
  };

  // Check if tag is already added
  const isTagAdded = (tag) => {
    return getCurrentTags().includes(tag);
  };

  // Toggle tag
  const toggleTag = (tag) => {
    const currentTags = getCurrentTags();
    let newTags;
    if (currentTags.includes(tag)) {
      newTags = currentTags.filter(t => t !== tag);
    } else {
      newTags = [...currentTags, tag];
    }
    onInputChange({
      target: { name: 'tags', value: newTags.join(',') }
    });
  };

  // Toggle predefined color (add or remove)
  const togglePredefinedColor = (color) => {
    const index = formData.colors?.findIndex(c => c.name === color.name);
    if (index >= 0) {
      onRemoveColor(index);
    } else {
      onAddColor({ name: color.name, code: color.code, stock_quantity: 0 });
    }
  };

  // Toggle predefined size (add or remove)
  const togglePredefinedSize = (size) => {
    const index = formData.sizes?.findIndex(s => (typeof s === 'string' ? s : s.size) === size);
    if (index >= 0) {
      onRemoveSize(index);
    } else {
      onAddSize({ size: size, stock_quantity: 0 });
    }
  };

  const handleAddColorClick = () => {
    if (newColorName && newColorCode) {
      onAddColor({ name: newColorName, code: newColorCode });
      setNewColorName('');
      setNewColorCode('#000000');
    }
  };

  const handleAddSizeClick = () => {
    if (newSize) {
      onAddSize(newSize);
      setNewSize('');
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {isLocked ? (
              <>🔒 View Product <span style={{fontSize:'0.75rem',fontWeight:500,color:'#92400e',background:'#fef3c7',padding:'2px 8px',borderRadius:'0.4rem',verticalAlign:'middle'}}>Draw Completed — Read Only</span></>
            ) : (
              isEditing ? 'Edit Product' : 'Create Product'
            )}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* 🔒 Locked banner */}
        {isLocked && (
          <div style={{
            background: '#fef3c7',
            borderBottom: '1px solid #fde68a',
            padding: '0.6rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: '#92400e',
            fontWeight: 600
          }}>
            🔒 This draw has been completed or its date has passed. Editing and deletion are disabled.
          </div>
        )}

        <form onSubmit={isLocked ? (e) => e.preventDefault() : onSubmit} className="modal-body">
          <div className="form-group">
            <label>Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={onInputChange}
              required
              disabled={isLocked}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>SKU</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={onInputChange}
                disabled={isLocked}
              />
            </div>

            <div className="form-group">
              <label>Slug</label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={onInputChange}
                disabled={isLocked}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={onInputChange}
              rows="3"
              disabled={isLocked}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Price *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={onInputChange}
                step="0.01"
                required
                disabled={isLocked}
              />
            </div>

            <div className="form-group">
              <label>Sale Price</label>
              <input
                type="number"
                name="sale_price"
                value={formData.sale_price}
                onChange={onInputChange}
                step="0.01"
                disabled={isLocked}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Stock Quantity</label>
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={onInputChange}
                disabled={isLocked}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={onInputChange}
                disabled={isLocked}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              name="category"
              value={formData.category || ''}
              onChange={onInputChange}
              disabled={isLocked}
            >
              <option value="">Select Category</option>
              <option value="Electronics">Electronics</option>
              <option value="Clothing">Clothing</option>
              <option value="Home & Garden">Home & Garden</option>
              <option value="Sports & Outdoors">Sports & Outdoors</option>
              <option value="Books">Books</option>
              <option value="Toys & Games">Toys & Games</option>
              <option value="Health & Beauty">Health & Beauty</option>
              <option value="Food & Beverages">Food & Beverages</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Sub-Category</label>
            <select
              name="sub_category"
              value={formData.sub_category || ''}
              onChange={onInputChange}
              disabled={isLocked}
            >
              <option value="">Select Sub-Category</option>
              <optgroup label="Clothing">
                <option value="T-Shirts">T-Shirts</option>
                <option value="Shirts">Shirts</option>
                <option value="Jeans">Jeans</option>
                <option value="Trousers">Trousers</option>
                <option value="Dresses">Dresses</option>
                <option value="Skirts">Skirts</option>
                <option value="Jackets">Jackets</option>
                <option value="Sweaters">Sweaters</option>
                <option value="Shoes">Shoes</option>
                <option value="Accessories">Accessories</option>
              </optgroup>
              <optgroup label="Electronics">
                <option value="Smartphones">Smartphones</option>
                <option value="Laptops">Laptops</option>
                <option value="Tablets">Tablets</option>
                <option value="Headphones">Headphones</option>
                <option value="Cameras">Cameras</option>
                <option value="Smart Watches">Smart Watches</option>
              </optgroup>
              <optgroup label="Home & Garden">
                <option value="Furniture">Furniture</option>
                <option value="Decor">Decor</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Bedding">Bedding</option>
                <option value="Garden Tools">Garden Tools</option>
              </optgroup>
              <optgroup label="Sports">
                <option value="Gym Equipment">Gym Equipment</option>
                <option value="Outdoor Gear">Outdoor Gear</option>
                <option value="Sports Apparel">Sports Apparel</option>
              </optgroup>
              <optgroup label="Other">
                <option value="Books">Books</option>
                <option value="Toys">Toys</option>
                <option value="Beauty">Beauty</option>
                <option value="Food">Food</option>
                <option value="Other">Other</option>
              </optgroup>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>For</label>
              <select
                name="for_gender"
                value={formData.for_gender || ''}
                onChange={onInputChange}
                disabled={isLocked}
              >
                <option value="">Select</option>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
                <option value="Kids">Kids</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>

            <div className="form-group">
              <label>Customization</label>
              <button
                type="button"
                className={`option-btn customization-btn ${formData.is_customized ? 'selected' : ''}`}
                onClick={() => !isLocked && onInputChange({
                  target: {
                    name: 'is_customized',
                    value: !formData.is_customized
                  }
                })}
                disabled={isLocked}
              >
                {formData.is_customized ? '✓ Customizable' : 'Not Customizable'}
              </button>
            </div>
            </div>

          {/* Link to Prize Section */}
          <div className="form-group">
            <label>Link to Prize</label>
            <div className="prize-selector">
              {/* Selected Prize Display */}
              <div 
                className={`prize-selector-trigger ${isLocked ? 'disabled-view' : ''}`}
                onClick={() => !isLocked && setShowPrizeDropdown(!showPrizeDropdown)}
              >
                {getSelectedPrize() ? (
                  <div className="prize-selected">
                    {getSelectedPrize().image_url ? (
                      <img 
                        src={getImageUrl(getSelectedPrize().image_url)} 
                        alt={getSelectedPrize().title}
                        className="prize-thumb"
                      />
                    ) : (
                      <div className="prize-thumb-placeholder">
                        <Trophy size={16} />
                      </div>
                    )}
                    <span className="prize-name">{getSelectedPrize().title}</span>
                  </div>
                ) : (
                  <div className="prize-placeholder">
                    <Trophy size={16} />
                    <span>Select a Prize (Optional)</span>
                  </div>
                )}
                <ChevronDown size={18} className={`prize-chevron ${showPrizeDropdown ? 'open' : ''}`} />
              </div>

              {/* Dropdown Options */}
              {showPrizeDropdown && (
                <div className="prize-dropdown">
                  {/* No Prize Option */}
                  <div 
                    className={`prize-option ${!formData.campaign_id ? 'selected' : ''}`}
                    onClick={() => handlePrizeSelect('')}
                  >
                    <div className="prize-thumb-placeholder">
                      <X size={16} />
                    </div>
                    <span>No Prize (Not linked)</span>
                  </div>

              {/* All Active Prizes — taken ones are shown but disabled with a badge */}
                  {campaigns.filter(c => c.status === 'active').map((campaign) => {
                    const isTaken = takenCampaignIds.has(campaign.id);
                    return (
                      <div
                        key={campaign.id}
                        className={`prize-option ${formData.campaign_id == campaign.id ? 'selected' : ''} ${isTaken ? 'taken' : ''}`}
                        onClick={() => !isTaken && handlePrizeSelect(campaign.id)}
                        title={isTaken ? 'This prize is already linked to another product' : ''}
                      >
                        {campaign.image_url ? (
                          <img
                            src={getImageUrl(campaign.image_url)}
                            alt={campaign.title}
                            className="prize-thumb"
                          />
                        ) : (
                          <div className="prize-thumb-placeholder">
                            <Trophy size={16} />
                          </div>
                        )}
                        <div className="prize-option-info">
                          <span className="prize-option-title">{campaign.title}</span>
                          {/* <span className="prize-option-price">${campaign.ticket_price} per ticket</span> */}
                        </div>
                        {isTaken && (
                          <span className="prize-linked-badge">Already Linked</span>
                        )}
                      </div>
                    );
                  })}

                  {campaigns.filter(c => c.status === 'active').length === 0 && (
                    <div className="prize-no-options">No active prizes available</div>
                  )}
                </div>
              )}
            </div>
            <p className="form-hint">Link this product to a prize. One product can only be linked to one prize.</p>
          </div>

          {/* Ticket Configuration Section */}
          {formData.campaign_id && (
            <div className="form-group">
              <label>Ticket Configuration</label>
              <div className="ticket-config-grid">
                <div className="ticket-input-group">
                  <label htmlFor="tickets_required">Total Tickets Required</label>
                  <input
                    type="number"
                    id="tickets_required"
                    name="tickets_required"
                    value={formData.tickets_required || ''}
                    onChange={onInputChange}
                    placeholder="e.g., 1000"
                    min="1"
                    className="ticket-input"
                    disabled={isLocked}
                  />
                  <small>Total tickets needed to win this prize</small>
                </div>
                <div className="ticket-input-group">
                  <label htmlFor="countdown_start_tickets">Countdown Starts After</label>
                  <input
                    type="number"
                    id="countdown_start_tickets"
                    name="countdown_start_tickets"
                    value={formData.countdown_start_tickets || ''}
                    onChange={onInputChange}
                    placeholder="e.g., 100"
                    min="0"
                    className="ticket-input"
                    disabled={isLocked}
                  />
                  <small>Show countdown after this many tickets sold</small>
                </div>
                <div className="ticket-input-group">
                  <label htmlFor="draw_date">Draw Date & Time (Fixed)</label>
                  <input
                    type="datetime-local"
                    id="draw_date"
                    name="draw_date"
                    value={formData.draw_date ? formData.draw_date.slice(0, 16) : ''}
                    onChange={onInputChange}
                    className="ticket-input"
                    disabled={isLocked}
                  />
                  <small>Empty = "Announced Shortly"</small>
                </div>
                <div className="ticket-input-group">
                  <label htmlFor="prize_end_date">🔴 Prize Ends On (Optional)</label>
                  <input
                    type="datetime-local"
                    id="prize_end_date"
                    name="prize_end_date"
                    value={formData.prize_end_date ? formData.prize_end_date.slice(0, 16) : ''}
                    onChange={onInputChange}
                    className="ticket-input"
                    disabled={isLocked}
                  />
                  <small>If set, this prize moves to "Ready for Draw" when this date passes — even if not sold out</small>
                </div>
              </div>
              <div className="ticket-preview">
                <div className="ticket-preview-info">
                  <span className="ticket-preview-label">Preview:</span>
                  <span className="ticket-preview-text">
                    {formData.tickets_required ? 
                      `${formData.tickets_required} tickets required` : 
                      'Set ticket count above'
                    }
                    {formData.countdown_start_tickets && formData.tickets_required && 
                      ` • Countdown starts after ${formData.countdown_start_tickets} tickets`
                    }
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tags Section */}
          <div className="form-group">
            <label>Tags</label>
            <div className="predefined-options">
              {PREDEFINED_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`option-btn tag-btn ${isTagAdded(tag) ? 'selected' : ''}`}
                  onClick={() => !isLocked && toggleTag(tag)}
                  disabled={isLocked}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Colors Section */}
          <div className="form-group">
            <label>Colors</label>
            <div className="predefined-options color-options">
              {PREDEFINED_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className={`option-btn color-btn ${isColorAdded(color.name) ? 'selected' : ''}`}
                  onClick={() => !isLocked && togglePredefinedColor(color)}
                  title={color.name}
                  disabled={isLocked}
                >
                  <span 
                    className="color-swatch" 
                    style={{ backgroundColor: color.code, border: color.code === '#FFFFFF' ? '1px solid #ccc' : 'none' }}
                  ></span>
                  <span className="color-name">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sizes Section */}
          <div className="form-group">
            <label>Sizes</label>
            <div className="predefined-options size-options">
              {PREDEFINED_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`option-btn size-btn ${isSizeAdded(size) ? 'selected' : ''}`}
                  onClick={() => !isLocked && togglePredefinedSize(size)}
                  disabled={isLocked}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Product Images (Max 10)</label>
            
            {/* Existing Images */}
            {existingImages.length > 0 && (
              <div className="existing-images">
                <p className="image-section-title">Existing Images</p>
                <div className="image-previews-grid">
                  {existingImages.map((imageUrl, index) => (
                    <div key={index} className="image-preview-item">
                      <img src={getImageUrl(imageUrl)} alt={`Existing ${index + 1}`} />
                      {!isLocked && (
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() => onRemoveExistingImage(index)}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="new-images">
                <p className="image-section-title">New Images</p>
                <div className="image-previews-grid">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="image-preview-item">
                      <img src={preview} alt={`Preview ${index + 1}`} />
                      {!isLocked && (
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() => onRemoveNewImage(index)}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Input */}
            <div className="file-input-wrapper">
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                multiple
                onChange={onImageChange}
                className="file-input"
                disabled={isLocked}
              />
              <label htmlFor="image-upload" className="file-input-label">
                <Package size={20} />
                Choose Images from PC
              </label>
              <p className="file-input-hint">
                You can select up to {10 - existingImages.length - selectedImages.length} more images
              </p>
            </div>
          </div>

          <div className="modal-footer">
            {/* Delete button — hidden when locked */}
            {isEditing && !isLocked && (
              <button 
                type="button" 
                className="btn btn-danger mr-auto" 
                onClick={onDelete}
                style={{ marginRight: 'auto', backgroundColor: '#ef4444', color: 'white' }}
              >
                <Trash2 size={18} />
                Delete Product
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {isLocked ? 'Close' : 'Cancel'}
            </button>
            {/* Save button — hidden when locked */}
            {!isLocked && (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (isEditing ? 'Update Product' : 'Create Product')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
