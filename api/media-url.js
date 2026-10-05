const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wborvbuqdiscoasnsrwa.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_1mthstK0eNmIFL1PHmBDLg_-5YJYScn';
const MEDIA_BUCKET = 'maintenance-media';

async function authUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? u : null;
  } catch {
    return null;
  }
}

async function sbAdminQuery(path) {
  const r = await fetch(SUPABASE_URL + path, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      Accept: 'application/json'
    }
  });
  if (!r.ok) return [];
  try { return await r.json(); } catch { return []; }
}

function extractStoragePath(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim();
  // If it's a full URL:
  // e.g. https://.../storage/v1/object/public/maintenance-media/USER_ID/FILE.jpg
  // or /maintenance-media/USER_ID/FILE.jpg
  const marker = '/' + MEDIA_BUCKET + '/';
  const idx = str.indexOf(marker);
  if (idx !== -1) {
    str = str.slice(idx + marker.length);
  }
  // Strip query parameters
  const qIdx = str.indexOf('?');
  if (qIdx !== -1) str = str.slice(0, qIdx);
  return decodeURIComponent(str).replace(/^\/+/, '');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!SERVICE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.query.token || '';
    const user = await authUser(token);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required to access private media.' });
    }

    const rawMedia = (req.body && req.body.media) || req.query.media || req.query.path || (req.body && req.body.path) || '';
    const storagePath = extractStoragePath(rawMedia);

    if (!storagePath) {
      return res.status(400).json({ error: 'Missing or invalid media path.' });
    }

    // Authorization verification
    // 1. Check user profile role
    const profiles = await sbAdminQuery('/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=id,role');
    const profile = profiles[0] || { role: 'unknown' };

    let authorized = false;

    // Direct owner check: user uploaded it under their own folder
    if (storagePath.startsWith(user.id + '/')) {
      authorized = true;
    }

    // If not direct owner, check maintenance request associations
    if (!authorized) {
      // Find maintenance request matching this media_url or containing this path
      const requests = await sbAdminQuery(
        '/rest/v1/maintenance_requests?media_url=like.*' + encodeURIComponent(encodeURIComponent(storagePath.split('/').pop() || storagePath)) + '*&select=id,landlord_id,tenant_id'
      );

      for (const req of requests) {
        if (profile.role === 'landlord' && req.landlord_id === user.id) {
          authorized = true;
          break;
        }
        if (profile.role === 'tenant') {
          // Check if tenant's profile is linked
          const tenantRows = await sbAdminQuery('/rest/v1/tenants?id=eq.' + encodeURIComponent(req.tenant_id) + '&select=profile_id');
          if (tenantRows[0] && tenantRows[0].profile_id === user.id) {
            authorized = true;
            break;
          }
        }
      }

      // If landlord, also check if landlord owns properties for the tenant who owns this folder
      if (!authorized && profile.role === 'landlord') {
        const uploaderId = storagePath.split('/')[0];
        if (uploaderId) {
          // Check if this uploader is a tenant assigned to any of this landlord's units
          const landlordTenants = await sbAdminQuery(
            '/rest/v1/tenants?landlord_id=eq.' + encodeURIComponent(user.id) + '&profile_id=eq.' + encodeURIComponent(uploaderId) + '&select=id'
          );
          if (landlordTenants.length > 0) {
            authorized = true;
          }
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'You are not authorized to view this private media file.' });
    }

    // Generate secure temporary signed URL using Supabase Admin Client
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false }
    });

    const expiresIn = 3600; // 1 hour validity
    const { data, error } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      console.error('Storage createSignedUrl error:', error);
      return res.status(404).json({ error: 'Media file could not be found or signed.' });
    }

    if (req.method === 'GET' && req.query.redirect === 'true') {
      return res.redirect(data.signedUrl);
    }

    return res.status(200).json({
      ok: true,
      signed_url: data.signedUrl,
      expires_in: expiresIn
    });
  } catch (err) {
    console.error('Media URL handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
