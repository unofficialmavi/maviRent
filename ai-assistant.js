/* MavRent AI Assistant V3 — visible AI + confirmed actions */
(function(){
  const STYLE = `
    #mavAiButton{position:fixed;right:18px;bottom:88px;z-index:260;border:0;border-radius:999px;padding:13px 17px;background:linear-gradient(135deg,#087cff,#00b8ff);color:#fff;font-weight:900;box-shadow:0 14px 35px #087cff55;display:none}
    #mavAiButton.show{display:block}
    #mavAiModal{position:fixed;inset:0;z-index:1000;display:none;background:#0008;align-items:center;justify-content:center;padding:15px}
    #mavAiModal.open{display:flex}
    .mavAiBox{width:min(700px,100%);height:min(820px,94vh);background:#fff;border-radius:20px;box-shadow:0 25px 90px #0006;display:flex;flex-direction:column;overflow:hidden}
    .mavAiHead{padding:15px 17px;background:#111827;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px}
    .mavAiHead strong{font-size:17px}.mavAiHead small{display:block;opacity:.7;margin-top:2px}
    .mavAiClose{border:0;background:#273244;color:#fff;border-radius:9px;padding:8px 11px}
    .mavAiMessages{flex:1;overflow:auto;padding:15px;background:#f6f8fb}
    .mavAiMsg{max-width:90%;padding:11px 13px;border-radius:14px;margin-bottom:10px;line-height:1.45;font-size:14px;white-space:pre-wrap}
    .mavAiMsg.bot{background:#fff;border:1px solid #e3e6ea}.mavAiMsg.user{margin-left:auto;background:#087cff;color:#fff}
    .mavAiComposer{padding:12px;border-top:1px solid #e5e7eb;display:flex;gap:8px}
    .mavAiComposer textarea{flex:1;resize:none;min-height:48px;max-height:120px;padding:12px;border:1px solid #d9dde3;border-radius:12px;font:inherit}
    .mavAiSend{border:0;border-radius:12px;padding:0 16px;background:#111827;color:#fff;font-weight:800}
    .mavAiHint{font-size:11px;color:#6b7280;padding:0 12px 9px}
    .mavAiActions{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
    .mavAiAction{border:1px solid #d9dde3;background:#fff;border-radius:12px;padding:11px;text-align:left;font-weight:800}
    .mavAiPanel{background:#fff;border:1px solid #dfe4ea;border-radius:14px;padding:14px;margin-bottom:12px}
    .mavAiPanel h3{margin:0 0 10px}.mavAiPanel label{display:block;color:#4b5563;font-size:12px;margin:8px 0 5px}
    .mavAiPanel input,.mavAiPanel select{width:100%;padding:11px;border:1px solid #d9dde3;border-radius:10px;background:#fff;color:#111827}
    .mavAiGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .mavAiConfirm{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .mavAiConfirm button{border:0;border-radius:10px;padding:11px;font-weight:900}
    .mavAiConfirm .ok{background:#087cff;color:#fff}.mavAiConfirm .cancel{background:#eef1f5;color:#111827}
    .mavAiSummary{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:11px;margin-top:10px;font-size:13px;line-height:1.6}
    @media(max-width:600px){.mavAiActions,.mavAiGrid,.mavAiConfirm{grid-template-columns:1fr}.mavAiBox{height:96vh}#mavAiButton{right:12px;bottom:78px}}
  `;

  function boot(){
    if(document.getElementById('mavAiButton'))return;

    const style=document.createElement('style');
    style.textContent=STYLE;
    document.head.appendChild(style);

    const button=document.createElement('button');
    button.id='mavAiButton';
    button.type='button';
    button.textContent='✨ MavRent AI';
    document.body.appendChild(button);

    const modal=document.createElement('div');
    modal.id='mavAiModal';
    modal.innerHTML=
      '<div class="mavAiBox">'+
        '<div class="mavAiHead"><div><strong>✨ MavRent AI</strong><small>Ask questions, prepare actions, confirm important changes</small></div><button class="mavAiClose" type="button">✕</button></div>'+
        '<div class="mavAiMessages" id="mavAiMessages">'+
          '<div class="mavAiMsg bot">Hi. I am MavRent AI. I can read your rental data, answer questions, and prepare management actions. Important changes always require your final confirmation.</div>'+
          '<div class="mavAiActions">'+
            '<button class="mavAiAction" id="mavAiAddTenant">👤 Assign new tenant</button>'+
            '<button class="mavAiAction" id="mavAiReceipt">🧾 Create receipt</button>'+
            '<button class="mavAiAction" id="mavAiOverdue">🔴 Show overdue</button>'+
            '<button class="mavAiAction" id="mavAiMaintenance">🔧 Open maintenance</button><button class="mavAiAction" id="mavAiBrief">📋 Daily brief</button><button class="mavAiAction" id="mavAiContact">📲 Contact overdue</button>'+
          '</div>'+
        '</div>'+
        '<div class="mavAiHint">Try: “Who is overdue?” or “Assign Sarah to Room B12, rent 450000, deposit 450000.”</div>'+
        '<div class="mavAiComposer"><textarea id="mavAiInput" placeholder="Ask MavRent AI..." maxlength="4000"></textarea><button class="mavAiSend" id="mavAiSend" type="button">Send</button></div>'+
      '</div>';
    document.body.appendChild(modal);

    const messages=document.getElementById('mavAiMessages');
    const input=document.getElementById('mavAiInput');
    const send=document.getElementById('mavAiSend');

    const close=function(){modal.classList.remove('open');};
    button.onclick=function(){modal.classList.add('open');};
    modal.querySelector('.mavAiClose').onclick=close;
    modal.addEventListener('click',function(e){if(e.target===modal)close();});

    function addMessage(text,who){
      const el=document.createElement('div');
      el.className='mavAiMsg '+who;
      el.textContent=String(text||'');
      messages.appendChild(el);
      messages.scrollTop=messages.scrollHeight;
    }

    function panel(html){
      const el=document.createElement('div');
      el.className='mavAiPanel';
      el.innerHTML=html;
      messages.appendChild(el);
      messages.scrollTop=messages.scrollHeight;
      return el;
    }

    function escLocal(v){
      if(typeof esc==='function')return esc(v);
      return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});
    }

    function moneyLocal(v){
      if(typeof money==='function')return money(v);
      return 'UGX '+Number(v||0).toLocaleString('en-US');
    }

    async function session(){
      if(typeof ensureSupabase==='function')await ensureSupabase();
      if(!window.sb||!sb.auth)throw new Error('MavRent login service is not ready.');
      const s=await sb.auth.getSession();
      const token=s&&s.data&&s.data.session&&s.data.session.access_token;
      if(!token)throw new Error('Please log in to MavRent first.');
      return token;
    }

    function landlordOnly(){
      if(typeof role!=='undefined'&&role!=='landlord'){
        addMessage('This action is available to landlords only.','bot');
        return false;
      }
      return true;
    }

    async function showAddTenant(seed){
      seed=seed||{};
      if(!landlordOnly())return;
      try{await session();}catch(e){addMessage(e.message,'bot');return;}

      const registered=Array.isArray(cache.registeredTenants)?cache.registeredTenants:[];
      const units=Array.isArray(cache.units)?cache.units:[];
      const vacant=units.filter(function(u){return String(u.status||'').toLowerCase()!=='occupied';});

      if(!registered.length){addMessage('There are no registered tenant accounts available to assign yet.','bot');return;}
      if(!vacant.length){addMessage('There are no vacant units available right now.','bot');return;}

      let html='<h3>👤 Prepare tenant assignment</h3>'+
        '<div class="mavAiGrid">'+
        '<div><label>Registered tenant</label><select id="aiTProfile">';
      registered.forEach(function(x){html+='<option value="'+escLocal(x.id)+'">'+escLocal(x.full_name||x.email)+' — '+escLocal(x.email||'')+'</option>';});
      html+='</select></div><div><label>Vacant unit</label><select id="aiTUnit">';
      vacant.forEach(function(x){html+='<option value="'+escLocal(x.id)+'">'+escLocal(x.unit_number||x.name||'Unit')+' — '+moneyLocal(x.monthly_rent)+'</option>';});
      html+='</select></div>'+
        '<div><label>Monthly rent (UGX)</label><input id="aiTRent" type="number" min="1"></div>'+
        '<div><label>Deposit (UGX)</label><input id="aiTDeposit" type="number" min="0" value="0"></div>'+
        '<div><label>Rent due day</label><input id="aiTDue" type="number" min="1" max="28" value="1"></div>'+
        '<div><label>Move-in date</label><input id="aiTMove" type="date"></div></div>'+
        '<label>Initial rent schedule</label><select id="aiTAdvance"><option value="1">1 month</option><option value="3" selected>3 months</option><option value="6">6 months</option><option value="12">12 months</option></select>'+
        '<div class="mavAiConfirm"><button class="ok" id="aiPrepareConfirm">Review assignment</button><button class="cancel" id="aiCancel">Cancel</button></div>';

      const p=panel(html);
      const todayValue=new Date().toISOString().slice(0,10);
      const wantedUnit=String(seed.unit_number||'').toLowerCase();
      const wantedTenant=String(seed.tenant_name||'').toLowerCase();
      const unit=vacant.find(function(u){return wantedUnit&&String(u.unit_number||u.name||'').toLowerCase()===wantedUnit;})||vacant[0];
      const prof=registered.find(function(x){return wantedTenant&&String(x.full_name||x.email||'').toLowerCase().includes(wantedTenant);});

      document.getElementById('aiTMove').value=seed.move_in_date||todayValue;
      if(prof)document.getElementById('aiTProfile').value=prof.id;
      if(unit)document.getElementById('aiTUnit').value=unit.id;
      document.getElementById('aiTRent').value=seed.monthly_rent||unit.monthly_rent||0;
      document.getElementById('aiTDeposit').value=seed.deposit_amount||0;
      document.getElementById('aiTDue').value=seed.rent_due_day||1;
      document.getElementById('aiTAdvance').value=seed.initial_advance_months||3;

      p.querySelector('#aiCancel').onclick=function(){p.remove();};
      p.querySelector('#aiPrepareConfirm').onclick=function(){reviewTenant(p);};
    }

    function reviewTenant(p){
      const profileId=p.querySelector('#aiTProfile').value;
      const unitId=p.querySelector('#aiTUnit').value;
      const rent=Number(p.querySelector('#aiTRent').value||0);
      const deposit=Number(p.querySelector('#aiTDeposit').value||0);
      const due=Number(p.querySelector('#aiTDue').value||1);
      const move=p.querySelector('#aiTMove').value;
      const advance=Number(p.querySelector('#aiTAdvance').value||3);
      const prof=cache.registeredTenants.find(function(x){return x.id===profileId;});
      const unit=cache.units.find(function(x){return x.id===unitId;});

      if(!profileId||!unitId||rent<=0||!move){alert('Complete the tenant, unit, rent and move-in date.');return;}

      p.innerHTML='<h3>🔐 Final confirmation</h3>'+
        '<div class="mavAiSummary"><b>Tenant:</b> '+escLocal(prof&& (prof.full_name||prof.email)||'Tenant')+'<br>'+
        '<b>Unit:</b> '+escLocal(unit&& (unit.unit_number||'—'))+'<br>'+
        '<b>Monthly rent:</b> '+moneyLocal(rent)+'<br><b>Deposit:</b> '+moneyLocal(deposit)+
        '<br><b>Due day:</b> '+due+'<br><b>Move-in:</b> '+escLocal(move)+
        '<br><b>Initial schedule:</b> '+advance+' month(s)</div>'+
        '<div class="mavAiConfirm"><button class="ok" id="aiFinalConfirm">✓ Confirm & Assign</button><button class="cancel" id="aiFinalCancel">Cancel</button></div>';

      p.querySelector('#aiFinalCancel').onclick=function(){p.remove();};
      p.querySelector('#aiFinalConfirm').onclick=async function(){
        const b=this;b.disabled=true;b.textContent='Assigning...';
        try{
          const r=await sb.from('tenants').insert({landlord_id:user.id,profile_id:profileId,unit_id:unitId,rent_amount:rent,deposit_amount:deposit,rent_due_day:due,move_in_date:move,status:'active'}).select('*').single();
          if(r.error)throw r.error;
          const u=await sb.from('units').update({status:'occupied'}).eq('id',unitId).eq('landlord_id',user.id);
          if(u.error)throw u.error;
          if(typeof generateRentForTenant==='function'){
            const gen=await generateRentForTenant(r.data.id,Math.max(12,advance));
            if(!gen.ok)throw new Error(gen.error&&gen.error.message||'Rent schedule generation failed.');
          }
          p.remove();
          addMessage('✅ Tenant assigned successfully. The unit is now occupied and the rent schedule has been prepared.','bot');
          if(typeof refresh==='function')await refresh();
          if(typeof show==='function')await show('tenants',false);
        }catch(e){b.disabled=false;b.textContent='✓ Confirm & Assign';addMessage('Action failed: '+(e.message||e),'bot');}
      };
    }

    async function showReceipt(){
      if(!landlordOnly())return;
      try{await session();}catch(e){addMessage(e.message,'bot');return;}
      const confirmed=(cache.payments||[]).filter(function(p){return String(p.status||'').toLowerCase()==='confirmed';});
      if(!confirmed.length){addMessage('There are no confirmed payments available for a receipt.','bot');return;}

      let html='<h3>🧾 Prepare receipt</h3><label>Confirmed payment</label><select id="aiReceiptPayment">';
      confirmed.forEach(function(x){
        const t=cache.tenants.find(function(z){return z.id===x.tenant_id;});
        const prof=cache.registeredTenants.find(function(pr){return pr.id===(t&&t.profile_id);});
        html+='<option value="'+escLocal(x.id)+'">'+escLocal(prof&& (prof.full_name||prof.email)||'Tenant')+' — '+moneyLocal(x.amount)+' — '+escLocal(x.payment_date||'')+'</option>';
      });
      html+='</select><div class="mavAiConfirm"><button class="ok" id="aiReceiptReview">Review</button><button class="cancel" id="aiReceiptCancel">Cancel</button></div>';

      const p=panel(html);
      p.querySelector('#aiReceiptCancel').onclick=function(){p.remove();};
      p.querySelector('#aiReceiptReview').onclick=function(){
        const id=p.querySelector('#aiReceiptPayment').value;
        const pay=cache.payments.find(function(x){return x.id===id;});
        const t=cache.tenants.find(function(x){return x.id===(pay&&pay.tenant_id);});
        const prof=cache.registeredTenants.find(function(x){return x.id===(t&&t.profile_id);});
        p.innerHTML='<h3>🔐 Final confirmation</h3>'+
          '<div class="mavAiSummary"><b>Tenant:</b> '+escLocal(prof&& (prof.full_name||prof.email)||'Tenant')+
          '<br><b>Amount:</b> '+moneyLocal(pay&&pay.amount)+'<br><b>Payment date:</b> '+escLocal(pay&&pay.payment_date||'—')+
          '<br><b>Method:</b> '+escLocal(pay&&pay.payment_method||'—')+'</div>'+
          '<div class="mavAiConfirm"><button class="ok" id="aiReceiptConfirm">✓ Create receipt</button><button class="cancel" id="aiReceiptFinalCancel">Cancel</button></div>';
        p.querySelector('#aiReceiptFinalCancel').onclick=function(){p.remove();};
        p.querySelector('#aiReceiptConfirm').onclick=async function(){
          const b=this;b.disabled=true;b.textContent='Creating...';
          try{
            if(typeof createAutomaticReceiptForPayment!=='function')throw new Error('Receipt function is not available.');
            const out=await createAutomaticReceiptForPayment(pay);
            if(!out.ok)throw out.error||new Error('Receipt could not be created.');
            p.remove();addMessage('🧾 Receipt created: '+(out.data&&out.data.receipt_number||'MavRent receipt'),'bot');
            if(typeof refresh==='function')await refresh();
          }catch(e){b.disabled=false;b.textContent='✓ Create receipt';addMessage('Receipt failed: '+(e.message||e),'bot');}
        };
      };
    }


    function dailyBrief(){
      const tenants=Array.isArray(cache.tenants)?cache.tenants:[];
      const records=Array.isArray(cache.rent_records)?cache.rent_records:[];
      const maintenance=Array.isArray(cache.maintenance_requests)?cache.maintenance_requests:[];
      const vacant=(cache.units||[]).filter(function(u){return String(u.status||'').toLowerCase()!=='occupied';}).length;
      const overdue=records.filter(function(r){
        const due=Number(r.amount_due||0),paid=Number(r.amount_paid||0);
        if(due-paid<=0)return false;
        const d=r.due_date?new Date(r.due_date+'T23:59:59').getTime():0;
        return String(r.status||'').toLowerCase()==='overdue'||(d&&d<Date.now());
      });
      const openMaint=maintenance.filter(function(r){return !['completed','resolved','cancelled','closed'].includes(String(r.status||'').toLowerCase());});
      const total=overdue.reduce(function(a,r){return a+Math.max(0,Number(r.amount_due||0)-Number(r.amount_paid||0));},0);
      addMessage(
        '📋 MavRent Daily Brief\n\n'+
        '👥 Tenants: '+tenants.length+'\n'+
        '🚪 Vacant units: '+vacant+'\n'+
        '🔴 Overdue records: '+overdue.length+' — '+moneyLocal(total)+'\n'+
        '🔧 Open maintenance: '+openMaint.length+'\n\n'+
        (overdue.length?'Action: review overdue tenants and contact them.':'✅ No overdue rent detected.')+
        (openMaint.length?'\nAction: review open maintenance requests.':''),
        'bot'
      );
    }

    function contactOverdue(){
      if(!landlordOnly())return;
      const overdue=[];
      (cache.tenants||[]).forEach(function(t){
        const rows=(cache.rent_records||[]).filter(function(r){return r.tenant_id===t.id;});
        const balance=rows.reduce(function(a,r){return a+Math.max(0,Number(r.amount_due||0)-Number(r.amount_paid||0));},0);
        const first=rows.find(function(r){
          const b=Math.max(0,Number(r.amount_due||0)-Number(r.amount_paid||0));
          const d=r.due_date?new Date(r.due_date+'T23:59:59').getTime():0;
          return b>0 && (String(r.status||'').toLowerCase()==='overdue'||(d&&d<Date.now()));
        });
        if(first&&balance>0)overdue.push({tenant:t,balance:balance,record:first});
      });
      if(!overdue.length){addMessage('✅ No overdue tenants need contact right now.','bot');return;}
      let html='<h3>📲 Contact overdue tenants</h3><div class="mavAiSummary">MavRent will not send anything silently. Choose how you want to contact each tenant.</div>';
      overdue.forEach(function(x){
        const p=cache.registeredTenants.find(function(pr){return pr.id===x.tenant.profile_id;});
        const name=p&& (p.full_name||p.email)||'Tenant';
        const raw=String(p&&p.phone||x.tenant.phone||'').replace(/[^0-9+]/g,'');
        const phone=raw.replace(/^00/,'+');
        const wa=phone.replace(/^\+/,'');
        const text=encodeURIComponent('Hello '+name+', this is a MavRent rent reminder. Your outstanding rent balance is '+moneyLocal(x.balance)+'. Please contact your landlord if you need to discuss payment.');
        html+='<div class="mavAiSummary"><b>'+escLocal(name)+'</b><br>Outstanding: '+moneyLocal(x.balance)+
          '<div class="mavAiConfirm">'+
          (phone?'<a class="ok" style="display:grid;place-items:center;text-decoration:none" href="tel:'+escLocal(phone)+'">📞 Call</a>':'')+
          (wa?'<a class="ok" style="display:grid;place-items:center;text-decoration:none" target="_blank" href="https://wa.me/'+escLocal(wa)+'?text='+text+'">💬 WhatsApp</a>':'')+
          (phone?'<a class="cancel" style="display:grid;place-items:center;text-decoration:none" href="sms:'+escLocal(phone)+'?body='+text+'">✉️ SMS</a>':'')+
          '</div></div>';
      });
      panel(html);
    }

    function detectLocalAction(q){
      const s=q.trim(),l=s.toLowerCase();
      if(/\b(assign|add|register)\b.*\btenant\b/.test(l)||/\bassign\b/.test(l)){
        const tenant=(s.match(/(?:tenant\s+)?([A-Za-z][A-Za-z .'-]{1,50}?)(?=\s+to\s+|\s+in\s+|\s+at\s+)/i)||[])[1]||'';
        const unit=(s.match(/(?:room|unit)\s*([A-Za-z0-9-]+)/i)||[])[1]||'';
        const rent=Number(((s.match(/(?:monthly\s+rent|rent)\s*(?:is|=|of)?\s*(?:ugx\s*)?([0-9,]+)/i)||[])[1]||'0').replace(/,/g,''));
        const dep=Number(((s.match(/(?:deposit)\s*(?:is|=|of)?\s*(?:ugx\s*)?([0-9,]+)/i)||[])[1]||'0').replace(/,/g,''));
        const due=Number(((s.match(/(?:due\s+day|due\s+on)\s*(?:is|=|of)?\s*(\d{1,2})/i)||[])[1]||'1'));
        const advance=Number(((s.match(/(?:advance|initial)\s*(?:of|for)?\s*(\d+)\s*month/i)||[])[1]||'3'));
        return {type:'assign_tenant',tenant_name:tenant,unit_number:unit,monthly_rent:rent,deposit_amount:dep,rent_due_day:due,initial_advance_months:advance};
      }
      if(/\b(create|make|generate)\b.*\breceipt\b/.test(l))return {type:'create_receipt'};
      return null;
    }

    async function ask(){
      const question=input.value.trim();if(!question)return;
      addMessage(question,'user');input.value='';
      const action=detectLocalAction(question);
      if(action){
        if(action.type==='assign_tenant'){addMessage('I understood this as a tenant assignment. I will prepare it for your final confirmation.','bot');await showAddTenant(action);return;}
        if(action.type==='create_receipt'){addMessage('I understood this as a receipt request. I will prepare it for your final confirmation.','bot');await showReceipt();return;}
      }
      send.disabled=true;send.textContent='...';
      try{
        const token=await session();
        const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({message:question})});
        const data=await r.json().catch(function(){return {};});
        if(!r.ok)throw new Error(data.error||'MavRent AI request failed.');
        addMessage(data.answer||'No answer returned.','bot');
      }catch(e){addMessage('AI error: '+(e.message||'Unknown error'),'bot');}
      finally{send.disabled=false;send.textContent='Send';input.focus();}
    }

    document.getElementById('mavAiAddTenant').onclick=function(){showAddTenant();};
    document.getElementById('mavAiReceipt').onclick=function(){showReceipt();};
    document.getElementById('mavAiOverdue').onclick=function(){input.value='Who is overdue?';ask();};
    document.getElementById('mavAiMaintenance').onclick=function(){input.value='Show open maintenance.';ask();};
    document.getElementById('mavAiBrief').onclick=dailyBrief;
    document.getElementById('mavAiContact').onclick=contactOverdue;
    send.onclick=ask;
    input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask();}});

    function syncVisibility(){
      const app=document.getElementById('app');
      button.classList.toggle('show',!!app&&!app.classList.contains('hidden'));
    }
    syncVisibility();
    setInterval(syncVisibility,500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();