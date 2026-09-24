import pool from '../database/connection.js';

const DEFAULTS = {
  donate_enabled: '1',
};

const BOOLEAN_KEYS = new Set(['donate_enabled']);

function toBool(value) {
  return value === '1' || value === 1 || value === true || value === 'true';
}

function serialize(rows) {
  const values = { ...DEFAULTS };
  for (const row of rows) {
    values[row.setting_key] = row.setting_value;
  }
  return {
    donate_enabled: toBool(values.donate_enabled),
  };
}

async function readSettings(db = pool) {
  try {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM app_settings');
    return serialize(rows);
  } catch (err) {
    // Table missing (setup not run yet) — fall back to defaults instead of failing callers.
    console.error('⚠️ [SETTINGS] Could not read app_settings:', err.message);
    return serialize([]);
  }
}

export async function isDonateEnabled(db = pool) {
  const settings = await readSettings(db);
  return settings.donate_enabled;
}

/** Public (Flutter app): feature flags only. */
export async function getPublicSettings(_req, res) {
  const settings = await readSettings();
  res.json({ success: true, settings });
}

/** Admin: current settings. */
export async function getAdminSettings(_req, res) {
  const settings = await readSettings();
  res.json({ success: true, settings });
}

/** Admin: update one or more settings. */
export async function updateAdminSettings(req, res) {
  try {
    const updates = req.body || {};
    const entries = Object.entries(updates).filter(([key]) => key in DEFAULTS);

    if (entries.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid settings provided' });
    }

    for (const [key, raw] of entries) {
      const value = BOOLEAN_KEYS.has(key) ? (toBool(raw) ? '1' : '0') : String(raw);
      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, value]
      );
    }

    const settings = await readSettings();
    res.json({ success: true, message: 'Settings updated', settings });
  } catch (err) {
    console.error('❌ [SETTINGS] Update failed:', err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
}
