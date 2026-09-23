/* MavRent AI Assistant V2 — AI + landlord-confirmed actions */
(() => {
  const STYLE = `
    #mavAiButton{position:fixed;right:18px;bottom:22px;z-index:260;border:0;border-radius:999px;padding:13px 17px;background:linear-gradient(135deg,#087cff,#00b8ff);color:#fff;font-weight:900;box-shadow:0 14px 35px #087cff55}
    #mavAiModal{position:fixed;inset:0;z-index:1000;display:none;background:#0008;align-items:center;justify-content:center;padding:15px}
    #mavAiModal.open{display:flex}
    .mavAiBox{width:min(680px,100%);height:min(820px,94vh);background:#fff;border-radius:20px;box-shadow:0 25px 90px #0006;display:flex;flex-direction:column;overflow:hidden}
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
    .mavAiActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
    .mavAiAction{border:1px solid #d9dde3;background:#fff;border-radius:12px;padding:11px;text-align:left;font-weight:800}
    .mavAiAction:hover{border-color:#087cff;background:#eff6ff}
    .mavAiPanel{background:#fff;border:1px solid #dfe4ea;border-radius:14px;padding:14px;margin-bottom:12px}
    .mavAiPanel h3{margin:0 0 10px}.mavAiPanel label{display:block;color:#4b5563;font-size:12px;margin:8px 0 5px}
    .mavAiPanel input,.mavAiPanel select{width:100%;padding:11px;border:1px solid #d9dde3;border-radius:10px;background:#fff;color:#111827}
    .mavAiGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .mavAiConfirm{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .mavAiConfirm button{border:0;border-radius:10px;padding:11px;font-weight:900}
    .mavAiConfirm .ok{background:#087cff;color:#fff}.mavAiConfirm .cancel{background:#eef1f5;color:#111827}
    .mavAiSummary{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:11px;margin-top:10px;font-size:13px;line-height:1.6}
    @media(max-width:600px){.mavAiActions,.mavAiGrid,.mavAiConfirm{grid-template-columns:1fr}.mavAiBox{height:96vh}}
  `;

  function boot(){
    if(document.getElementById('mavAiButton'))return;
    const style=document.createElement('style');style.textContent=STYLE;document.head.appendChild(style);

    const button=document.createElement('button');
    button.id='mavAiButton';button.type='button';button.textContent='✨ MavRent AI';document.body.appendChild(button);

    const modal=document.createElement('div');
    modal.id='mavAiModal';
    modal.innerHTML=`
      <div class="mavAiBox">
        <div class="mavAiHead">
          <div><strong>✨ MavRent AI</strong><small>Assistant + landlord-confirmed actions</small></div>
          <button class="mavAiClose" type="button">✕</button>
        </div>
        <div class="mavAiMessages" id="mavAiMessages">
          <div class="mavAiMsg bot">Hi. I can read your MavRent data and help you perform rental-management actions. I will show you the details and ask for your final confirmation before important changes.</div>
          <div class="mavAiActions">
            <button class="mavAiAction" id="mavAiAddTenant">👤 Assign new tenant</button>
            <button class="mavAiAction" id="mavAiReceipt">🧾 Create receipt</button>
          </div>
        </div>
        <div class="mavAiHint">Try: “Who is overdue?” · “How much is outstanding?” · “Show open maintenance.”</div>
        <div class="mavAiComposer">
          <textarea id="mavAiInput" placeholder="Ask MavRent AI..." maxlength="4000"></textarea>
          <button class="mavAiSend" id="mavAiSend" type="button">Send</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close=()=>modal.classList.remove('open');
    button.onclick=()=>{modal.classList.add('open');};
    modal.querySelector('.mavAiClose').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});

    const messages=document.getElementById('mavAiMessages');
    const input=document.getElementById('mavAiInput');
    const send=document.getElementById('mavAiSend');

    function addMessage(text,who){
      const el=document.createElement('div');el.className='mavAiMsg '+who;el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;
    }
    function panel(html){
      const el=document.createElement('div');el.className='mavAiPanel';el.innerHTML=html;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;return el;
    }
    async function session(){
      if(typeof ensureSupabase==='function')await ensureSupabase();
      if(!window.sb?.auth)throw new Error('MavRent login service is not ready.');
      const s=await sb.auth.getSession();const token=s?.data?.session?.access_token;
      if(!token)throw new Error('Please log in to MavRent first.');return token;
    }

    function landlordOnly(){
      if(typeof role!=='undefined'&&role!=='landlord'){addMessage('This action is available to landlords only.','bot');return false}return true;
    }

    async function showAddTenant(seed={}){
      if(!landlordOnly())return;
      try{await session();}catch(e){addMessage(e.message,'bot');return;}
      if(!window.cache?.registeredTenants?.length){addMessage('There are no registered tenant accounts available to assign yet. Create a tenant account first.','bot');return;}
      const vacant=(window.cache.units||[]).filter(u=>u.status!=='occupied');
      if(!vacant.length){addMessage('There are no vacant units available right now.','bot');return;}

      const p=panel(`
        <h3>👤 Prepare tenant assignment</h3>
        <div class="mavAiGrid">
          <div><label>Registered tenant</label><select id="aiTProfile">${cache.registeredTenants.map(x=>`<option value="${x.id}">${esc(x.full_name||x.email)} — ${esc(x.email||'')}</option>`).join('')}</select></div>
          <div><label>Vacant unit</label><select id="aiTUnit">${vacant.map(x=>`<option value="${x.id}">${esc(x.unit_number)} — ${money(x.monthly_rent)}</option>`).join('')}</select></div>
          <div><label>Monthly rent (UGX)</label><input id="aiTRent" type="number" min="1"></div>
          <div><label>Deposit (UGX)</label><input id="aiTDeposit" type="number" min="0" value="0"></div>
          <div><label>Rent due day</label><input id="aiTDue" type="number" min="1" max="28" value="1"></div>
          <div><label>Move-in date</label><input id="aiTMove" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        </div>
        <label>Initial rent schedule</label>
        <select id="aiTAdvance"><option value="1">1 month</option><option value="3" selected>3 months</option><option value="4">4 months</option></select>
        <div class="mavAiConfirm"><button class="ok" id="aiPrepareConfirm">Review assignment</button><button class="cancel" id="aiCancel">Cancel</button></div>`);
      const unit=vacant.find(u=>seed.unit_number && String(u.unit_number).toLowerCase()===String(seed.unit_number).toLowerCase()) || vacant[0];\n      const profSeed=seed.tenant_name ? cache.registeredTenants.find(x=>String(x.full_name||x.email||'').toLowerCase().includes(String(seed.tenant_name).toLowerCase())) : null;\n      if(profSeed) document.getElementById('aiTProfile').value=profSeed.id;\n      document.getElementById('aiTUnit').value=unit.id;\n      document.getElementById('aiTRent').value=seed.monthly_rent || unit.monthly_rent || 0;\n      document.getElementById('aiTDeposit').value=seed.deposit_amount || 0;\n      document.getElementById('aiTDue').value=seed.rent_due_day || 1;\n      document.getElementById('aiTMove').value=seed.move_in_date || new Date().toISOString().slice(0,10);\n      document.getElementById('aiTAdvance').value=seed.initial_advance_months || 3;
      p.querySelector('#aiCancel').onclick=()=>p.remove();
      p.querySelector('#aiPrepareConfirm').onclick=()=>reviewTenant(p);
    }

    function reviewTenant(p){
      const profileId=p.querySelector('#aiTProfile').value,unitId=p.querySelector('#aiTUnit').value,rent=Number(p.querySelector('#aiTRent').value||0),deposit=Number(p.querySelector('#aiTDeposit').value||0),due=Number(p.querySelector('#aiTDue').value||1),move=p.querySelector('#aiTMove').value,advance=Number(p.querySelector('#aiTAdvance').value||3);
      const prof=cache.registeredTenants.find(x=>x.id===profileId),unit=cache.units.find(x=>x.id===unitId);
      if(!profileId||!unitId||rent<=0||!move)return alert('Complete the tenant, unit, rent and move-in date.');
      p.innerHTML=`<h3>🔐 Final confirmation</h3><div class="mavAiSummary"><b>Tenant:</b> ${esc(prof?.full_name||prof?.email||'Tenant')}<br><b>Unit:</b> ${esc(unit?.unit_number||'—')}<br><b>Monthly rent:</b> ${money(rent)}<br><b>Deposit:</b> ${money(deposit)}<br><b>Due day:</b> ${due}<br><b>Move-in:</b> ${esc(move)}<br><b>Initial schedule:</b> ${advance} month(s)</div><div class="mavAiConfirm"><button class="ok" id="aiFinalConfirm">✓ Confirm & Assign</button><button class="cancel" id="aiFinalCancel">Cancel</button></div>`;
      p.querySelector('#aiFinalCancel').onclick=()=>p.remove();
      p.querySelector('#aiFinalConfirm').onclick=async()=>{
        const b=p.querySelector('#aiFinalConfirm');b.disabled=true;b.textContent='Assigning...';
        try{
          const r=await sb.from('tenants').insert({landlord_id:user.id,profile_id:profileId,unit_id:unitId,rent_amount:rent,deposit_amount:deposit,rent_due_day:due,move_in_date:move,status:'active'}).select('*').single();
          if(r.error)throw r.error;
          const u=await sb.from('units').update({status:'occupied'}).eq('id',unitId).eq('landlord_id',user.id);
          if(u.error)throw u.error;
          if(typeof generateRentForTenant==='function'){
            const gen=await generateRentForTenant(r.data.id,Math.max(12,advance));
            if(!gen.ok)throw new Error(gen.error?.message||'Rent schedule generation failed.');
          }
          p.remove();addMessage('✅ Tenant assigned successfully. The unit is now occupied and the rent schedule has been prepared.','bot');
          if(typeof refresh==='function')await refresh();
          if(typeof show==='function')await show('tenants',false);
        }catch(e){b.disabled=false;b.textContent='✓ Confirm & Assign';addMessage('Action failed: '+(e.message||e),'bot');}
      };
    }

    async function showReceipt(){
      if(!landlordOnly())return;
      try{await session();}catch(e){addMessage(e.message,'bot');return;}
      const confirmed=(window.cache?.payments||[]).filter(p=>p.status==='confirmed');
      if(!confirmed.length){addMessage('There are no confirmed payments available for a receipt.','bot');return;}
      const p=panel(`<h3>🧾 Prepare receipt</h3><label>Confirmed payment</label><select id="aiReceiptPayment">${confirmed.map(x=>{const t=cache.tenants.find(t=>t.id===x.tenant_id);const prof=cache.registeredTenants.find(pr=>pr.id===t?.profile_id);return `<option value="${x.id}">${esc(prof?.full_name||prof?.email||'Tenant')} — ${money(x.amount)} — ${esc(x.payment_date||'')}</option>`;}).join('')}</select><div class="mavAiConfirm"><button class="ok" id="aiReceiptReview">Review</button><button class="cancel" id="aiReceiptCancel">Cancel</button></div>`);
      p.querySelector('#aiReceiptCancel').onclick=()=>p.remove();
      p.querySelector('#aiReceiptReview').onclick=async()=>{
        const id=p.querySelector('#aiReceiptPayment').value,pay=cache.payments.find(x=>x.id===id),t=cache.tenants.find(x=>x.id===pay?.tenant_id),prof=cache.registeredTenants.find(x=>x.id===t?.profile_id);
        p.innerHTML=`<h3>🔐 Final confirmation</h3><div class="mavAiSummary"><b>Tenant:</b> ${esc(prof?.full_name||prof?.email||'Tenant')}<br><b>Amount:</b> ${money(pay?.amount)}<br><b>Payment date:</b> ${esc(pay?.payment_date||'—')}<br><b>Method:</b> ${esc(pay?.payment_method||'—')}</div><div class="mavAiConfirm"><button class="ok" id="aiReceiptConfirm">✓ Create receipt</button><button class="cancel" id="aiReceiptFinalCancel">Cancel</button></div>`;
        p.querySelector('#aiReceiptFinalCancel').onclick=()=>p.remove();
        p.querySelector('#aiReceiptConfirm').onclick=async()=>{
          const b=p.querySelector('#aiReceiptConfirm');b.disabled=true;b.textContent='Creating...';
          try{
            if(typeof createAutomaticReceiptForPayment!=='function')throw new Error('Receipt function is not available.');
            const out=await createAutomaticReceiptForPayment(pay);if(!out.ok)throw out.error||new Error('Receipt could not be created.');
            p.remove();addMessage('🧾 Receipt created: '+(out.data?.receipt_number||'MavRent receipt'),'bot');
            if(typeof refresh==='function')await refresh();
          }catch(e){b.disabled=false;b.textContent='✓ Create receipt';addMessage('Receipt failed: '+(e.message||e),'bot');}
        };
      };
    }

    function detectLocalAction(q){\n      const s=q.trim(); const l=s.toLowerCase();\n      if(/\\b(assign|add|register)\\b.*\\btenant\\b/.test(l)||/\\bassign\\b/.test(l)){\n        const tenant=(s.match(/(?:tenant\\s+)?([A-Za-z][A-Za-z .'-]{1,50}?)(?=\\s+to\\s+|\\s+in\\s+|\\s+at\\s+)/i)||[])[1]||'';\n        const unit=(s.match(/(?:room|unit)\\s*([A-Za-z0-9-]+)/i)||[])[1]||'';\n        const rent=Number(((s.match(/(?:rent|monthly rent)\\s*(?:is|=|of)?\\s*(?:ugx\\s*)?([0-9,]+)/i)||[])[1]||'0').replace(/,/g,''));\n        const dep=Number(((s.match(/(?:deposit)\\s*(?:is|=|of)?\\s*(?:ugx\\s*)?([0-9,]+)/i)||[])[1]||'0').replace(/,/g,''));\n        const due=Number(((s.match(/(?:due day|due on)\\s*(?:is|=|of)?\\s*(\\d{1,2})/i)||[])[1]||'1'));\n        const advance=Number(((s.match(/(?:advance|initial)\\s*(?:of|for)?\\s*(\\d+)\\s*month/i)||[])[1]||'3'));\n        return {type:'assign_tenant',tenant_name:tenant,unit_number:unit,monthly_rent:rent,deposit_amount:dep,rent_due_day:due,initial_advance_months:advance};\n      }\n      if(/\\b(create|make|generate)\\b.*\\breceipt\\b/.test(l)) return {type:'create_receipt'};\n      if(/\\b(remind|reminder)\\b.*\\boverdue\\b/.test(l)) return {type:'send_reminder',target:'overdue'};\n      return null;\n    }\n\n    async function ask(){
      const question=input.value.trim();if(!question)return;
      addMessage(question,'user');input.value='';\n      const localAction=detectLocalAction(question);\n      if(localAction){\n        if(localAction.type==='assign_tenant'){addMessage('I understood this as a tenant assignment. I will prepare it for your final confirmation.','bot');await showAddTenant(localAction);return;}\n        if(localAction.type==='create_receipt'){addMessage('I understood this as a receipt request. I will prepare it for your final confirmation.','bot');await showReceipt();return;}\n        if(localAction.type==='send_reminder'){addMessage('I understood this as an overdue reminder request. Reminder sending will be the next communication upgrade.','bot');return;}\n      }\n      send.disabled=true;send.textContent='...';
      try{
        const token=await session();
        const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({message:question})});
        const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'MavRent AI request failed.');
        addMessage(data.answer||'No answer returned.','bot');
      }catch(e){addMessage('AI error: '+(e.message||'Unknown error'),'bot');}
      finally{send.disabled=false;send.textContent='Send';input.focus();}
    }

    document.getElementById('mavAiAddTenant').onclick=showAddTenant;
    document.getElementById('mavAiReceipt').onclick=showReceipt;
    send.onclick=ask;
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask();}});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();