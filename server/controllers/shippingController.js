import { zmcCargoService, resolveZmcEnvironment } from '../services/zmcCargoService.js';
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
  const { orderId, shippingData, isTest } = req.body;
  
  try {
    const testMode = Boolean(isTest || shippingData?.isTest);
    shippingData.env = resolveZmcEnvironment(testMode ? 'sandbox' : shippingData?.env);
    shippingData.referenceNo = testMode
      ? `TEST-ORDER-${orderId}-${Date.now()}`
      : orderId.toString();

    const result = await zmcCargoService.bookLocalShipment(shippingData);
    
    if (result && result.status === '200') {
      const trackId = result.data.ZMC_ReferenceNo;
      const companyLabel = testMode ? 'ZMC Cargo (Test)' : 'ZMC Cargo';

      // Try to fetch label — mark shipped only when label is available
      let labelAvailable = false;
      try {
        const labelResult = await zmcCargoService.downloadLabel(trackId, 5, shippingData.env);
        labelAvailable = Boolean(labelResult.success && labelResult.pdfBuffer);
      } catch (labelErr) {
        console.warn('Label download failed after booking:', labelErr.message);
      }

      const orderStatus = labelAvailable ? 'shipped' : 'processing';
      const shippingStatus = labelAvailable ? 'Label Printed' : 'Pending';

      await db.execute(
        `UPDATE orders SET 
         shipping_track_id = ?, 
         shipping_company = ?, 
         shipping_status = ?,
         order_status = ?
         WHERE id = ?`,
        [trackId, companyLabel, shippingStatus, orderStatus, orderId]
      );

      res.json({ 
        success: true, 
        message: labelAvailable
          ? 'Shipment created and label ready — order marked as shipped.'
          : 'Shipment created. Label not ready yet — order stays processing until label prints.',
        trackId,
        labelAvailable,
        isTest: testMode,
        orderStatus,
        env: shippingData.env
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
    const env = resolveZmcEnvironment(req.query.env);
    const statusResult = await zmcCargoService.getShipmentStatus(trackId, env);
    
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
    const { env } = req.query;
    const result = await zmcCargoService.testConnection(env);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testBookShipment = async (req, res) => {
  const { shippingData } = req.body;
  
  try {
    shippingData.referenceNo = `TEST-${Date.now()}`;
    shippingData.env = resolveZmcEnvironment(shippingData.env);

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
  const { env, orderId } = req.query;
  try {
    const resolvedEnv = resolveZmcEnvironment(env);
    const result = await zmcCargoService.downloadLabel(trackId, 5, resolvedEnv);
    if (result.success && result.pdfBuffer) {
      // Mark order shipped when label is successfully retrieved
      if (orderId) {
        await db.execute(
          `UPDATE orders SET order_status = 'shipped', shipping_status = 'Label Printed' WHERE id = ?`,
          [orderId]
        );
      } else {
        await db.execute(
          `UPDATE orders SET order_status = 'shipped', shipping_status = 'Label Printed' WHERE shipping_track_id = ?`,
          [trackId]
        );
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ZMC-Label-${trackId}.pdf`);
      return res.send(Buffer.from(result.pdfBuffer));
    }
    return res.status(404).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
