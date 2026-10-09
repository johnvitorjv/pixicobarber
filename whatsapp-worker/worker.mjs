// PIXICO Barber notification relay. Never runs a public HTTP server.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

const bridge = process.env.PIXICO_BRIDGE_URL;
const token = process.env.PIXICO_BOT_TOKEN;
const enabled = process.env.PIXICO_DELIVERY_ENABLED === 'true';
const pairing = process.env.PIXICO_PAIRING_MODE === 'true';
const stateRoot = process.env.PIXICO_STATE_DIR || path.join(os.homedir(), '.local', 'share', 'pixico-whatsapp');
const sessionPath = path.join(stateRoot,'auth');
const journalPath = path.join(stateRoot,'sent-journal.json');
if (!bridge?.startsWith('https://') || !token || token.length < 32) {
  throw new Error('Missing PIXICO_BRIDGE_URL or strong PIXICO_BOT_TOKEN');
}
await fs.mkdir(sessionPath,{recursive:true,mode:0o700});
await fs.chmod(stateRoot,0o700);
await fs.chmod(sessionPath,0o700);

const saved = async()=> {
  try { return JSON.parse(await fs.readFile(journalPath,'utf8')); }
  catch(e) { if (e.code==='ENOENT') return []; throw e; }
};
const alreadySent = new Set(await saved());
const writeJournal = async(id) => {
  alreadySent.add(id);
  const entries=[...alreadySent].slice(-2000);
  const tmp=journalPath+'.tmp';
  await fs.writeFile(tmp,JSON.stringify(entries),{mode:0o600});
  await fs.rename(tmp,journalPath);
};
const validPhone = raw => {
  let number=String(raw??'').replace(/\D/g,'');
  if (number.length===10 || number.length===11) number='55'+number;
  if (!/^55\d{10,11}$/.test(number)) throw new Error('Invalid Brazilian recipient number');
  return number+'@s.whatsapp.net';
};
async function bridgeCall(input) {
  const controller = new AbortController();
  const timeout=setTimeout(()=>controller.abort(),13000);
  try {
    const res=await fetch(bridge,{
      method:'POST', signal:controller.signal,
      headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Queue connection refused: HTTP '+res.status);
    return await res.json();
  } finally {clearTimeout(timeout);}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket, online=false, stopping=false, processing=false, retries=0;
async function processJobs() {
  if (processing || stopping || !enabled || !online || !socket) return;
  processing=true;
  try {
    const result=await bridgeCall({action:'claim'});
    for(const job of result.jobs || []) {
      if (!online || !socket) break;
      let success=false,reason='';
      try {
        if (!job.id || !job.lease_token || !job.recipient_phone || !job.body) {
          throw new Error('Incomplete queue record');
        }
        if (!alreadySent.has(job.id)) {
          const consent = await bridgeCall({action:'validate',id:job.id,lease:job.lease_token});
          if (consent.allowed !== true) {
            // Consent withdrawn, phone updated, or claim expired; never send.
            // Let the server cancel the lease; do not retry an invalid recipient.
            console.warn('Skipping revoked or expired WhatsApp job.');
            continue;
          }
          const jid=validPhone(job.recipient_phone);
          const sent=await socket.sendMessage(jid,{text:String(job.body).slice(0,3800)});
          if (!sent?.key?.id) throw new Error('WhatsApp did not confirm submission');
          await writeJournal(job.id);
          await delay(5000); // Slow, opt-in notifications only.
        }
        success=true;
      } catch(e) {reason=String(e?.message||'Provider error').slice(0,120);}
      try {
        await bridgeCall({action:'ack',id:job.id,lease:job.lease_token,success,error:reason});
      } catch { console.error('Could not acknowledge job; it will be retried safely.'); }
    }
  } catch(e) {
    console.error('Dispatcher unavailable:',String(e?.message||'error').slice(0,100));
  } finally {processing=false;}
}

async function connect() {
  if(stopping) return;
  const {state,saveCreds}=await useMultiFileAuthState(sessionPath);
  socket=makeWASocket({
    auth:state,
    markOnlineOnConnect:false,
    syncFullHistory:false,
    browser:['PIXICO Barber','Chrome','1.0'],
    getMessage:async()=>undefined
  });
  socket.ev.on('creds.update',saveCreds);
  socket.ev.on('connection.update',update=>{
    if (update.qr && pairing && process.stdout.isTTY) {
      console.log('Scan this QR in WhatsApp > Linked devices. Never share it.');
      qrcode.generate(update.qr,{small:true});
    }
    if (update.connection==='open') {
      online=true;retries=0;
      console.log('WhatsApp connected. Delivery enabled:',enabled);
    }
    if(update.connection==='close') {
      online=false;
      const code=update.lastDisconnect?.error?.output?.statusCode;
      if(code===DisconnectReason.loggedOut) {
        console.error('Linked phone logged out: pair again before resuming.');return;
      }
      if (!stopping) {
        retries=Math.min(retries+1,7);
        const wait=Math.min(60000,3000*2**retries);
        console.error('Connection lost. Reconnecting soon.');
        setTimeout(()=>{if(!stopping)void connect().catch(console.error);},wait);
      }
    }
  });
}
await connect();
setInterval(()=>void processJobs(),15000);
function finish(){stopping=true;online=false;void socket?.end?.(new Error('Shutting down'));setTimeout(()=>process.exit(0),300);}
process.once('SIGINT',finish);
process.once('SIGTERM',finish);
console.log('PIXICO worker started. Notifications:',enabled?'enabled':'DISABLED');
