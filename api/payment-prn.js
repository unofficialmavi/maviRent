// Mav AI Payment PRN workflow
// PRNs are references only. A payment becomes verified only after a trusted
// provider webhook passes signature, amount, PRN, tenant and idempotency checks.

const crypto = require('crypto');

const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const ANON_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'';

function send(res,status,body){return res.status(status).json(body);}
function headers(key){return {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};}

async function sb(path,opts={}){
  const r=await fetch(SUPABASE_URL+path,{
    method:opts.method||'GET',
    headers:{...headers(opts.key||SERVICE_KEY),...(opts.headers||{})},
    body:opts.body===undefined?undefined:JSON.stringify(opts.body)
  });
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!r.ok)throw new Error(data?.message||data?.hint||data?.error||('Supabase '+r.status));
  return data;
}

async function authUser(token){
  if(!token)throw new Error('Authentication required.');
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:ANON_KEY,Authorization:'Bearer '+token}});
  const u=await r.json().catch(()=>null);
  if(!r.ok||!u?.id)throw new Error('Your session is not valid. Please log in again.');
  return u;
}

async function profile(id){
  const rows=await sb('/rest/v1/profiles?select=id,full_name,role&id=eq.'+encodeURIComponent(id)+'&limit=1');
  return rows[0]||null;
}

async function tenantForUser(userId){
  const rows=await sb('/rest/v1/tenants?select=*&profile_id=eq.'+encodeURIComponent(userId)+'&status=eq.active&limit=1');
  return rows[0]||null;
}

function makePrn(){
  const stamp=Date.now().toString(36).toUpperCase();
  const random=crypto.randomBytes(4).toString('hex').toUpperCase();
  return 'MVR'+stamp+random;
}

function cleanRef(v){return String(v||'').trim().slice(0,160);}

async function outstandingAmount(tenant){
  const rows=await sb('/rest/v1/rent_records?select=id,amount_due,amount_paid,due_date,status,period_month&tenant_id=eq.'+encodeURIComponent(tenant.id)+'&landlord_id=eq.'+encodeURIComponent(tenant.landlord_id)+'&order=due_date.asc&limit=100');
  return (rows||[]).reduce((sum,r)=>sum+Math.max(0,Number(r.amount_due||0)-Number(r.amount_paid||0)),0);
}

async function audit(userId,role,action,status,details,targetId=null){
  await sb('/rest/v1/ai_audit_log',{method:'POST',body:{
    user_id:userId,role,action,action_type:'payment_prn',status,
    target_type:'payment_request',target_id:targetId,details:details||{},
    requires_confirmation:false
  }}).catch(()=>null);
}

async function allocateAndReceipt(req){
  const tenantId=req.tenant_id, landlordId=req.landlord_id, amount=Number(req.amount);
  let remaining=amount;
  const records=await sb('/rest/v1/rent_records?select=id,amount_due,amount_paid,status,due_date,period_month&tenant_id=eq.'+encodeURIComponent(tenantId)+'&landlord_id=eq.'+encodeURIComponent(landlordId)+'&order=due_date.asc&limit=100');
  let firstRecord=null;
  for(const r of records||[]){
    const due=Math.max(0,Number(r.amount_due||0)-Number(r.amount_paid||0));
    if(due<=0||remaining<=0)continue;
    const part=Math.min(remaining,due);
    const paid=Number(r.amount_paid||0)+part;
    const balance=Math.max(0,Number(r.amount_due||0)-paid);
    const status=balance<=0?'paid':'partial';
    await sb('/rest/v1/rent_records?id=eq.'+encodeURIComponent(r.id)+'&landlord_id=eq.'+encodeURIComponent(landlordId),{
      method:'PATCH',body:{amount_paid:paid,status,paid_at:balance<=0?new Date().toISOString():null}
    });
    if(!firstRecord)firstRecord=r;
    remaining-=part;
  }
  return firstRecord;
}

