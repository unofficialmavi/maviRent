// MavRent server-side Permission Engine
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/,'');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

function send(res,status,body){return res.status(status).json(body);}
function sbHeaders(key){return {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};}

async function sb(path,opts={}){
  const key=opts.key||SERVICE_KEY;
  const r=await fetch(SUPABASE_URL+path,{
    method:opts.method||'GET',
    headers:{...sbHeaders(key),...(opts.headers||{})},
    body:opts.body===undefined?undefined:JSON.stringify(opts.body)
  });
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!r.ok)throw new Error(data?.message||data?.hint||data?.error||('Supabase '+r.status));
  return data;
}

async function userFromToken(token){
  if(!token)throw new Error('Authentication required.');
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:ANON_KEY,Authorization:'Bearer '+token}});
  const u=await r.json().catch(()=>null);
  if(!r.ok||!u?.id)throw new Error('Your MavRent session is not valid. Please log in again.');
  return u;
}

async function profile(userId){
  const rows=await sb('/rest/v1/profiles?select=id,full_name,role&id=eq.'+encodeURIComponent(userId),{});
  return Array.isArray(rows)?rows[0]:null;
}

async function policy(action){
  const rows=await sb('/rest/v1/ai_permission_policies?select=action,permission_level,care_mode_allowed&action=eq.'+encodeURIComponent(action));
  return Array.isArray(rows)?rows[0]:null;
}

async function audit(userId,role,actionName,status,details,requires=false,targetType=null,targetId=null){
  try{
    await sb('/rest/v1/ai_audit_log',{method:'POST',body:{
      user_id:userId,role,action:actionName,action_type:'server_action',status,
      target_type:targetType,target_id:targetId,details:details||{},
      requires_confirmation:requires,
      confirmed_by:status==='confirmed'||status==='executed'?userId:null,
      confirmed_at:status==='confirmed'||status==='executed'?new Date().toISOString():null
    }});
  }catch(e){console.error('AI audit log failed:',e.message);}
}

async function findTenant(userId,body){
  if(body.tenant_id){
    const rows=await sb('/rest/v1/tenants?select=*&id=eq.'+encodeURIComponent(body.tenant_id)+'&landlord_id=eq.'+encodeURIComponent(userId)+'&limit=1');
    return rows[0]||null;
  }
  const q=String(body.tenant_name||'').trim();
  if(!q)return null;
  const rows=await sb('/rest/v1/tenants?select=*&landlord_id=eq.'+encodeURIComponent(userId)+'&limit=100');
  const needle=q.toLowerCase();
  return rows.find(t=>String(t.full_name||t.name||'').toLowerCase().includes(needle))||null;
}

async function recordPayment(userId,body){
  const tenant=await findTenant(userId,body);
  if(!tenant)throw new Error('Tenant could not be found.');
  const amount=Number(body.amount);
  if(!Number.isFinite(amount)||amount<=0)throw new Error('Payment amount must be greater than zero.');
  const paymentDate=body.payment_date||new Date().toISOString().slice(0,10);
  const payment=await sb('/rest/v1/payments',{
    method:'POST',
    headers:{Prefer:'return=representation'},
    body:{
      landlord_id:userId,tenant_id:tenant.id,amount,
      payment_date:paymentDate,
      payment_method:body.payment_method||'other',
      status:'confirmed',
      notes:body.notes||'Recorded by MavRent AI Permission Engine'
    }
  });
  const p=payment[0];
  let remaining=amount;
  const records=await sb('/rest/v1/rent_records?select=*&tenant_id=eq.'+encodeURIComponent(tenant.id)+'&landlord_id=eq.'+encodeURIComponent(userId)+'&order=period_month.asc&limit=100');
  for(const r of records){
    const due=Math.max(0,Number(r.amount_due||r.rent_amount||0)-Number(r.amount_paid||0));
    if(remaining<=0||due<=0)continue;
    const part=Math.min(remaining,due);
    const newPaid=Number(r.amount_paid||0)+part;
    const newBalance=Math.max(0,Number(r.amount_due||r.rent_amount||0)-newPaid);
    const status=newBalance<=0?'paid':(newPaid>0?'partial':(r.status||'pending'));
    await sb('/rest/v1/rent_records?id=eq.'+encodeURIComponent(r.id)+'&landlord_id=eq.'+encodeURIComponent(userId),{
      method:'PATCH',headers:{Prefer:'return=minimal'},body:{amount_paid:newPaid,status}
    });
    remaining-=part;
  }
  let receipt=null;
  const existing=await sb('/rest/v1/receipts?select=*&payment_id=eq.'+encodeURIComponent(p.id)+'&limit=1');
  if(!existing.length){
    const receiptNumber='MVR-RCPT-'+String(p.id).replace(/-/g,'').slice(0,10).toUpperCase();
    const rr=await sb('/rest/v1/receipts',{
      method:'POST',headers:{Prefer:'return=representation'},
      body:{landlord_id:userId,tenant_id:tenant.id,payment_id:p.id,receipt_number:receiptNumber,issued_at:new Date().toISOString()}
    });
    receipt=rr[0];
  }else receipt=existing[0];
  return {payment:p,receipt,tenant_id:tenant.id};
}

