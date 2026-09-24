const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const ANON_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'';
function h(k){return {apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'};}
async function auth(token){const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:h(ANON_KEY),}); if(!r.ok)throw new Error('Authentication service unavailable.');}
async function user(token){const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:ANON_KEY,Authorization:'Bearer '+token}});const d=await r.json().catch(()=>null);if(!r.ok||!d?.id)throw new Error('Session expired.');return d;}
async function sb(path,o={}){const r=await fetch(SUPABASE_URL+path,{method:o.method||'GET',headers:{...h(SERVICE_KEY),...(o.headers||{})},body:o.body===undefined?undefined:JSON.stringify(o.body)});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.hint||d?.error||('Supabase '+r.status));return d;}
module.exports=async(req,res)=>{
 try{
  if(!SERVICE_KEY)return res.status(500).json({error:'SUPABASE_SERVICE_ROLE_KEY is not configured.'});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const u=await user(token);
  const prof=(await sb('/rest/v1/profiles?select=id,role&id=eq.'+encodeURIComponent(u.id))).find(x=>x.id===u.id);
  if(!prof||prof.role!=='landlord')return res.status(403).json({error:'Care Tasks are landlord-only.'});
  if(req.method==='GET'){
    const tasks=await sb('/rest/v1/ai_care_tasks?select=*&landlord_id=eq.'+encodeURIComponent(u.id)+'&status=eq.prepared&order=priority.desc,created_at.desc&limit=100');
    return res.status(200).json({tasks:tasks||[]});
  }
  if(req.method!=='POST')return res.status(405).json({error:'GET or POST required'});
  const taskId=req.body?.task_id,decision=req.body?.decision;
  if(!taskId||!['approve','skip'].includes(decision))return res.status(400).json({error:'task_id and approve/skip are required.'});
  const rows=await sb('/rest/v1/ai_care_tasks?select=*&id=eq.'+encodeURIComponent(taskId)+'&landlord_id=eq.'+encodeURIComponent(u.id)+'&status=eq.prepared&limit=1');
  const task=rows[0];if(!task)return res.status(404).json({error:'Prepared Care Task not found.'});
  if(decision==='skip'){
    await sb('/rest/v1/ai_care_tasks?id=eq.'+encodeURIComponent(taskId)+'&landlord_id=eq.'+encodeURIComponent(u.id),{method:'PATCH',body:{status:'skipped'}});
    await sb('/rest/v1/ai_audit_log',{method:'POST',body:{user_id:u.id,role:'landlord',action:'care_task',action_type:task.task_type,status:'skipped',target_type:task.target_type,target_id:task.target_id,details:{task_id:task.id},requires_confirmation:true,confirmed_by:u.id,confirmed_at:new Date().toISOString()}});
    return res.status(200).json({ok:true,message:'Task skipped.'});
  }
  // Approval is deliberately limited to safe routine tasks.
  if(!['rent_reminder','maintenance_followup'].includes(task.task_type))return res.status(403).json({error:'This Care Task requires a dedicated confirmation flow.'});
  await sb('/rest/v1/ai_care_tasks?id=eq.'+encodeURIComponent(taskId)+'&landlord_id=eq.'+encodeURIComponent(u.id),{method:'PATCH',body:{status:'executed',executed_at:new Date().toISOString()}});
  await sb('/rest/v1/ai_audit_log',{method:'POST',body:{user_id:u.id,role:'landlord',action:'care_task',action_type:task.task_type,status:'executed',target_type:task.target_type,target_id:task.target_id,details:{task_id:task.id,execution:'approved_task_recorded'},requires_confirmation:true,confirmed_by:u.id,confirmed_at:new Date().toISOString()}});
  return res.status(200).json({ok:true,message:task.task_type==='rent_reminder'?'Routine reminder task approved. The communication provider is not called until an approved messaging channel is configured.':'Maintenance follow-up task approved.'});
 }catch(e){return res.status(500).json({error:e.message||'Care Tasks failed.'});}
};