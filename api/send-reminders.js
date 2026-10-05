const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    const url = (process.env.SUPABASE_URL || 'https://wborvbuqdiscoasnsrwa.supabase.co').replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    if (!key) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' });
    const supabase = createClient(url, key);
    
    // Auto-update overdue records in Supabase
    await supabase.rpc('update_overdue_rent_status');

    return res.status(200).json({ success: true, message: 'Automated rent statuses updated.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
