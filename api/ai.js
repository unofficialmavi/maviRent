// MavRent GPT + Supabase bridge
// V1: read-only AI assistant.
// IMPORTANT: OPENAI_API_KEY is a Vercel Environment Variable. Never put it in index.html.

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

// Supabase URL and publishable/anon key are safe to use for authenticated
// browser-style requests. The user's JWT + Supabase RLS still control access.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://wborvbuqdiscoasnsrwa.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_1mthstK0eNmIFL1PHmBDLg_-5YJYScn';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

function cleanRow(row) {
  if (!row || typeof row !== 'object') return row;
  const blocked = new Set([
    'password',
    'password_hash',
    'service_role_key',
    'access_token',
    'refresh_token',
    'encrypted_password'
  ]);
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (blocked.has(k.toLowerCase())) continue;
    if (typeof v === 'string' && v.length > 4000) out[k] = v.slice(0, 4000) + '…';
    else out[k] = v;
  }
  return out;
}

async function supabaseGet(table, query, token) {
  const base = SUPABASE_URL.replace(/\/$/, '');
  const anon = SUPABASE_ANON_KEY;

  const url = new URL(base + '/rest/v1/' + table);
  url.searchParams.set('select', '*');
  url.searchParams.set('limit', '100');

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const r = await fetch(url, {
    headers: {
      apikey: anon,
      Authorization: 'Bearer ' + token,
      Accept: 'application/json'
    }
  });

  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!r.ok) {
    throw new Error('Supabase ' + table + ' query failed: ' + (data?.message || data?.hint || r.status));
  }

  return Array.isArray(data) ? data.map(cleanRow) : data;
}

async function getAuthenticatedUser(token) {
  const base = SUPABASE_URL.replace(/\/$/, '');
  const anon = SUPABASE_ANON_KEY;

  const r = await fetch(base + '/auth/v1/user', {
    headers: {
      apikey: anon,
      Authorization: 'Bearer ' + token
    }
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.id) throw new Error('Your MavRent session is not valid. Please log in again.');
  return data;
}

async function getMavRentContext(token, userId) {
  const profileRows = await supabaseGet('profiles', { id: 'eq.' + userId }, token);
  const profile = Array.isArray(profileRows) ? profileRows[0] : null;
  const role = profile?.role || 'unknown';

  // These reads are protected by the user's Supabase JWT + RLS.
  // We deliberately do not use the service-role key here.
  const names = [
    'properties',
    'units',
    'tenants',
    'rent_records',
    'payments',
    'maintenance_requests',
    'expenses',
    'receipts'
  ];

  const context = {
    current_user: {
      id: userId,
      role,
      full_name: profile?.full_name || null,
      phone: profile?.phone || null
    },
    data: {}
  };

  for (const name of names) {
    try {
      context.data[name] = await supabaseGet(name, null, token);
    } catch (e) {
      // A missing table/permission should not crash the whole assistant.
      context.data[name] = { unavailable: true, reason: e.message };
    }
  }

  return context;
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part?.type === 'output_text' && part.text) chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'POST only' });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return json(res, 500, {
        error: 'OPENAI_API_KEY is not configured on Vercel.'
      });
    }

    const auth = req.headers.authorization || '';
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return json(res, 401, { error: 'You must be logged in to use MavRent AI.' });
    }

    const token = auth.slice(7).trim();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || '').trim();

    if (!message) return json(res, 400, { error: 'Enter a question first.' });
    if (message.length > 4000) return json(res, 400, { error: 'Question is too long.' });

    const me = await getAuthenticatedUser(token);
    const context = await getMavRentContext(token, me.id);

    const system = [
      'You are MavRent AI, the read-only rental management assistant.',
      'Answer using ONLY the supplied MavRent data and general knowledge that does not invent account facts.',
      'Never invent tenants, payments, balances, dates, properties, receipts, or maintenance records.',
      'If the data is missing or unavailable, say so clearly.',
      'Respect the logged-in user role and never reveal data that is not present in the supplied context.',
      'Do not provide passwords, access tokens, service keys, or secrets.',
      'For financial figures, use UGX and show the arithmetic when useful.',
      'Keep answers concise and practical. If asked for a list, use bullets or a small table.',
      'This first version is READ-ONLY. Do not claim that you changed, deleted, confirmed, paid, or sent anything.'
    ].join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              'MavRent account context (JSON):\n' +
              JSON.stringify(context) +
              '\n\nUser question:\n' + message
          }
        ],
        max_output_tokens: 1200
      })
    });

    const data = await openaiResponse.json().catch(() => null);

    if (!openaiResponse.ok) {
      return json(res, openaiResponse.status, {
        error: data?.error?.message || 'OpenAI request failed.'
      });
    }

    const answer = extractOutputText(data);
    if (!answer) return json(res, 502, { error: 'GPT returned an empty answer.' });

    return json(res, 200, {
      answer,
      model: OPENAI_MODEL,
      role: context.current_user.role
    });
  } catch (error) {
    console.error('MavRent AI error:', error);
    return json(res, 500, {
      error: error?.message || 'MavRent AI failed.'
    });
  }
}
