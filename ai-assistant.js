/* MavRent AI Assistant V1
   Loads as a separate script so the main index.html can stay stable.
*/
(() => {
  const STYLE = `
    #mavAiButton{
      position:fixed;right:18px;bottom:22px;z-index:260;
      border:0;border-radius:999px;padding:13px 17px;
      background:linear-gradient(135deg,#087cff,#00b8ff);
      color:#fff;font-weight:900;box-shadow:0 14px 35px #087cff55;
    }
    #mavAiModal{
      position:fixed;inset:0;z-index:1000;display:none;
      background:#0008;align-items:center;justify-content:center;padding:15px;
    }
    #mavAiModal.open{display:flex}
    .mavAiBox{
      width:min(620px,100%);height:min(760px,92vh);background:#fff;
      border-radius:20px;box-shadow:0 25px 90px #0006;
      display:flex;flex-direction:column;overflow:hidden;
    }
    .mavAiHead{
      padding:15px 17px;background:#111827;color:#fff;
      display:flex;align-items:center;justify-content:space-between;gap:10px;
    }
    .mavAiHead strong{font-size:17px}.mavAiHead small{display:block;opacity:.7;margin-top:2px}
    .mavAiClose{border:0;background:#273244;color:#fff;border-radius:9px;padding:8px 11px}
    .mavAiMessages{flex:1;overflow:auto;padding:15px;background:#f6f8fb}
    .mavAiMsg{max-width:88%;padding:11px 13px;border-radius:14px;margin-bottom:10px;line-height:1.45;font-size:14px;white-space:pre-wrap}
    .mavAiMsg.bot{background:#fff;border:1px solid #e3e6ea}
    .mavAiMsg.user{margin-left:auto;background:#087cff;color:#fff}
    .mavAiComposer{padding:12px;border-top:1px solid #e5e7eb;display:flex;gap:8px}
    .mavAiComposer textarea{flex:1;resize:none;min-height:48px;max-height:120px;padding:12px;border:1px solid #d9dde3;border-radius:12px;font:inherit}
    .mavAiSend{border:0;border-radius:12px;padding:0 16px;background:#111827;color:#fff;font-weight:800}
    .mavAiHint{font-size:11px;color:#6b7280;padding:0 12px 9px}
  `;

  function boot() {
    if (document.getElementById('mavAiButton')) return;

    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.id = 'mavAiButton';
    button.type = 'button';
    button.textContent = '✨ MavRent AI';
    document.body.appendChild(button);

    const modal = document.createElement('div');
    modal.id = 'mavAiModal';
    modal.innerHTML = `
      <div class="mavAiBox">
        <div class="mavAiHead">
          <div><strong>✨ MavRent AI</strong><small>Connected to your Supabase data · Read only</small></div>
          <button class="mavAiClose" type="button">✕</button>
        </div>
        <div class="mavAiMessages" id="mavAiMessages">
          <div class="mavAiMsg bot">Hi. I can read your MavRent data and answer questions about rent, tenants, payments, properties, maintenance and receipts.</div>
        </div>
        <div class="mavAiHint">Examples: “Who is overdue?” · “How much rent is outstanding?” · “Show open maintenance requests.”</div>
        <div class="mavAiComposer">
          <textarea id="mavAiInput" placeholder="Ask MavRent AI..." maxlength="4000"></textarea>
          <button class="mavAiSend" id="mavAiSend" type="button">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.classList.remove('open');
    button.onclick = () => modal.classList.add('open');
    modal.querySelector('.mavAiClose').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    const messages = document.getElementById('mavAiMessages');
    const input = document.getElementById('mavAiInput');
    const send = document.getElementById('mavAiSend');

    function addMessage(text, who) {
      const el = document.createElement('div');
      el.className = 'mavAiMsg ' + who;
      el.textContent = text;
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
    }

    async function ask() {
      const question = input.value.trim();
      if (!question) return;

      addMessage(question, 'user');
      input.value = '';
      send.disabled = true;
      send.textContent = '...';

      try {
        if (typeof ensureSupabase === 'function') await ensureSupabase();
        if (!sb?.auth) throw new Error('MavRent login service is not ready.');

        const sessionResult = await sb.auth.getSession();
        const token = sessionResult?.data?.session?.access_token;
        if (!token) throw new Error('Please log in to MavRent first.');

        const r = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ message: question })
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'MavRent AI request failed.');

        addMessage(data.answer || 'No answer returned.', 'bot');
      } catch (e) {
        addMessage('AI error: ' + (e.message || 'Unknown error'), 'bot');
      } finally {
        send.disabled = false;
        send.textContent = 'Send';
        input.focus();
      }
    }

    send.onclick = ask;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ask();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
