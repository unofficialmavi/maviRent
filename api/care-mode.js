// MavRent Care Mode settings API
const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const ANON_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'';
function sbh(k){return {apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'};}
async function auth(token){const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:ANON_KEY,Authorization:'Bearer '+token}});const d=await r.json().catch(()=>null);if(!r.ok||!d?.id)throw new Error('Session expired.');return d;}
async function sb(path,opts={}){const r=await fetch(SUPABASE_URL+path,{method:opts.method||'GET',headers:{...sbh(SERVICE_KEY),...(opts.headers||{})},body:opts.body===undefined?undefined:JSON.stringify(opts.body)});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.hint||d?.error||('Supabase '+r.status));return d;}
module.exports=async(req,res)=>{
 try{
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const u=await auth(token);
  const prof=(await sb('/rest/v1/profiles?select=id,role& id=eq.'+encodeURIComponent(u.id))).find(x=>x.id===u.id);
  if(!prof||prof.role!=='landlord')return res.status(403).json({error:'Care Mode is landlord-only.'});
  if(req.method==='GET'){const rows=await sb('/rest/v1/ai_care_mode?select=*&user_id=eq.'+encodeURIComponent(u.id)+'&limit=1');return res.status(200).json({enabled:!!rows[0]?.enabled,settings:rows[0]?.settings||{}});}
  if(req.method!=='POST')return res.status(405).json({error:'GET or POST required'});
  const enabled=req.body?.enabled===true;
  const settings=req.body?.settings||{};
  const rows=await sb('/rest/v1/ai_care_mode?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{user_id:u.id,enabled,settings,updated_at:new Date().toISOString()}});
  await sb('/rest/v1/ai_audit_log',{method:'POST',body:{user_id:u.id,role:'landlord',action:'care_mode',action_type:'setting',status:'confirmed',details:{enabled,settings},requires_confirmation:true,confirmed_by:u.id,confirmed_at:new Date().toISOString()}});
  return res.status(200).json({ok:true,enabled,settings});
 }catch(e){return res.status(500).json({error:e.message||'Care Mode failed.'});}
};
