// MavRent AI — FREE HYBRID VERSION
// Uses Supabase directly for common rental questions.
// Uses Google Gemini free-tier for natural-language questions.
// IMPORTANT: GEMINI_API_KEY must be stored only in Vercel Environment Variables.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

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
    'password','password_hash','service_role_key',
    'access_token','refresh_token','encrypted_password'
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
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token,
      Accept: 'application/json'
    }
  });

  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!r.ok) {
    throw new Error('Supabase ' + table + ' query failed: ' +
      (data?.message || data?.hint || r.status));
  }

  return Array.isArray(data) ? data.map(cleanRow) : data;
}

async function getAuthenticatedUser(token) {
  const base = SUPABASE_URL.replace(/\/$/, '');
  const r = await fetch(base + '/auth/v1/user', {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token
    }
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.id) {
    throw new Error('Your MavRent session is not valid. Please log in again.');
  }
  return data;
}

async function getMavRentContext(token, userId) {
  const profileRows = await supabaseGet('profiles', { id: 'eq.' + userId }, token);
  const profile = Array.isArray(profileRows) ? profileRows[0] : null;
  const role = profile?.role || 'unknown';

  // Keep the AI lightweight: fetch only data relevant to the logged-in role.
  // Supabase RLS remains the security boundary; this only reduces payload and latency.
  const names = role === 'tenant'
    ? ['properties','units','tenants','rent_records','payments','maintenance_requests','receipts']
    : ['properties','units','tenants','rent_records','payments','maintenance_requests','expenses','receipts'];

  const context = {
    current_user: {
      id: userId,
      role,
      full_name: profile?.full_name || null
    },
    data: {}
  };

  const results = await Promise.all(names.map(async name => {
    try {
      return [name, await supabaseGet(name, null, token)];
    } catch (e) {
      return [name, {unavailable:true, reason:e.message}];
    }
  }));
  for (const [name, value] of results) context.data[name] = value;

  return context;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rentBalance(row) {
  if (!row) return 0;

  if (row.balance !== undefined && row.balance !== null) {
    return Math.max(0, num(row.balance));
  }

  const rent = num(
    row.rent_amount ??
    row.amount_due ??
    row.expected_amount ??
    row.monthly_rent
  );

  const paid = num(
    row.paid_amount ??
    row.amount_paid ??
    row.paid
  );

  return Math.max(0, rent - paid);
}

function isPaid(row) {
  const status = String(row?.status || '').toLowerCase();
  if (['paid','completed','confirmed'].includes(status)) return true;
  return rentBalance(row) <= 0;
}

function isOverdueRecord(row) {
  if (!row || isPaid(row)) return false;

  const status = String(row.status || '').toLowerCase();
  if (status === 'overdue') return true;

  const due = row.due_date || row.dueDate;
  if (!due) return false;

  const dueTime = new Date(due).getTime();
  return Number.isFinite(dueTime) && dueTime < Date.now();
}

function findTenant(tenants, id) {
  return tenants.find(t => String(t.id) === String(id));
}

function findUnit(units, id) {
  return units.find(u => String(u.id) === String(id));
}

function findProperty(properties, id) {
  return properties.find(p => String(p.id) === String(id));
}

function money(n) {
  return 'UGX ' + Math.round(num(n)).toLocaleString('en-UG');
}

function answerDirectly(question, context) {
  const q = String(question).toLowerCase().trim();
  const d = context.data || {};
  const tenants = Array.isArray(d.tenants) ? d.tenants : [];
  const records = Array.isArray(d.rent_records) ? d.rent_records : [];
  const units = Array.isArray(d.units) ? d.units : [];
  const properties = Array.isArray(d.properties) ? d.properties : [];
  const maintenance = Array.isArray(d.maintenance_requests)
    ? d.maintenance_requests : [];

  // Tenant-first answers stay deterministic and never need Gemini.
  if (context.current_user?.role === 'tenant') {
    const myTenant = tenants.find(t =>
      String(t.profile_id || '') === String(context.current_user.id)
    ) || tenants[0];

    const myRecords = myTenant
      ? records.filter(r => String(r.tenant_id) === String(myTenant.id))
      : [];

    const myPayments = (Array.isArray(d.payments) ? d.payments : [])
      .filter(p => !myTenant || String(p.tenant_id) === String(myTenant.id));

    const myMaintenance = maintenance.filter(r =>
      !myTenant || String(r.tenant_id) === String(myTenant.id)
    );

    if (/\b(my|my current|my outstanding|my rent)\b/.test(q) &&
        /\b(balance|owe|outstanding|rent)\b/.test(q)) {
      const balance = myRecords.reduce((sum,r)=>sum+rentBalance(r),0);
      const next = myRecords
        .filter(r=>!isPaid(r))
        .sort((a,b)=>String(a.due_date||'').localeCompare(String(b.due_date||'')))[0];
      return '💰 Your current MavRent balance is ' + money(balance) +
        (next?.due_date ? '. Next outstanding due date: ' + next.due_date + '.' : '.');
    }

    if (/\b(when|what|date).*(rent|payment).*(due|deadline)|\bwhen is my rent due\b/.test(q)) {
      const next = myRecords
        .filter(r=>!isPaid(r))
        .sort((a,b)=>String(a.due_date||'').localeCompare(String(b.due_date||'')))[0];
      return next ? '📅 Your next outstanding rent is due on ' + (next.due_date||'a date not recorded') +
        ' and the balance is ' + money(rentBalance(next)) + '.' :
        '✅ I could not find an outstanding rent record for you.';
    }

    if (/\b(my|show my).*(payment|payments|payment history)\b/.test(q)) {
      if(!myPayments.length)return '💳 No payment records were found for your account.';
      const lines=myPayments.slice(0,30).map(p=>'• '+money(p.amount)+' — '+(p.payment_date||p.created_at||'date not recorded')+' — '+(p.status||'pending'));
      return '💳 Your recent payments:\n\n'+lines.join('\n');
    }

    if (/\b(my|show my).*(maintenance|repair|repairs)\b/.test(q)) {
      if(!myMaintenance.length)return '🔧 You have no maintenance requests in MavRent.';
      const lines=myMaintenance.slice(0,20).map(r=>'• '+(r.title||r.subject||'Maintenance')+' — '+(r.status||'pending')+(r.priority?' — '+r.priority:''));
      return '🔧 Your maintenance requests:\n\n'+lines.join('\n');
    }

    if (/\b(my|my latest|show my).*(receipt|receipts)\b/.test(q)) {
      const mine=(Array.isArray(d.receipts)?d.receipts:[]).filter(r=>{
        const p=myPayments.find(x=>String(x.id)===String(r.payment_id));
        return !!p;
      });
      if(!mine.length)return '🧾 No receipt has been issued for your payments yet.';
      const r=mine[0];
      return '🧾 Latest receipt: '+(r.receipt_number||'MavRent receipt')+
        (r.issued_at?' — issued '+new Date(r.issued_at).toLocaleDateString():'')+'.';
    }

    if (/\b(my|my)\s*(tenant code|code)\b/.test(q)) {
      return myTenant?.tenant_code
        ? '🔑 Your tenant code is '+myTenant.tenant_code+'.'
        : '🔑 I could not find a tenant code on your active MavRent assignment.';
    }
  }

  // This answer never calls an AI API.
  if (
    q.includes('who is overdue') ||
    q.includes('overdue tenants') ||
    q.includes('which tenants are overdue') ||
    q === 'overdue'
  ) {
    const overdue = records
      .filter(isOverdueRecord)
      .map(r => {
        const tenant =
          findTenant(tenants, r.tenant_id) ||
          findTenant(tenants, r.tenantId);

        const unit =
          findUnit(units, r.unit_id) ||
          findUnit(units, r.unitId);

        return {
          record: r,
          tenant,
          unit,
          balance: rentBalance(r)
        };
      })
      .filter(x => x.tenant || x.balance > 0);

    if (!overdue.length) {
      return '✅ No overdue rent records were found in the MavRent data.';
    }

    const total = overdue.reduce((sum, x) => sum + x.balance, 0);

    const lines = overdue.map(x => {
      const name =
        x.tenant?.full_name ||
        x.tenant?.name ||
        x.tenant?.tenant_name ||
        x.tenant?.email ||
        'Unknown tenant';

      const unit =
        x.unit?.unit_number ||
        x.unit?.name ||
        x.record.unit_number ||
        'Unit not specified';

      const period =
        x.record.period_month ||
        x.record.month ||
        x.record.due_date ||
        '';

      return '• ' + name +
        ' — ' + unit +
        ' — ' + money(x.balance) +
        (period ? ' — ' + period : '');
    });

    return '🔴 Overdue rent records: ' + overdue.length +
      '\n\n' + lines.join('\n') +
      '\n\nTotal overdue: ' + money(total);
  }

  if (
    q.includes('how much') &&
    (q.includes('outstanding') || q.includes('owed') || q.includes('unpaid'))
  ) {
    const outstanding = records
      .filter(r => !isPaid(r))
      .reduce((sum, r) => sum + rentBalance(r), 0);

    return '💰 Total outstanding rent in the available MavRent records: ' +
      money(outstanding) + '.';
  }

  if (
    q.includes('open maintenance') ||
    q.includes('pending maintenance') ||
    q.includes('maintenance requests')
  ) {
    const open = maintenance.filter(r => {
      const s = String(r.status || '').toLowerCase();
      return !['completed','resolved','cancelled','closed'].includes(s);
    });

    if (!open.length) return '✅ No open maintenance requests were found.';

    const lines = open.slice(0, 30).map(r =>
      '• ' +
      (r.title || r.subject || 'Maintenance request') +
      ' — ' +
      (r.status || 'pending') +
      (r.priority ? ' — ' + r.priority : '')
    );

    return '🔧 Open maintenance requests: ' +
      open.length + '\n\n' + lines.join('\n');
  }

  if (
    q.includes('how many') &&
    (q.includes('tenant') || q.includes('tenants'))
  ) {
    return '👥 MavRent currently has ' + tenants.length + ' tenant record(s) available to your account.';
  }

  if (
    q.includes('how many') &&
    (q.includes('property') || q.includes('properties'))
  ) {
    return '🏢 MavRent currently has ' + properties.length + ' property record(s) available to your account.';
  }


  if (
    q.includes('vacant') ||
    q.includes('empty units') ||
    q.includes('available units')
  ) {
    const vacant = units.filter(u =>
      String(u.status || '').toLowerCase() !== 'occupied'
    );

    if (!vacant.length) {
      return '🏠 No vacant units were found in the available MavRent data.';
    }

    const lines = vacant.slice(0, 50).map(u => {
      const property = findProperty(properties, u.property_id);
      return '• ' +
        (u.unit_number || u.name || 'Unit') +
        ' — ' +
        (property?.name || 'Property') +
        (u.monthly_rent ? ' — ' + money(u.monthly_rent) : '');
    });

    return '🏠 Vacant / available units: ' + vacant.length +
      '\n\n' + lines.join('\n');
  }

  if (
    q.includes('who paid today') ||
    q.includes('payments today') ||
    q.includes('paid today')
  ) {
    const todayDate = new Date().toISOString().slice(0, 10);
    const todays = (Array.isArray(d.payments) ? d.payments : [])
      .filter(p =>
        String(p.payment_date || p.created_at || '').slice(0, 10) === todayDate &&
        !['rejected','cancelled'].includes(String(p.status || '').toLowerCase())
      );

    if (!todays.length) {
      return '💳 No payments dated today were found in the available MavRent data.';
    }

    const lines = todays.slice(0, 50).map(p => {
      const tenant = findTenant(tenants, p.tenant_id);
      const name =
        tenant?.full_name ||
        tenant?.name ||
        tenant?.tenant_name ||
        tenant?.email ||
        'Unknown tenant';

      return '• ' + name + ' — ' + money(p.amount) +
        (p.payment_method ? ' — ' + p.payment_method : '');
    });

    const total = todays.reduce((sum, p) => sum + num(p.amount), 0);

    return '💳 Payments dated today: ' + todays.length +
      '\n\n' + lines.join('\n') +
      '\n\nTotal: ' + money(total);
  }

  if (
    q.includes('how many') &&
    (q.includes('unit') || q.includes('units'))
  ) {
    return '🚪 MavRent currently has ' + units.length + ' unit record(s) available to your account.';
  }

  return null;
}

async function askGemini(message, context) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is not configured on Vercel. Common MavRent questions still work without AI.'
    );
  }

  const system = [
    'You are MavRent AI, a read-only rental management assistant.',
    'Use ONLY the supplied MavRent account data for account-specific facts.',
    'Never invent tenants, payments, balances, dates, properties, receipts or maintenance records.',
    'If account data is missing, say so clearly.',
    'Respect the logged-in user role.',
    'Never reveal passwords, access tokens, service keys or secrets.',
    'Use UGX for financial figures.',
    'Keep answers concise and practical.',
    'Do not claim that you changed, deleted, confirmed, paid or sent anything.',
    'If the user asks a normal question unrelated to their MavRent account, answer briefly using general knowledge.'
  ].join('\n');

  const prompt =
    system +
    '\n\nMavRent account context (JSON):\n' +
    JSON.stringify(context) +
    '\n\nUser question:\n' +
    message;

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(GEMINI_MODEL) +
    ':generateContent?key=' +
    encodeURIComponent(process.env.GEMINI_API_KEY);

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text:
            'MavRent account context (JSON):\n' +
            JSON.stringify(context) +
            '\n\nUser question:\n' +
            message
          }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.2
      }
    })
  });

  const data = await r.json().catch(() => null);

  if (!r.ok) {
    throw new Error(
      data?.error?.message ||
      'Gemini request failed.'
    );
  }

  const answer =
    data?.candidates?.[0]?.content?.parts
      ?.map(p => p?.text || '')
      .join('')
      .trim();

  if (!answer) throw new Error('Gemini returned an empty answer.');

  return answer;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'POST only' });
  }

  try {
    const auth = req.headers.authorization || '';
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return json(res, 401, {
        error: 'You must be logged in to use MavRent AI.'
      });
    }

    const token = auth.slice(7).trim();
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : (req.body || {});

    const message = String(body.message || '').trim();

    if (!message) {
      return json(res, 400, { error: 'Enter a question first.' });
    }

    if (message.length > 4000) {
      return json(res, 400, { error: 'Question is too long.' });
    }

    const me = await getAuthenticatedUser(token);
    const context = await getMavRentContext(token, me.id);

    // First try deterministic Supabase answers.
    // This makes important rental questions completely free.
    const direct = answerDirectly(message, context);

    if (direct) {
      return json(res, 200, {
        answer: direct,
        source: 'supabase-direct',
        role: context.current_user.role
      });
    }

    // Only natural-language questions reach Gemini.
    const answer = await askGemini(message, context);

    return json(res, 200, {
      answer,
      model: GEMINI_MODEL,
      source: 'gemini-free-tier',
      role: context.current_user.role
    });
  } catch (error) {
    console.error('MavRent AI error:', error);

    return json(res, 500, {
      error: error?.message || 'MavRent AI failed.'
    });
  }
}