async function approveVerified(request,provider){
  const existing=await sb('/rest/v1/payments?select=*&transaction_reference=eq.'+encodeURIComponent(request.transaction_reference||'')+'&limit=1');
  if(existing.length)return {payment:existing[0],duplicate:true};

  const paymentRows=await sb('/rest/v1/payments',{
    method:'POST',
    headers:{Prefer:'return=representation'},
    body:{
      landlord_id:request.landlord_id,
      tenant_id:request.tenant_id,
      amount:Number(request.amount),
      payment_date:new Date().toISOString().slice(0,10),
      payment_method:request.payment_method||'other',
      transaction_reference:request.transaction_reference,
      status:'confirmed',
      confirmed_at:new Date().toISOString(),
      notes:'Verified automatically by Mav AI payment provider workflow'
    }
  });
  const payment=paymentRows[0];
  await allocateAndReceipt({...request,amount:Number(request.amount)});

  const existingReceipt=await sb('/rest/v1/receipts?select=*&payment_id=eq.'+encodeURIComponent(payment.id)+'&limit=1');
  let receipt=existingReceipt[0]||null;
  if(!receipt){
    const rr=await sb('/rest/v1/receipts',{
      method:'POST',headers:{Prefer:'return=representation'},
      body:{
        landlord_id:request.landlord_id,tenant_id:request.tenant_id,payment_id:payment.id,
        receipt_number:'MVR-RCPT-'+String(payment.id).replace(/-/g,'').slice(0,10).toUpperCase(),
        issued_at:new Date().toISOString()
      }
    });
    receipt=rr[0];
  }

  await sb('/rest/v1/payment_requests?id=eq.'+encodeURIComponent(request.id),{
    method:'PATCH',
    body:{status:'approved',approved_at:new Date().toISOString(),payment_id:payment.id,receipt_id:receipt?.id||null}
  });

  const tenant=await sb('/rest/v1/tenants?select=profile_id&id=eq.'+encodeURIComponent(request.tenant_id)+'&limit=1');
  if(tenant[0]?.profile_id){
    await sb('/rest/v1/notifications',{method:'POST',body:{
      user_id:tenant[0].profile_id,title:'Payment verified',
      message:'Your payment of UGX '+Math.round(Number(request.amount)).toLocaleString('en-UG')+' has been verified. PRN: '+request.prn,
      type:'payment_confirmed',related_id:payment.id
    }}).catch(()=>null);
  }

  await audit(request.landlord_id,'landlord','prn_payment_auto_approval','executed',{
    prn:request.prn,amount:Number(request.amount),provider,transaction_reference:request.transaction_reference,
    payment_id:payment.id,receipt_id:receipt?.id||null
  },request.id);

  return {payment,receipt,duplicate:false};
}

function validSignature(raw,secret,signature){
  if(!secret||!signature)return false;
  const supplied=String(signature).replace(/^sha256=/i,'').trim();
  const expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
  try{
    return crypto.timingSafeEqual(Buffer.from(supplied,'utf8'),Buffer.from(expected,'utf8'));
  }catch{return false;}
}

