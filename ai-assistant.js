/* Mav AI Assistant V3 — visible AI + confirmed actions */
(function(){
  const STYLE = `
    #mavAiButton{position:fixed;right:20px;bottom:88px;z-index:260;border:0;border-radius:999px;padding:12px 18px;background:linear-gradient(135deg,#0284c7,#0ea5e9);color:#fff;font-weight:800;font-size:14px;box-shadow:0 10px 25px rgba(2,132,199,0.35);display:none;align-items:center;gap:7px;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}
    #mavAiButton:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(2,132,199,0.45)}
    #mavAiButton.show{display:inline-flex}
    #mavAiModal{position:fixed;inset:0;z-index:1000;display:none;background:rgba(15,23,42,0.65);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:16px}
    #mavAiModal.open{display:flex}
    .mavAiBox{width:min(680px,100%);height:min(780px,92vh);background:#ffffff;border:1px solid #e2e8f0;border-radius:22px;box-shadow:0 25px 60px -15px rgba(15,23,42,0.25);display:flex;flex-direction:column;overflow:hidden;transition:background-color .25s ease,border-color .25s ease}
    .mavAiHead{padding:14px 18px;background:#0c182c;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #1e293b}
    .mavAiHeadTitle strong{font-size:16px;letter-spacing:-.01em;display:flex;align-items:center;gap:6px}
    .mavAiHeadTitle small{display:block;color:#94a3b8;font-size:11px;margin-top:2px}
    .mavAiHeadActions{display:flex;align-items:center;gap:8px}
    .mavAiVoiceSelect{background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:9px;padding:6px 9px;font-size:11px;font-weight:700;outline:0;cursor:pointer}
    .mavAiVoiceSelect:focus{border-color:#38bdf8}
    .mavAiClose{border:0;background:#1e293b;color:#94a3b8;border-radius:9px;padding:7px 11px;font-weight:800;cursor:pointer;transition:color .15s,background .15s}
    .mavAiClose:hover{color:#fff;background:#334155}
    .mavAiMessages{flex:1;overflow:auto;padding:16px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}
    .mavAiMsg{max-width:88%;padding:11px 14px;border-radius:16px;line-height:1.5;font-size:13.5px;white-space:pre-wrap;word-break:break-word}
    .mavAiMsg.bot{background:#ffffff;color:#0f172a;border:1px solid #e2e8f0;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(15,23,42,0.04)}
    .mavAiMsg.user{margin-left:auto;background:#0284c7;color:#fff;border-bottom-right-radius:4px}
    .mavAiSuggestionsSection{padding:0 14px 10px;background:#f8fafc}
    .mavAiSuggestionsTitle{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:6px}
    .mavAiSuggestionsGrid{display:flex;flex-wrap:wrap;gap:6px}
    .mavAiChip{border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;border-radius:999px;padding:6px 11px;font-size:11.5px;font-weight:700;cursor:pointer;transition:border-color .15s,background .15s}
    .mavAiChip:hover{border-color:#0284c7;background:#f0f9ff;color:#0369a1}
    .mavAiComposer{padding:12px 14px;border-top:1px solid #e2e8f0;background:#fff;display:flex;align-items:flex-end;gap:8px}
    .mavAiComposer textarea{flex:1;resize:none;min-height:44px;max-height:110px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:12px;font:inherit;font-size:13.5px;outline:0;transition:border-color .2s}
    .mavAiComposer textarea:focus{border-color:#0284c7;box-shadow:0 0 0 3px rgba(2,132,199,0.12)}
    .mavAiSend{border:0;border-radius:12px;padding:10px 16px;background:#0c182c;color:#fff;font-weight:800;font-size:13px;cursor:pointer;transition:background .2s}
    .mavAiSend:hover{background:#0284c7}
    .mavAiMic{border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;background:#f8fafc;color:#0f172a;font-weight:800;cursor:pointer;transition:.2s}
    .mavAiMic.listening{background:#fee2e2;color:#991b1b;border-color:#fca5a5;animation:mavAiPulse 1.2s infinite}
    .mavAiVoiceState{font-size:11px;color:#64748b;padding:0 14px 6px;min-height:16px;background:#fff}
    .mavAiTools{display:flex;gap:6px;flex-wrap:wrap;padding:6px 14px 8px;background:#fff;border-top:1px solid #f1f5f9}
    .mavAiTool{border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;border-radius:9px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer}
    .mavAiTool:hover{border-color:#0284c7;background:#f0f9ff}
    .mavAiPanel{background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin:8px 0}
    .mavAiSummary{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:11px;margin-top:8px;font-size:12.5px;line-height:1.55}
    .mavAiConfirm{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .mavAiConfirm button{border:0;border-radius:10px;padding:10px;font-weight:800;font-size:12.5px;cursor:pointer}
    .mavAiConfirm .ok{background:#0284c7;color:#fff}.mavAiConfirm .cancel{background:#f1f5f9;color:#0f172a}
    @keyframes mavAiPulse{50%{transform:scale(1.04);box-shadow:0 0 0 6px rgba(239,68,68,0.18)}}

    /* CARE MODE ACTIVE — MAV AI ADAPTATION */
    body.care-mode-active .mavAiBox{background:#0c1527;border-color:#1a2947;box-shadow:0 25px 60px -15px rgba(0,0,0,0.6)}
    body.care-mode-active .mavAiHead{background:#050a12;border-color:#1a2947}
    body.care-mode-active .mavAiMessages{background:#070d18}
    body.care-mode-active .mavAiMsg.bot{background:#0f1c33;border-color:#1a2a46;color:#f1f5f9;box-shadow:none}
    body.care-mode-active .mavAiSuggestionsSection{background:#070d18}
    body.care-mode-active .mavAiSuggestionsTitle{color:#94a3b8}
    body.care-mode-active .mavAiChip{background:#0c1527;border-color:#1a2947;color:#38bdf8}
    body.care-mode-active .mavAiChip:hover{background:#101e38;border-color:#38bdf8;color:#7dd3fc}
    body.care-mode-active .mavAiComposer{background:#0c1527;border-color:#1a2947}
    body.care-mode-active .mavAiComposer textarea{background:#070e1c;border-color:#1e3256;color:#f8fafc}
    body.care-mode-active .mavAiComposer textarea:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,0.15)}
    body.care-mode-active .mavAiSend{background:#0284c7}
    body.care-mode-active .mavAiMic{background:#101c34;border-color:#1e3256;color:#f1f5f9}
    body.care-mode-active .mavAiVoiceState{background:#0c1527;color:#94a3b8}
    body.care-mode-active .mavAiTools{background:#0c1527;border-color:#1a2947}
    body.care-mode-active .mavAiTool{background:#101c34;border-color:#1e3256;color:#f1f5f9}
    body.care-mode-active .mavAiTool:hover{border-color:#38bdf8;color:#38bdf8}
    body.care-mode-active .mavAiPanel{background:#0f1c33;border-color:#1a2a46;color:#f1f5f9}
    body.care-mode-active .mavAiSummary{background:#070e1c;border-color:#1a2a46;color:#cbd5e1}
    body.care-mode-active .mavAiConfirm .cancel{background:#101c34;color:#f1f5f9}

    @media(max-width:600px){
      .mavAiBox{height:96vh;border-radius:18px}
      #mavAiButton{right:14px;bottom:76px;padding:10px 15px;font-size:13px}
      .mavAiHeadTitle small{display:none}
      .mavAiConfirm{grid-template-columns:1fr}
    }
  `;


  function boot(){
    if(document.getElementById('mavAiButton'))return;

    const style=document.createElement('style');
    style.textContent=STYLE;
    document.head.appendChild(style);

    const button=document.createElement('button');
    button.id='mavAiButton';
    button.setAttribute('aria-label','Open Mav AI');
    button.type='button';
    button.innerHTML='<span>✨</span><span>Mav AI</span>';
    document.body.appendChild(button);

    const modal=document.createElement('div');
    modal.id='mavAiModal';
    modal.innerHTML=
      '<div class="mavAiBox" role="dialog" aria-modal="true" aria-label="Mav AI Assistant">'+
        '<div class="mavAiHead">'+
          '<div class="mavAiHeadTitle"><strong>✨ Mav AI</strong><small>Rental Management Assistant</small></div>'+
          '<div class="mavAiHeadActions">'+
            '<select id="mavAiVoiceMode" class="mavAiVoiceSelect" aria-label="Mav AI Voice Settings">'+
              '<option value="calm_male">🎙️ Calm Male</option>'+
              '<option value="natural_male">🎙️ Natural Male</option>'+
              '<option value="system_default">🎙️ System Default</option>'+
              '<option value="off">🔇 Voice Off</option>'+
            '</select>'+
            '<button class="mavAiClose" type="button" aria-label="Close Mav AI">✕</button>'+
          '</div>'+
        '</div>'+
        '<div class="mavAiMessages" id="mavAiMessages">'+
          '<div class="mavAiMsg bot">Hi. I am Mav AI, your rental management assistant. How can I help you today?</div>'+
        '</div>'+
        '<div class="mavAiSuggestionsSection">'+
          '<div class="mavAiSuggestionsTitle">Suggested prompts</div>'+
          '<div class="mavAiSuggestionsGrid" id="mavAiSuggestions"></div>'+
        '</div>'+
        '<div class="mavAiTools" id="mavAiTools"><button class="mavAiTool" id="mavAiOps" type="button">🧠 Operations Center</button><button class="mavAiTool" id="mavAiAuto" type="button">🟢 Care Mode</button><button class="mavAiTool" id="mavAiCareTasks" type="button">🛡️ Approval Center</button><button class="mavAiTool" id="mavAiAudit" type="button">🧾 AI activity</button></div>'+
        '<div class="mavAiVoiceState" id="mavAiVoiceState"></div>'+
        '<div class="mavAiComposer"><textarea id="mavAiInput" placeholder="Ask Mav AI..." maxlength="4000" aria-label="Ask Mav AI"></textarea><button class="mavAiMic" id="mavAiMic" type="button" title="Talk to Mav AI" aria-label="Voice input">🎤</button><button class="mavAiSend" id="mavAiSend" type="button" aria-label="Send message">Send</button></div>'+
      '</div>';
    document.body.appendChild(modal);

    const messages=document.getElementById('mavAiMessages');
    const input=document.getElementById('mavAiInput');
    const send=document.getElementById('mavAiSend');
    const mic=document.getElementById('mavAiMic');
    const voiceSelect=document.getElementById('mavAiVoiceMode');
    const voiceState=document.getElementById('mavAiVoiceState');
    const opsBtn=document.getElementById('mavAiOps');
    const autoBtn=document.getElementById('mavAiAuto');
    const auditBtn=document.getElementById('mavAiAudit');
    const careTasksBtn=document.getElementById('mavAiCareTasks');
    const suggestionsGrid=document.getElementById('mavAiSuggestions');
    const toolsBar=document.getElementById('mavAiTools');

    const close=function(){modal.classList.remove('open');stopSpeaking();};
    if(button)button.onclick=function(){modal.classList.add('open');configureRoleUI();setTimeout(function(){if(input)input.focus();},80);};
    const closeBtn=modal.querySelector('.mavAiClose');
    if(closeBtn)closeBtn.onclick=close;
    modal.addEventListener('click',function(e){if(e.target===modal)close();});

    function addMessage(text,who){
      const el=document.createElement('div');
      el.className='mavAiMsg '+who;
      el.textContent=String(text||'');
      messages.appendChild(el);
      messages.scrollTop=messages.scrollHeight;
      if(who==='bot' && voiceMode!=='off' && String(text||'').trim() && !String(text).startsWith('Hi. I am Mav AI')) speak(text);
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
      try{
        const client = typeof ensureSupabase==='function'
          ? await ensureSupabase()
          : (typeof sb!=='undefined' ? sb : null);
        if(!client || !client.auth) throw new Error('MavRent authentication is still loading. Please wait a moment and try again.');
        const s=await client.auth.getSession();
        const token=s&&s.data&&s.data.session&&s.data.session.access_token;
        if(!token)throw new Error('Your MavRent session has expired. Please log in again.');
        return token;
      }catch(e){
        throw new Error(e&&e.message?e.message:'MavRent authentication is not ready.');
      }
    }

    function landlordOnly(){
      return typeof role!=='undefined' && role==='landlord';
    }

    function tenantOnly(){
      return typeof role!=='undefined' && role==='tenant';
    }

    function aiAudit(action,status,details){
      try{
        const key='mavrent_ai_audit_'+(user&&user.id||'session');
        const rows=JSON.parse(localStorage.getItem(key)||'[]');
        rows.unshift({time:new Date().toISOString(),action,status,details:String(details||'')});
        localStorage.setItem(key,JSON.stringify(rows.slice(0,100)));
      }catch(e){}
    }

    async function showAudit(){
      try{
        const client=currentClient() || await ensureSupabase();
        const r=await client.from('ai_audit_log').select('*').order('created_at',{ascending:false}).limit(30);
        if(!r.error&&Array.isArray(r.data)&&r.data.length){
          const text=r.data.map(function(x){
            const d=new Date(x.created_at);
            const icon=x.status==='confirmed'||x.status==='executed'?'✅':(x.status==='failed'||x.status==='denied'?'❌':'🟡');
            const details=x.details&&typeof x.details==='object'?JSON.stringify(x.details):String(x.details||'');
            return d.toLocaleString()+'\n'+icon+' '+x.action+' — '+x.status+(details?'\n'+details:'');
          }).join('\n\n');
          addMessage('🧾 SERVER AI AUDIT LOG\n\n'+text,'bot');
          return;
        }
      }catch(e){console.warn('Server AI audit log:',e);}
      const key='mavrent_ai_audit_'+(user&&user.id||'session');
      let rows=[];
      try{rows=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){}
      if(!rows.length){addMessage('🧾 No AI activity has been recorded yet.','bot');return;}
      addMessage('🧾 LOCAL AI ACTIVITY\n\n'+rows.slice(0,20).map(function(x){
        return new Date(x.time).toLocaleString()+'\n'+(x.status==='confirmed'?'✅':'🟡')+' '+x.action+(x.details?'\n'+x.details:'');
      }).join('\n\n'),'bot');
    }

    async function setCareMode(){
      if(!landlordOnly()){addMessage('Care Mode is a landlord control. Your tenant AI remains personal and does not expose landlord controls.','bot');return;}
      try{
        const token=await session();
        const current=await fetch('/api/care-mode',{method:'GET',headers:{'Authorization':'Bearer '+token}});
        const currentData=await current.json().catch(function(){return {};});
        if(!current.ok)throw new Error(currentData.error||'Could not read Care Mode.');
        const enabled=currentData.enabled===true;
        const next=!enabled;
        const r=await fetch('/api/care-mode',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({enabled:next,settings:currentData.settings||{}})});
        const data=await r.json().catch(function(){return {};});
        if(!r.ok)throw new Error(data.error||'Could not update Care Mode.');
        addMessage(next
          ? '🟢 MavRent Care Mode is ON. Routine monitoring and reminder tasks can be prepared automatically. Financial, tenant, property and irreversible changes still require your confirmation.'
          : '⚪ MavRent Care Mode is now OFF.','bot');
        if(typeof window.updateCareModeVisuals==='function') window.updateCareModeVisuals(next);
      }catch(e){addMessage('Care Mode error: '+(e.message||e),'bot');}
    }

    async function approveAllCareTasks(tasks){
      const routine=(tasks||[]).filter(t=>['rent_reminder','maintenance_followup'].includes(t.task_type));
      const blocked=(tasks||[]).filter(t=>!['rent_reminder','maintenance_followup'].includes(t.task_type));
      const summary='MavRent will execute '+routine.length+' routine task'+(routine.length===1?'':'s')+
        ' now.'+(blocked.length?' '+blocked.length+' other task'+(blocked.length===1?'':'s')+' will remain blocked for individual confirmation.':'')+
        '\n\nRoutine actions:\n'+routine.map(t=>'• '+(t.title||t.task_type)).join('\n');
      const p=panel('<h3>🛡️ Approve routine actions</h3><div class="mavAiSummary">'+escLocal(summary).replace(/\n/g,'<br>')+'</div><div class="mavAiConfirm"><button class="ok" id="aiBulkConfirm">✓ Approve all</button><button class="cancel" id="aiBulkCancel">Cancel</button></div>');
      p.querySelector('#aiBulkCancel').onclick=()=>p.remove();
      p.querySelector('#aiBulkConfirm').onclick=async function(){
        const b=this;b.disabled=true;b.textContent='Executing...';
        try{
          const token=await session();
          const rr=await fetch('/api/care-tasks',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({decision:'approve_all'})});
          const d=await rr.json().catch(()=>({}));
          if(!rr.ok)throw new Error(d.error||'Bulk approval failed.');
          p.remove();
          addMessage('🛡️ Care Mode execution complete.\n\n✓ Executed: '+(d.executed||0)+'\n✕ Failed: '+(d.failed||0)+'\n⚠️ Blocked for individual confirmation: '+(d.blocked||0),'bot');
          aiAudit('Care tasks bulk','executed','Executed '+(d.executed||0)+' routine tasks');
          careTasksCenter();
        }catch(e){b.disabled=false;b.textContent='✓ Approve all';addMessage('Care Mode bulk execution failed: '+(e.message||e),'bot');}
      };
    }

    function careTasksCenter(){
      if(!landlordOnly())return;
      (async function(){
        try{
          const token=await session();
          const r=await fetch('/api/care-tasks',{headers:{'Authorization':'Bearer '+token}});
          const data=await r.json().catch(function(){return {};});
          if(!r.ok)throw new Error(data.error||'Could not load Care Tasks.');
          const tasks=Array.isArray(data.tasks)?data.tasks:[];
          if(!tasks.length){addMessage('🛡️ CARE MODE\n\nNo prepared Care Mode tasks are waiting for you.','bot');return;}
          const routine=tasks.filter(t=>['rent_reminder','maintenance_followup'].includes(t.task_type));
          const blocked=tasks.length-routine.length;
          const html='<h3>🛡️ Care Mode — '+tasks.length+' prepared task'+(tasks.length===1?'':'s')+'</h3>'+
            '<div class="mavAiSummary">Routine tasks can be grouped. Financial or irreversible actions remain individually protected.</div>'+
            (routine.length?'<button class="mavAiBulk" id="aiApproveAll">✓ Approve all routine tasks ('+routine.length+')</button>':'')+
            (blocked?'<div class="mavAiSummary">⚠️ '+blocked+' task'+(blocked===1?'':'s')+' require individual confirmation.</div>':'')+
            tasks.map(function(t){
              const payload=t.payload||{};
              return '<div class="mavAiTask" data-id="'+escLocal(t.id)+'" style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:10px 0">'+
                '<b>'+escLocal(t.title||'Care task')+'</b><br><small>'+escLocal(t.message||'')+'</small>'+
                (payload.balance?'<br><b>Balance:</b> '+moneyLocal(payload.balance):'')+
                '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn success careApprove" data-id="'+escLocal(t.id)+'">✓ Approve</button><button class="btn careSkip" data-id="'+escLocal(t.id)+'">Skip</button></div></div>';
            }).join('');
          const p=panel(html);
          const bulk=p.querySelector('#aiApproveAll');
          if(bulk)bulk.onclick=function(){approveAllCareTasks(tasks);};
          p.querySelectorAll('.careApprove').forEach(function(btn){
            btn.onclick=async function(){
              btn.disabled=true;btn.textContent='Approving...';
              try{
                const token=await session();
                const rr=await fetch('/api/care-tasks',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({task_id:btn.dataset.id,decision:'approve'})});
                const d=await rr.json().catch(function(){return {};});
                if(!rr.ok)throw new Error(d.error||'Task could not be approved.');
                btn.closest('.mavAiTask').remove();
                addMessage('✅ Care task approved and executed. '+(d.message||''),'bot');
                aiAudit('Care task','confirmed',btn.dataset.id);
              }catch(e){btn.disabled=false;btn.textContent='✓ Approve';addMessage('Care task failed: '+(e.message||e),'bot');}
            };
          });
          p.querySelectorAll('.careSkip').forEach(function(btn){
            btn.onclick=async function(){
              try{
                const token=await session();
                const rr=await fetch('/api/care-tasks',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({task_id:btn.dataset.id,decision:'skip'})});
                const d=await rr.json().catch(function(){return {};});
                if(!rr.ok)throw new Error(d.error||'Task could not be skipped.');
                btn.closest('.mavAiTask').remove();
              }catch(e){addMessage('Care task error: '+(e.message||e),'bot');}
            };
          });
        }catch(e){addMessage('Care Mode tasks error: '+(e.message||e),'bot');}
      })();
    }

    function operationsCenter(){
      if(!landlordOnly()){input.value='Give me my rent, payment and maintenance summary.';ask();return;}
      const tenants=Array.isArray(cache.tenants)?cache.tenants:[];
      const records=Array.isArray(cache.rent_records)?cache.rent_records:[];
      const maint=Array.isArray(cache.maintenance_requests)?cache.maintenance_requests:[];
      const units=Array.isArray(cache.units)?cache.units:[];
      const overdue=records.filter(r=>{
        const b=Math.max(0,Number(r.amount_due||0)-Number(r.amount_paid||0));
        const d=r.due_date?new Date(r.due_date+'T23:59:59').getTime():0;
        return b>0&&(String(r.status||'').toLowerCase()==='overdue'||(d&&d<Date.now()));
      });
      const open=maint.filter(r=>!['completed','resolved','cancelled','closed'].includes(String(r.status||'').toLowerCase()));
      const vacant=units.filter(u=>String(u.status||'').toLowerCase()!=='occupied');
      const total=overdue.reduce((a,r)=>a+Math.max(0,Number(r.amount_due||0)-Number(r.amount_paid||0)),0);
      const lines=[
        '🧠 MAVRENT OPERATIONS CENTER',
        '',
        '🔴 Overdue: '+overdue.length+' — '+moneyLocal(total),
        '🔧 Open maintenance: '+open.length,
        '🏠 Vacant units: '+vacant.length,
        '👥 Active tenant records: '+tenants.filter(t=>String(t.status||'active')==='active').length,
        '',
        'Ask me what needs attention and I can drill into the relevant records without flooding the dashboard.'
      ];
      addMessage(lines.join('\n'),'bot');
      careTasksCenter();
    }

    function parsePaymentCommand(s){
      const str = String(s || '').trim();
      const l = str.toLowerCase();
      if(!/\b(has paid|paid|payment of|record.*payment)\b/.test(l))return null;
      const amountMatch = str.match(/(?:ugx\s*)?([0-9][0-9,\.]*)(?:\s*(?:ugx|shs))?/i);
      const amount = (amountMatch && amountMatch[1]) ? Number(String(amountMatch[1]).replace(/[,.]/g, '')) : 0;
      const nameMatch = str.match(/(?:tenant\s+)?([A-Za-z][A-Za-z .'-]{1,50}?)(?:\s+(?:has\s+paid|paid|made\s+a\s+payment)|\s+paid\s+)/i);
      const name = (nameMatch && nameMatch[1] ? String(nameMatch[1]) : '').trim();
      if(!name || !amount || !Number.isFinite(amount))return null;
      return {type:'record_payment', tenant_name:name, amount, date:new Date().toISOString().slice(0,10)};
    }

    async function showPaymentConfirmation(action){
      if(!landlordOnly())return;
      const tenants=Array.isArray(cache.tenants)?cache.tenants:[];
      const profiles=Array.isArray(cache.registeredTenants)?cache.registeredTenants:[];
      const wanted=String(action.tenant_name||'').toLowerCase();
      const matches=tenants.map(t=>({t,p:profiles.find(p=>p.id===t.profile_id)})).filter(x=>{
        const n=String(x.p?.full_name||x.p?.email||'').toLowerCase();
        return n.includes(wanted)||wanted.includes(n);
      });
      if(!matches.length){addMessage('I could not find an active MavRent tenant matching “'+action.tenant_name+'”.','bot');return;}
      const x=matches[0], rows=(cache.rent_records||[]).filter(r=>r.tenant_id===x.t.id);
      const balance=rows.reduce((a,r)=>a+Math.max(0,Number(r.amount_due||0)-Number(r.amount_paid||0)),0);
      const unit=cache.units.find(u=>u.id===x.t.unit_id);
      const p=panel('<h3>💳 Confirm payment</h3><div class="mavAiSummary"><b>Tenant:</b> '+escLocal(x.p?.full_name||'Tenant')+'<br><b>Unit:</b> '+escLocal(unit?.unit_number||'—')+'<br><b>Amount:</b> '+moneyLocal(action.amount)+'<br><b>Date:</b> '+escLocal(action.date)+'<br><b>Current balance:</b> '+moneyLocal(balance)+'<br><br>Payment method is not specified. MavRent will record it as “other” only if you confirm.</div><div class="mavAiConfirm"><button class="ok" id="aiPayConfirm">✓ Record payment</button><button class="cancel" id="aiPayCancel">Cancel</button></div>');
      aiAudit('Payment prepared','prepared',(x.p?.full_name||'Tenant')+' • '+moneyLocal(action.amount));
      p.querySelector('#aiPayCancel').onclick=function(){p.remove();aiAudit('Payment','cancelled','Landlord cancelled before recording');};
      p.querySelector('#aiPayConfirm').onclick=async function(){
        const b=this;b.disabled=true;b.textContent='Recording...';
        try{
          const token=await session();
          const server=await fetch('/api/ai-action',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({
            action:'record_payment',confirmed:true,tenant_id:x.t.id,amount:Number(action.amount),payment_date:action.date,
            payment_method:'other',notes:'Recorded by Mav AI Permission Engine'
          })});
          const data=await server.json().catch(function(){return {};});
          if(!server.ok)throw new Error(data.error||'Server permission check failed.');
          const result=data.result||{};
          aiAudit('Payment recorded','confirmed',(x.p?.full_name||'Tenant')+' • '+moneyLocal(action.amount));
          p.remove();addMessage('✅ Payment recorded for '+(x.p?.full_name||'the tenant')+'. Current balance before this payment was '+moneyLocal(balance)+'. Receipt '+(result.receipt&&result.receipt.receipt_number||'created')+' was generated.','bot');
          if(typeof refresh==='function')await refresh();
          if(typeof show==='function')await show('payments',false);
        }catch(e){b.disabled=false;b.textContent='✓ Record payment';addMessage('Payment failed: '+(e.message||e),'bot');aiAudit('Payment','failed',e.message||e);}
      };
    }

    function currentClient(){
      return typeof sb!=='undefined' ? sb : null;
    }

    async function saveTenantPhone(){
      if(!tenantOnly())return;
      try{
        const client=currentClient() || await ensureSupabase();
        const phone=String(profile&&profile.phone||'').trim();
        const p=panel(
          '<h3>📱 My contact number</h3>'+
          '<div class="mavAiSummary">This number is stored on your MavRent profile and can be used by your landlord for approved rent reminders and tenant communication.</div>'+
          '<label>Phone number</label>'+
          '<input id="aiTenantPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+256 7XX XXX XXX" value="'+escLocal(phone)+'">'+
          '<div class="mavAiConfirm"><button class="ok" id="aiSavePhone">✓ Save number</button><button class="cancel" id="aiCancelPhone">Cancel</button></div>'
        );
        p.querySelector('#aiCancelPhone').onclick=function(){p.remove();};
        p.querySelector('#aiSavePhone').onclick=async function(){
          const b=this; const value=p.querySelector('#aiTenantPhone').value.trim();
          if(!value){addMessage('Please enter a phone number.','bot');return;}
          b.disabled=true;b.textContent='Saving...';
          const res=await client.from('profiles').update({phone:value}).eq('id',user.id);
          if(res.error){b.disabled=false;b.textContent='✓ Save number';addMessage('Could not save phone number: '+res.error.message,'bot');return;}
          if(profile)profile.phone=value;
          p.remove();
          addMessage('✅ Your phone number has been saved to your MavRent profile.','bot');
          if(typeof show==='function')await show('profile',false);
        };
      }catch(e){addMessage('Phone setup error: '+e.message,'bot');}
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
          const token=await session();
          const server=await fetch('/api/ai-action',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({
            action:'assign_tenant',confirmed:true,profile_id:profileId,unit_id:unitId,monthly_rent:rent,deposit_amount:deposit,rent_due_day:due,move_in_date:move,
            details:{advance_months:advance}
          })});
          const data=await server.json().catch(function(){return {};});
          if(!server.ok)throw new Error(data.error||'Server permission check failed.');
          p.remove();
          aiAudit('Tenant assignment','confirmed',(prof&& (prof.full_name||prof.email)||'Tenant')+' → '+(unit&&unit.unit_number||'Unit'));
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
            // The receipts table requires tenant_id. The existing helper is kept as the
            // single receipt-writing path, but we validate the payment relationship first.
            if(!pay || !pay.tenant_id)throw new Error('This payment is not linked to a tenant, so MavRent cannot safely issue its receipt.');
            const tenantForReceipt=cache.tenants.find(function(x){return String(x.id)===String(pay.tenant_id);});
            if(!tenantForReceipt)throw new Error('The tenant linked to this payment could not be found.');
            const token=await session();
            const server=await fetch('/api/ai-action',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'create_receipt',confirmed:true,payment_id:pay.id})});
            const data=await server.json().catch(function(){return {};});
            if(!server.ok)throw new Error(data.error||'Server permission check failed.');
            const out=data.result||{};
            aiAudit('Receipt created','confirmed',(out.receipt&&out.receipt.receipt_number)||'MavRent receipt');
            p.remove();addMessage('🧾 Receipt created: '+(out.receipt&&out.receipt.receipt_number||'MavRent receipt'),'bot');
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
          (wa?'<a class="ok" style="display:grid;place-items:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/'+escLocal(wa)+'?text='+text+'">💬 WhatsApp</a>':'')+
          (phone?'<a class="cancel" style="display:grid;place-items:center;text-decoration:none" href="sms:'+escLocal(phone)+'?body='+text+'">✉️ SMS</a>':'')+
          '</div></div>';
      });
      panel(html);
    }

    async function paymentPrnCenter(){
      if(typeof role!=='undefined'&&role!=='tenant'){
        addMessage('💳 Payment PRNs are currently generated from the tenant side. As a landlord, you can verify provider payments through the secure payment workflow.','bot');
        return;
      }
      const p=panel('<h3>💳 Mav AI Payment PRN</h3><div class="mavAiSummary">Generate a secure payment reference, pay using your supported provider, then submit the PRN and transaction reference. A PRN by itself never proves that money was paid.</div><div class="mavAiConfirm"><button class="ok" id="mavPrnCreate">Generate PRN</button><button class="cancel" id="mavPrnStatus">Check PRN status</button></div>');
      p.querySelector('#mavPrnCreate').onclick=async function(){
        const b=this;b.disabled=true;b.textContent='Generating...';
        try{
          const token=await session();
          const r=await fetch('/api/payment-prn',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'create'})});
          const d=await r.json().catch(function(){return {};});
          if(!r.ok)throw new Error(d.error||'Could not generate a PRN.');
          const x=d.payment_request;
          p.innerHTML='<h3>💳 Payment PRN generated</h3><div class="mavAiSummary"><b>PRN:</b> '+escLocal(x.prn)+'<br><b>Amount:</b> '+moneyLocal(x.amount)+'<br><b>Expires:</b> '+escLocal(new Date(x.expires_at).toLocaleString())+'<br><br>Use this PRN when paying through the supported payment provider. After payment, return here and submit the PRN plus the provider transaction reference.</div><div class="mavAiConfirm"><button class="ok" id="mavPrnSubmit">Submit after payment</button><button class="cancel" id="mavPrnDone">Done</button></div>';
          p.querySelector('#mavPrnDone').onclick=function(){p.remove();};
          p.querySelector('#mavPrnSubmit').onclick=function(){
            p.innerHTML='<h3>📨 Submit payment</h3><label>PRN</label><input id="mavPrnInput" value="'+escLocal(x.prn)+'"><label>Provider transaction reference</label><input id="mavTxInput" placeholder="e.g. transaction ID"><div class="mavAiConfirm"><button class="ok" id="mavPrnSend">Submit for verification</button><button class="cancel" id="mavPrnCancel">Cancel</button></div>';
            p.querySelector('#mavPrnCancel').onclick=function(){p.remove();};
            p.querySelector('#mavPrnSend').onclick=async function(){
              const s=this;const prn=p.querySelector('#mavPrnInput').value.trim();const tx=p.querySelector('#mavTxInput').value.trim();
              if(!prn){alert('Enter the PRN.');return;} s.disabled=true;s.textContent='Submitting...';
              try{
                const token=await session();
                const r=await fetch('/api/payment-prn',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'submit',prn,transaction_reference:tx})});
                const d=await r.json().catch(function(){return {};});
                if(!r.ok)throw new Error(d.error||'Payment submission failed.');
                p.innerHTML='<h3>✅ Payment submitted</h3><div class="mavAiSummary">Mav AI has submitted PRN <b>'+escLocal(prn)+'</b> for provider verification. It will only be approved automatically when the trusted provider confirms the transaction and Care Mode permits it.</div><div class="mavAiConfirm"><button class="ok" id="mavPrnClose">Done</button></div>';
                p.querySelector('#mavPrnClose').onclick=function(){p.remove();};
              }catch(e){s.disabled=false;s.textContent='Submit for verification';addMessage('Payment PRN error: '+(e.message||e),'bot');}
            };
          };
        }catch(e){b.disabled=false;b.textContent='Generate PRN';addMessage('Payment PRN error: '+(e.message||e),'bot');}
      };
      p.querySelector('#mavPrnStatus').onclick=async function(){
        const prn=prompt('Enter your Mav AI PRN:','');if(!prn)return;
        try{
          const token=await session();
          const r=await fetch('/api/payment-prn',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'status',prn:prn.trim()})});
          const d=await r.json().catch(function(){return {};});
          if(!r.ok)throw new Error(d.error||'Could not check PRN.');
          const x=d.payment_request;
          addMessage('💳 PRN '+x.prn+' status: '+x.status+(x.transaction_reference?' • Transaction: '+x.transaction_reference:'')+(x.approved_at?' • Approved: '+new Date(x.approved_at).toLocaleString():''),'bot');
          p.remove();
        }catch(e){addMessage('PRN status error: '+(e.message||e),'bot');}
      };
    }

    function detectLocalAction(q){
      const s = String(q || '').trim(), l = s.toLowerCase();
      if(!s) return null;
      if(/\b(assign|add|register)\b.*\btenant\b/.test(l)||/\bassign\b/.test(l)){
        const tenantMatch = s.match(/(?:(?:assign|add|register)\s+)?(?:tenant\s+)?([A-Za-z][A-Za-z .'-]{1,50}?)(?=\s+to\s+|\s+in\s+|\s+at\s+)/i);
        const tenant = tenantMatch && tenantMatch[1] ? String(tenantMatch[1]).trim() : '';
        const unitMatch = s.match(/(?:room|unit)\s*([A-Za-z0-9-]+)/i);
        const unit = unitMatch && unitMatch[1] ? String(unitMatch[1]).trim() : '';
        const rentMatch = s.match(/(?:monthly\s+rent|rent)\s*(?:is|=|of)?\s*(?:ugx\s*)?([0-9,]+)/i);
        const rent = rentMatch && rentMatch[1] ? Number(String(rentMatch[1]).replace(/,/g,'')) : 0;
        const depMatch = s.match(/(?:deposit)\s*(?:is|=|of)?\s*(?:ugx\s*)?([0-9,]+)/i);
        const dep = depMatch && depMatch[1] ? Number(String(depMatch[1]).replace(/,/g,'')) : 0;
        const dueMatch = s.match(/(?:due\s+day|due\s+on)\s*(?:is|=|of)?\s*(\d{1,2})/i);
        const due = dueMatch && dueMatch[1] ? Number(dueMatch[1]) : 1;
        const advMatch = s.match(/(?:advance|initial)\s*(?:of|for)?\s*(\d+)\s*month/i);
        const advance = advMatch && advMatch[1] ? Number(advMatch[1]) : 3;
        return {type:'assign_tenant',tenant_name:tenant,unit_number:unit,monthly_rent:rent,deposit_amount:dep,rent_due_day:due,initial_advance_months:advance};
      }
      if(/\b(prn|payment reference|payment code)\b/.test(l))return {type:'payment_prn'};
      if(/\b(create|make|generate)\b.*\breceipt\b/.test(l))return {type:'create_receipt'};
      if(/\b(remind|contact|message|whatsapp|sms|call)\b.*\b(overdue|tenant|tenants)\b/.test(l))return {type:'contact_overdue'};
      if(/\b(record|add|enter)\b.*\bpayment\b/.test(l))return {type:'open_page',page:'payments'};
      if(/\b(add|create|new)\b.*\bproperty\b/.test(l))return {type:'open_page',page:'properties'};
      if(/\b(add|create|new)\b.*\bunit\b/.test(l))return {type:'open_page',page:'units'};
      if(/\b(maintenance|repair)\b/.test(l))return {type:'open_page',page:'maintenance'};
      if(/\b(expense|expenses)\b/.test(l))return {type:'open_page',page:'expenses'};
      if(/\b(report|reports|analytics)\b/.test(l))return {type:'open_page',page:'reports'};
      return null;
    }

    async function ask(){
      const question=input.value.trim();if(!question)return;
      addMessage(question,'user');input.value='';
      const paymentAction=parsePaymentCommand(question);
      if(paymentAction){
        addMessage('I heard a payment instruction. I found: '+paymentAction.tenant_name+' • '+moneyLocal(paymentAction.amount)+' • '+paymentAction.date+'. I will not record it until you confirm.','bot');
        await showPaymentConfirmation(paymentAction);
        return;
      }
      const action=detectLocalAction(question);
      if(action){
        if(action.type==='assign_tenant'){addMessage('I understood this as a tenant assignment. I will prepare it for your final confirmation.','bot');await showAddTenant(action);return;}
        if(action.type==='create_receipt'){addMessage('I understood this as a receipt request. I will prepare it for your final confirmation.','bot');await showReceipt();return;}
        if(action.type==='payment_prn'){await paymentPrnCenter();return;}
        if(action.type==='contact_overdue'){addMessage('I will prepare the overdue-tenant contact options. MavRent will not send anything silently.','bot');contactOverdue();return;}
        if(action.type==='open_page'){
          if(typeof show==='function')await show(action.page,false);
          addMessage('Opened the '+action.page+' section for you. Any consequential change still requires your normal confirmation.','bot');
          return;
        }
      }
      send.disabled=true;send.textContent='...';
      try{
        const token=await session();
        const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({message:question})});
        const data=await r.json().catch(function(){return {};});
        if(!r.ok)throw new Error(data.error||'Mav AI request failed.');
        addMessage(data.answer||'No answer returned.','bot');
      }catch(e){addMessage('AI error: '+(e.message||'Unknown error'),'bot');aiAudit('AI question','failed',e.message||'Unknown error');}
      finally{send.disabled=false;send.textContent='Send';input.focus();}
    }

    function configureRoleUI(){
      const isTenant=(typeof role!=='undefined'&&role==='tenant');
      if(toolsBar){
        toolsBar.style.display=isTenant?'none':'flex';
      }
      if(suggestionsGrid){
        const prompts=isTenant?[
          'How much do I owe?',
          'When is my rent due?',
          'Show my payments',
          'Show my receipts',
          'Report maintenance'
        ]:[
          'Who is overdue?',
          'What needs attention?',
          'How much rent was collected this month?',
          'Show vacant units',
          'Show late payers',
          'Record a payment'
        ];
        suggestionsGrid.innerHTML=prompts.map(p=>`<button type="button" class="mavAiChip" data-prompt="${escLocal(p)}">${escLocal(p)}</button>`).join('');
        suggestionsGrid.querySelectorAll('.mavAiChip').forEach(btn=>{
          btn.onclick=function(){
            input.value=this.dataset.prompt;
            ask();
          };
        });
      }
    }

    if(opsBtn)opsBtn.onclick=operationsCenter;
    if(autoBtn)autoBtn.onclick=setCareMode;
    if(auditBtn)auditBtn.onclick=showAudit;
    if(careTasksBtn)careTasksBtn.onclick=careTasksCenter;

    // Mav AI voice: Calm Male SpeechSynthesis + Speech Recognition
    let recognition=null, voiceFinal='', conversationMode=false, speaking=false, voices=[];
    let voiceMode=localStorage.getItem('mav_voice_mode')||'calm_male';

    if(voiceSelect){
      voiceSelect.value=voiceMode;
      voiceSelect.onchange=function(){
        voiceMode=this.value;
        localStorage.setItem('mav_voice_mode',voiceMode);
        stopSpeaking();
        if(voiceMode!=='off'){
          speak('I am Mav AI. Calm spoken replies are active.');
        }else{
          setVoiceState('Spoken replies off');
          setTimeout(()=>setVoiceState(''),1800);
        }
      };
    }

    const setVoiceState=function(t){if(voiceState)voiceState.textContent=t||'';};
    const refreshVoices=function(){try{voices=window.speechSynthesis?window.speechSynthesis.getVoices():[]}catch(e){voices=[]}};
    refreshVoices();
    if(window.speechSynthesis)window.speechSynthesis.onvoiceschanged=refreshVoices;

    function stopSpeaking(){
      try{if(window.speechSynthesis)window.speechSynthesis.cancel()}catch(e){}
      speaking=false;
    }

    function findCalmMaleVoice(mode){
      if(!voices.length)refreshVoices();
      if(!voices.length)return null;
      if(mode==='system_default'){
        return voices.find(v=>v.default&&v.lang.startsWith('en'))||voices.find(v=>v.lang.startsWith('en'))||voices[0];
      }
      // Preferred order:
      // 1. Google UK English Male
      // 2. Microsoft David
      // 3. Microsoft Mark
      // 4. another English male voice
      // 5. system English voice fallback
      const malePatterns=[
        /Google.*UK.*English.*Male/i,
        /Microsoft.*David/i,
        /Microsoft.*Mark/i,
        /Google.*English.*Male/i,
        /en[-_]GB.*Male/i,
        /en[-_]US.*Male/i,
        /Daniel/i,
        /Oliver/i,
        /Arthur/i,
        /George/i,
        /Guy/i,
        /Ryan/i,
        /James/i
      ];
      for(const p of malePatterns){
        const f=voices.find(v=>p.test(v.name)&&v.lang.startsWith('en'));
        if(f)return f;
      }
      const anyMale=voices.find(v=>/\bmale\b/i.test(v.name)&&v.lang.startsWith('en'));
      if(anyMale)return anyMale;
      const enUK=voices.find(v=>/^en[-_]GB$/i.test(v.lang));
      if(enUK)return enUK;
      const enUS=voices.find(v=>/^en[-_]US$/i.test(v.lang));
      if(enUS)return enUS;
      const anyEn=voices.find(v=>v.lang.startsWith('en'));
      return anyEn||voices[0];
    }

    function speak(text){
      if(voiceMode==='off'||!('speechSynthesis' in window))return;
      const value=String(text||'').replace(/[🧠🟢🛡️🧾📋🔴🔧🏠👥💰📅💳📱🎤✨✓✅⚪✕⚠️]/g,'').replace(/[*_#`~]/g,'').trim();
      if(!value)return;
      stopSpeaking();
      try{
        const u=new SpeechSynthesisUtterance(value.slice(0,1600));
        const target=findCalmMaleVoice(voiceMode);
        if(target){
          u.voice=target;
          u.lang=target.lang||'en-GB';
        }else{
          u.lang='en-US';
        }
        if(voiceMode==='calm_male'){
          u.rate=0.94;u.pitch=0.93;u.volume=1.0;
        }else if(voiceMode==='natural_male'){
          u.rate=0.98;u.pitch=0.97;u.volume=1.0;
        }else{
          u.rate=1.0;u.pitch=1.0;u.volume=1.0;
        }
        u.onstart=function(){speaking=true;setVoiceState('🔊 Mav AI speaking…')};
        u.onend=function(){speaking=false;setVoiceState(conversationMode?'🎙️ Ready for next query.':'')};
        u.onerror=function(){speaking=false;setVoiceState('')};
        window.speechSynthesis.speak(u);
      }catch(e){console.warn('Speech error:',e);}
    }
    function setupVoice(){
      if(!mic)return;
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){
        mic.onclick=function(){addMessage('🎤 Voice input is not available in this browser. You can still type and receive spoken replies.','bot')};
        return;
      }
      try{
        recognition=new SR();
        recognition.lang=(navigator.language||'en-UG').startsWith('en')?'en-UG':(navigator.language||'en');
        recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;
        recognition.onstart=function(){
          voiceFinal='';mic.classList.add('listening');mic.textContent='⏹️';
          setVoiceState(conversationMode?'🎙️ Listening…':'🎙️ Listening…');
          addMessage('🎤 Listening… speak to Mav AI.','bot');
        };
        recognition.onresult=function(e){
          let interim='';
          for(let i=e.resultIndex;i<e.results.length;i++){
            const part=e.results[i][0].transcript||'';
            if(e.results[i].isFinal)voiceFinal+=part+' ';else interim+=part;
          }
          input.value=(voiceFinal+interim).trim();
        };
        recognition.onerror=function(e){
          mic.classList.remove('listening');mic.textContent='🎤';
          const code=e&&e.error||'unknown';
          if(code==='aborted')return;
          if(code==='service-not-allowed'||code==='not-allowed'){
            setVoiceState('🎤 Microphone/speech permission is blocked.');
            addMessage('🎤 Voice recognition was blocked. Allow microphone access for MavRent and try again. On iPhone/iPad, browser speech recognition can still be restricted; spoken replies remain available.','bot');
          }else if(code==='audio-capture'){
            addMessage('🎤 No microphone was available. Check the microphone permission and try again.','bot');
          }else addMessage('🎤 Voice input could not start: '+code+'. You can still type.','bot');
        };
        recognition.onend=function(){
          mic.classList.remove('listening');mic.textContent='🎤';
          const heard=voiceFinal.trim();
          if(heard){
            if(conversationMode){
              const cleaned=heard.replace(/^\s*(?:hey\s+)?mav[,:]?\s*/i,'').trim();
              if(!cleaned){setVoiceState('🎙️ Say “Mav” followed by your question.');return}
              input.value=cleaned;
            }
            setTimeout(function(){ask(true)},120);
          }else setVoiceState(conversationMode?'🎙️ Hands-free mode is ready.':'');
        };
        mic.onclick=function(){
          try{
            if(mic.classList.contains('listening')){recognition.stop();return}
            stopSpeaking();voiceFinal='';recognition.start();
          }catch(e){addMessage('🎤 Voice input is temporarily unavailable. Tap again or use the keyboard microphone.','bot')}
        };
      }catch(e){
        mic.onclick=function(){addMessage('🎤 Voice input is unavailable in this browser. You can still type and receive spoken replies.','bot')};
      }
    }
    function toggleHandsFree(){
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){addMessage('🎙️ Hands-free mode needs browser speech recognition. The normal voice button may still work.','bot');return}
      conversationMode=!conversationMode;
      if(!conversationMode){setVoiceState('');handsFree.textContent='🎙️ Hands-free';addMessage('🎙️ Hands-free mode is off.','bot');return}
      handsFree.textContent='⏹️ Stop hands-free';
      addMessage('🎙️ Hands-free mode is on. Tap the microphone to start listening, then say “Mav” followed by your question. I will answer aloud.','bot');
      setVoiceState('🎙️ Hands-free mode is ready.');
    }
    const handsFree=document.createElement('button');
    handsFree.type='button';handsFree.className='mavAiTool';handsFree.id='mavAiHandsFree';handsFree.textContent='🎙️ Hands-free';handsFree.onclick=toggleHandsFree;
    const toolsRow=toolsBar || modal.querySelector('.mavAiTools');
    if(toolsRow)toolsRow.appendChild(handsFree);
    setupVoice();

    const addTenantBtn=document.getElementById('mavAiAddTenant');
    if(addTenantBtn)addTenantBtn.onclick=function(){showAddTenant();};
    const receiptBtn=document.getElementById('mavAiReceipt');
    if(receiptBtn)receiptBtn.onclick=function(){
      if(typeof role!=='undefined'&&role==='tenant'){if(input)input.value='Show my latest receipt';ask();}else showReceipt();
    };
    const overdueBtn=document.getElementById('mavAiOverdue');
    if(overdueBtn)overdueBtn.onclick=function(){
      if(input)input.value=(typeof role!=='undefined'&&role==='tenant')?'What is my rent balance?':'Who is overdue?';ask();
    };
    const maintBtn=document.getElementById('mavAiMaintenance');
    if(maintBtn)maintBtn.onclick=function(){if(input)input.value=(typeof role!=='undefined'&&role==='tenant')?'Show my maintenance requests.':'Show open maintenance.';ask();};
    const briefBtn=document.getElementById('mavAiBrief');
    if(briefBtn)briefBtn.onclick=function(){
      if(typeof role!=='undefined'&&role==='tenant'){if(input)input.value='Give me my rent and payment summary.';ask();}else dailyBrief();
    };
    const contactBtn=document.getElementById('mavAiContact');
    if(contactBtn)contactBtn.onclick=function(){
      if(typeof role!=='undefined'&&role==='tenant'){saveTenantPhone();}else contactOverdue();
    };
    const phoneBtn=document.getElementById('mavAiPhone');
    if(phoneBtn)phoneBtn.onclick=saveTenantPhone;

    configureRoleUI();
    if(send)send.onclick=ask;
    if(input)input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask();}});

    function syncVisibility(){
      const app=document.getElementById('app');
      let authenticated=false;
      try{authenticated=(typeof user!=='undefined' && !!user);}catch(e){}
      const appReady=!!app&&!app.classList.contains('hidden');
      button.classList.toggle('show',authenticated||appReady);
      configureRoleUI();
    }
    syncVisibility();
    setInterval(syncVisibility,250);
  }

  // Expose the launcher before startup so both index.html and the
  // post-login watchdog can start/restart Mav AI safely.
  window.MavAIBoot = boot;
  window.MavAIReady = true;

  function startMavAIBoot(){
    try{ boot(); }
    catch(error){ console.error('Mav AI boot failed:',error); }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startMavAIBoot,{once:true});
  else startMavAIBoot();
})();
