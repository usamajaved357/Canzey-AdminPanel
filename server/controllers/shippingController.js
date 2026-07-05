import { zmcCargoService } from '../services/zmcCargoService.js';
import db from '../database/connection.js';

export const getCities = async (req, res) => {
  try {
    const cities = await zmcCargoService.getCities();
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRegions = async (req, res) => {
  try {
    const { cityId } = req.params;
    const regions = await zmcCargoService.getRegions(cityId);
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createShipment = async (req, res) => {
  const { orderId, shippingData } = req.body;
  
  try {
    // Add reference number from our system
    shippingData.referenceNo = orderId.toString();

    const result = await zmcCargoService.bookLocalShipment(shippingData);
    
    // ZMC returns status "200" string on success
    if (result && result.status === '200') {
      const trackId = result.data.ZMC_ReferenceNo;
      
      // Update order in database
      await db.execute(
        `UPDATE orders SET 
         shipping_track_id = ?, 
         shipping_company = 'ZMC Cargo', 
         shipping_status = 'Pending',
         order_status = 'shipped'
         WHERE id = ?`,
        [trackId, orderId]
      );

      // ZMC does not provide an explicit label URL/download in this spec out-of-the-box,
      // so we will skip downloading the local PDF for now.

      res.json({ 
        success: true, 
        message: 'Shipment created successfully!', 
        trackId 
      });
    } else {
      res.status(400).json({ success: false, message: result.message || 'Failed to create shipment' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getShipmentStatus = async (req, res) => {
  try {
    const { trackId } = req.params;
    const statusResult = await zmcCargoService.getShipmentStatus(trackId);
    
    if (statusResult && statusResult.status === '200') {
      const currentStatus = statusResult.data.Current_Status || 'Pending';
      // Update our database status
      await db.execute(
        `UPDATE orders SET shipping_status = ? WHERE shipping_track_id = ?`,
        [currentStatus, trackId]
      );
      
      res.json({ success: true, data: { status_name: currentStatus } });
    } else {
       res.json({ success: false, message: 'Could not fetch status' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testConnection = async (req, res) => {
  try {
    const result = await zmcCargoService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testBookShipment = async (req, res) => {
  const { shippingData } = req.body;
  
  try {
    // Generate a dummy reference number for testing
    shippingData.referenceNo = `TEST-${Date.now()}`;

    const result = await zmcCargoService.bookLocalShipment(shippingData);
    
    // LOG EXACT RESPONSE FROM ZMC
    console.log('\n--- ZMC API RAW RESPONSE ---');
    console.log(result);
    console.log('----------------------------\n');
    
    // ZMC returns status "200" string on success
    if (result && result.status === '200') {
      const trackId = result.data.ZMC_ReferenceNo;
      res.json({ 
        success: true, 
        message: 'Test shipment created successfully!', 
        trackId 
      });
    } else {
      // Return the exact error message from ZMC API to frontend
      const exactError = result.message || JSON.stringify(result) || 'Failed to create test shipment';
      res.status(400).json({ success: false, message: exactError });
    }
  } catch (error) {
    console.error('ZMC Fetch Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const downloadLabel = async (req, res) => {
  const { trackId } = req.params;
  try {
    const result = await zmcCargoService.downloadLabel(trackId);
    if (result.success && result.pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ZMC-Label-${trackId}.pdf`);
      return res.send(Buffer.from(result.pdfBuffer));
    }
    return res.status(404).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