module.exports=async(req,res)=>{
  try{
    if(!SERVICE_KEY)return send(res,500,{error:'Payment service is not configured on Vercel.'});

    const action=String(req.body?.action||'').trim();

    // Tenant-facing authenticated actions.
    if(action==='create'||action==='submit'||action==='status'){
      const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
      const u=await authUser(token);
      const p=await profile(u.id);
      if(!p)return send(res,403,{error:'Mav AI profile not configured.'});

      const tenant=await tenantForUser(u.id);
      if(!tenant)return send(res,404,{error:'No active rental assignment was found for your account.'});

      if(action==='create'){
        const requested=Number(req.body?.amount);
        const balance=await outstandingAmount(tenant);
        const amount=Number.isFinite(requested)&&requested>0?requested:balance;
        if(amount<=0)return send(res,400,{error:'There is no outstanding amount to generate a payment PRN for.'});

        const expires=new Date(Date.now()+24*60*60*1000).toISOString();
        const prn=makePrn();
        const idempotency=cleanRef(req.body?.idempotency_key)||('prn-create:'+u.id+':'+Date.now());
        const rows=await sb('/rest/v1/payment_requests',{
          method:'POST',headers:{Prefer:'return=representation'},
          body:{
            prn,tenant_id:tenant.id,landlord_id:tenant.landlord_id,amount,currency:'UGX',
            status:'issued',payment_method:req.body?.payment_method||null,expires_at:expires,
            metadata:{source:'mav-ai',requested_balance:balance},idempotency_key:idempotency
          }
        });
        await audit(u.id,'tenant','payment_prn_created','executed',{prn,amount,expires_at:expires},rows[0]?.id||null);
        return send(res,200,{ok:true,payment_request:rows[0],balance});
      }

      const prn=cleanRef(req.body?.prn);
      if(!prn)return send(res,400,{error:'PRN is required.'});
      const rows=await sb('/rest/v1/payment_requests?select=*&prn=eq.'+encodeURIComponent(prn)+'&tenant_id=eq.'+encodeURIComponent(tenant.id)+'&limit=1');
      const request=rows[0];
      if(!request)return send(res,404,{error:'That PRN was not found for your account.'});

      if(action==='status')return send(res,200,{ok:true,payment_request:request});

      if(['approved','verified','rejected','cancelled','expired'].includes(request.status))
        return send(res,409,{error:'This PRN is already '+request.status+'.',payment_request:request});

      if(request.expires_at&&new Date(request.expires_at).getTime()<Date.now()){
        await sb('/rest/v1/payment_requests?id=eq.'+encodeURIComponent(request.id),{method:'PATCH',body:{status:'expired'}}).catch(()=>null);
        return send(res,409,{error:'This PRN has expired. Generate a new one.',status:'expired'});
      }

      const transaction=cleanRef(req.body?.transaction_reference);
      const submitted=await sb('/rest/v1/payment_requests?id=eq.'+encodeURIComponent(request.id),{
        method:'PATCH',headers:{Prefer:'return=representation'},
        body:{status:'submitted',transaction_reference:transaction||null,payment_method:req.body?.payment_method||request.payment_method,submitted_at:new Date().toISOString()}
      });
      await audit(u.id,'tenant','payment_prn_submitted','executed',{prn,transaction_reference:transaction||null},request.id);
      return send(res,200,{ok:true,payment_request:submitted[0]||request,message:'Payment submitted for verification.'});
    }

    // Trusted provider webhook. Never expose this action to the normal tenant UI.
    if(action==='verify_webhook'){
      const secret=process.env.MAVRENT_PAYMENT_WEBHOOK_SECRET||'';
      const raw=req.rawBody?String(req.rawBody):JSON.stringify(req.body||{});
      const signature=req.headers['x-mavrent-signature']||req.headers['x-mavrent-signature-sha256'];
      if(!validSignature(raw,secret,signature))return send(res,401,{error:'Invalid payment provider signature.'});

      const provider=cleanRef(req.body?.provider||req.body?.provider_name);
      const transactionId=cleanRef(req.body?.provider_transaction_id||req.body?.transaction_id);
      const prn=cleanRef(req.body?.prn);
      const amount=Number(req.body?.amount);
      if(!provider||!transactionId||!prn||!Number.isFinite(amount)||amount<=0)return send(res,400,{error:'provider, transaction_id, PRN and amount are required.'});

      const existingTx=await sb('/rest/v1/payment_requests?select=*&provider_name=eq.'+encodeURIComponent(provider)+'&provider_transaction_id=eq.'+encodeURIComponent(transactionId)+'&limit=1');
      if(existingTx.length)return send(res,200,{ok:true,duplicate:true,payment_request:existingTx[0]});

      const rows=await sb('/rest/v1/payment_requests?select=*&prn=eq.'+encodeURIComponent(prn)+'&limit=1');
      const request=rows[0];
      if(!request)return send(res,404,{error:'PRN not found.'});
      if(request.status==='approved')return send(res,200,{ok:true,already_approved:true,payment_request:request});
      if(request.expires_at&&new Date(request.expires_at).getTime()<Date.now())return send(res,409,{error:'PRN has expired.'});
      if(Number(request.amount)!==amount)return send(res,409,{error:'Provider amount does not exactly match the PRN amount.'});

      const tenantId=request.tenant_id;
      const tenant=await sb('/rest/v1/tenants?select=id,landlord_id,status&id=eq.'+encodeURIComponent(tenantId)+'&landlord_id=eq.'+encodeURIComponent(request.landlord_id)+'&limit=1');
      if(!tenant[0]||tenant[0].status!=='active')return send(res,409,{error:'PRN tenant is not active.'});

      const verifiedBody={
        status:'verified',provider_name:provider,provider_transaction_id:transactionId,
        verification_payload:{provider,transaction_id:transactionId,verified_at:new Date().toISOString()},
        verified_at:new Date().toISOString(),transaction_reference:transactionId
      };
      const verifiedRows=await sb('/rest/v1/payment_requests?id=eq.'+encodeURIComponent(request.id),{
        method:'PATCH',headers:{Prefer:'return=representation'},body:verifiedBody
      });
      const verified=verifiedRows[0]||{...request,...verifiedBody};

      const care=await sb('/rest/v1/ai_care_mode?select=enabled&user_id=eq.'+encodeURIComponent(request.landlord_id)+'&limit=1');
      const careEnabled=!!care[0]?.enabled;

      if(careEnabled){
        const result=await approveVerified({...verified,transaction_reference:transactionId},provider);
        return send(res,200,{ok:true,status:'approved',care_mode:true,result});
      }

      await audit(request.landlord_id,'landlord','prn_payment_verified','executed',{
        prn,amount,provider,transaction_reference:transactionId,care_mode:false
      },request.id);
      return send(res,200,{ok:true,status:'verified',care_mode:false,payment_request:verified,message:'Payment verified and awaiting landlord approval.'});
    }

    return send(res,400,{error:'Unknown payment PRN action.'});
  }catch(e){
    console.error('Mav AI PRN error:',e);
    return send(res,500,{error:e.message||'Payment PRN workflow failed.'});
  }
};