async function createReceipt(userId,body){
  const paymentRows=await sb('/rest/v1/payments?select=*&id=eq.'+encodeURIComponent(body.payment_id)+'&landlord_id=eq.'+encodeURIComponent(userId)+'&limit=1');
  const p=paymentRows[0];
  if(!p)throw new Error('Payment not found.');
  if(String(p.status).toLowerCase()!=='confirmed')throw new Error('Only confirmed payments can receive a receipt.');
  if(!p.tenant_id)throw new Error('Payment is not linked to a tenant.');
  const existing=await sb('/rest/v1/receipts?select=*&payment_id=eq.'+encodeURIComponent(p.id)+'&limit=1');
  if(existing.length)return {receipt:existing[0],created:false};
  const n='MVR-RCPT-'+String(p.id).replace(/-/g,'').slice(0,10).toUpperCase();
  const rr=await sb('/rest/v1/receipts',{method:'POST',headers:{Prefer:'return=representation'},body:{
    landlord_id:userId,tenant_id:p.tenant_id,payment_id:p.id,receipt_number:n,issued_at:new Date().toISOString()
  }});
  return {receipt:rr[0],created:true};
}

async function assignTenant(userId,body){
  const profId=body.profile_id;
  const unitId=body.unit_id;
  const rent=Number(body.monthly_rent);
  if(!profId||!unitId||!Number.isFinite(rent)||rent<=0)throw new Error('Tenant, unit and monthly rent are required.');
  const units=await sb('/rest/v1/units?select=*&id=eq.'+encodeURIComponent(unitId)+'&limit=1');
  const unit=units[0];
  if(!unit)throw new Error('Unit not found.');
  const props=await sb('/rest/v1/properties?select=id&landlord_id=eq.'+encodeURIComponent(userId)+'&id=eq.'+encodeURIComponent(unit.property_id)+'&limit=1');
  if(!props.length)throw new Error('This unit does not belong to the landlord.');
  const existing=await sb('/rest/v1/tenants?select=id&unit_id=eq.'+encodeURIComponent(unitId)+'&status=eq.active&limit=1');
  if(existing.length)throw new Error('This unit is already occupied.');
  const rows=await sb('/rest/v1/tenants',{method:'POST',headers:{Prefer:'return=representation'},body:{
    landlord_id:userId,profile_id:profId,unit_id:unitId,rent_amount:rent,
    deposit_amount:Number(body.deposit_amount||0),rent_due_day:Number(body.rent_due_day||1),
    move_in_date:body.move_in_date,status:'active'
  }});
  await sb('/rest/v1/units?id=eq.'+encodeURIComponent(unitId),{method:'PATCH',body:{status:'occupied'}});
  return rows[0];
}

module.exports=async(req,res)=>{
  try{
    if(req.method!=='POST')return send(res,405,{error:'POST required'});
    if(!SERVICE_KEY)return send(res,500,{error:'SUPABASE_SERVICE_ROLE_KEY is not configured on Vercel.'});
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    const u=await userFromToken(token);
    const p=await profile(u.id);
    if(!p||!['landlord','tenant'].includes(p.role))return send(res,403,{error:'MavRent role not configured.'});
    const body=req.body||{};
    const actionName=String(body.action||'').trim();
    if(!actionName)return send(res,400,{error:'Action is required.'});
    const pol=await policy(actionName);
    if(!pol)return send(res,403,{error:'This AI action is not registered in the Permission Engine.'});
    const required=pol.permission_level;
    if(required==='never'){
      await audit(u.id,p.role,actionName,'denied',{reason:'Permission policy is never-automatic'},false);
      return send(res,403,{error:'This action is permanently blocked by MavRent Permission Engine.'});
    }
    const isConfirmation=body.confirmed===true;
    if((required==='confirm'||required==='prepare')&&!isConfirmation){
      await audit(u.id,p.role,actionName,'prepared',body.details||{},required==='confirm');
      return send(res,409,{requires_confirmation:required==='confirm',permission_level:required,error:'Final confirmation is required before this action can execute.'});
    }
    if(p.role!=='landlord' && !['read_data'].includes(actionName)){
      await audit(u.id,p.role,actionName,'denied',{reason:'Tenant cannot perform landlord management action'});
      return send(res,403,{error:'This management action is available only to landlords.'});
    }
    let result;
    if(actionName==='record_payment')result=await recordPayment(u.id,body);
    else if(actionName==='create_receipt')result=await createReceipt(u.id,body);
    else if(actionName==='assign_tenant')result=await assignTenant(u.id,body);
    else return send(res,400,{error:'Action is not implemented yet.'});
    await audit(u.id,p.role,actionName,'executed',{result:result?.receipt?.receipt_number||result?.id||null},true,result?.tenant_id?'tenant':null,result?.tenant_id||null);
    return send(res,200,{ok:true,result});
  }catch(e){
    return send(res,500,{error:e.message||'Server action failed.'});
  }
};
