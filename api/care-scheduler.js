// MavRent Care Mode scheduler
// Runs from Vercel Cron. It never performs financial or irreversible actions.
const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'';
function headers(){return {apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,'Content-Type':'application/json'};}
async function sb(path,opts={}){
 const r=await fetch(SUPABASE_URL+path,{method:opts.method||'GET',headers:{...headers(),...(opts.headers||{})},body:opts.body===undefined?undefined:JSON.stringify(opts.body)});
 const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}
 if(!r.ok)throw new Error(d?.message||d?.hint||d?.error||('Supabase '+r.status));return d;
}
async function insert(path,body){return sb(path,{method:'POST',headers:{Prefer:'return=representation'},body});}
module.exports=async(req,res)=>{
 try{
  if(!SERVICE_KEY)return res.status(500).json({error:'SUPABASE_SERVICE_ROLE_KEY is not configured.'});
  // Overdue status is evaluated from due_date/balance below; no optional RPC is required.
  const modes=await sb('/rest/v1/ai_care_mode?select=user_id,enabled,settings&enabled=eq.true&limit=500');
  let prepared=0;
  for(const mode of modes||[]){
   const landlordId=mode.user_id;
   const settings=mode.settings||{};
   const overdue=await sb('/rest/v1/rent_records?select=id,tenant_id,amount_due,amount_paid,due_date,status&period_month&landlord_id=eq.'+encodeURIComponent(landlordId)+'&limit=500');
   const open=await sb('/rest/v1/maintenance_requests?select=id,tenant_id,title,subject,status,priority,created_at&landlord_id=eq.'+encodeURIComponent(landlordId)+'&limit=500');
   const today=new Date().toISOString().slice(0,10);
   for(const r of overdue||[]){
    const due=Number(r.amount_due||0)-Number(r.amount_paid||0);
    if(due<=0)continue;
    const d=r.due_date?new Date(r.due_date).getTime():0;
    const overdueFlag=String(r.status||'').toLowerCase()==='overdue'||(d&&d<Date.now());
    if(!overdueFlag)continue;
    const key='overdue:'+r.id;
    const task=await insert('/rest/v1/ai_care_tasks',{
      landlord_id:landlordId,task_key:key,task_type:'rent_reminder',
      status:'prepared',priority:'high',target_type:'rent_record',target_id:r.id,
      title:'Rent reminder prepared',message:'A routine rent reminder is ready for review.',
      payload:{balance:due,due_date:r.due_date,period_month:r.period_month,auto_send:false},
      run_date:today
    }).catch(()=>null);
    if(task!==null)prepared++;
   }
   for(const m of open||[]){
    if(['completed','resolved','cancelled','closed'].includes(String(m.status||'').toLowerCase()))continue;
    const key='maintenance:'+m.id;
    const task=await insert('/rest/v1/ai_care_tasks',{
      landlord_id:landlordId,task_key:key,task_type:'maintenance_followup',
      status:'prepared',priority:String(m.priority||'normal').toLowerCase(),
      target_type:'maintenance_request',target_id:m.id,
      title:'Maintenance follow-up prepared',message:m.title||m.subject||'Open maintenance request',
      payload:{auto_send:false},run_date:today
    }).catch(()=>null);
    if(task!==null)prepared++;
   }
   await insert('/rest/v1/ai_audit_log',{
     user_id:landlordId,role:'landlord',action:'care_mode_daily_run',
     action_type:'scheduler',status:'executed',
     details:{prepared_tasks:prepared,settings},
     requires_confirmation:false
   }).catch(()=>null);
  }
  return res.status(200).json({ok:true,prepared_tasks:prepared,care_mode_landlords:(modes||[]).length});
 }catch(e){return res.status(500).json({error:e.message||'Care Mode scheduler failed.'});}
};
