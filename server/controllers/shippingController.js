import { alWaseetService } from '../services/alWaseetService.js';
import db from '../config/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getCities = async (req, res) => {
  try {
    const cities = await alWaseetService.getCities();
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRegions = async (req, res) => {
  try {
    const { cityId } = req.params;
    const regions = await alWaseetService.getRegions(cityId);
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createShipment = async (req, res) => {
  const { orderId, shippingData } = req.body;
  
  try {
    const result = await alWaseetService.createOrder(shippingData);
    
    if (result.status === true) {
      const trackId = result.data.order_id;
      
      // Update order in database
      await db.execute(
        `UPDATE orders SET 
         shipping_track_id = ?, 
         shipping_company = 'Al-Waseet', 
         shipping_status = 'Pending',
         order_status = 'shipped'
         WHERE id = ?`,
        [trackId, orderId]
      );

      // ASYNC TASK: Download label and save locally
      try {
        const labelBuffer = await alWaseetService.downloadLabel(trackId);
        const labelsDir = path.join(__dirname, '../public/labels');
        
        // Ensure directory exists
        await fs.mkdir(labelsDir, { recursive: true });
        
        const fileName = `label_${trackId}.pdf`;
        const filePath = path.join(labelsDir, fileName);
        await fs.writeFile(filePath, labelBuffer);
        
        // Update database with label URL
        const labelUrl = `/labels/${fileName}`;
        await db.execute(
          `UPDATE orders SET shipping_label_url = ? WHERE id = ?`,
          [labelUrl, orderId]
        );
      } catch (labelError) {
        console.error('Failed to save label locally:', labelError);
      }

      res.json({ 
        success: true, 
        message: 'Shipment created and label saved!', 
        trackId 
      });
    } else {
      res.status(400).json({ success: false, message: result.msg || 'Failed to create shipment' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getShipmentStatus = async (req, res) => {
  try {
    const { trackId } = req.params;
    const status = await alWaseetService.trackOrder(trackId);
    
    if (status) {
      // Update our database status
      await db.execute(
        `UPDATE orders SET shipping_status = ? WHERE shipping_track_id = ?`,
        [status.status_name, trackId]
      );
    }
    
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
