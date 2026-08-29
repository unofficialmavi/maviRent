const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Auto-update overdue records in Supabase
    await supabase.rpc('update_overdue_rent_status');

    return res.status(200).json({ success: true, message: 'Automated rent statuses updated.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
