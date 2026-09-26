// Mav AI production health check. Never returns secret values.
const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'';
module.exports=async(req,res)=>{
  const checks={supabase_url:!!SUPABASE_URL,service_role_configured:!!SERVICE_KEY};
  try{
    if(!SUPABASE_URL||!SERVICE_KEY)throw new Error('Required server configuration is missing.');
    const r=await fetch(SUPABASE_URL+'/rest/v1/ai_permission_policies?select=action&limit=1',{
      headers:{apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY}
    });
    checks.supabase_reachable=r.ok;
    if(!r.ok)throw new Error('Supabase returned HTTP '+r.status);
    return res.status(200).json({ok:true,service:'mav-ai',checks,version:'2026-09-26'});
  }catch(e){
    return res.status(503).json({ok:false,service:'mav-ai',checks,error:e.message||'Health check failed'});
  }
};
