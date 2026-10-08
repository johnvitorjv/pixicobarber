import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Job = {
  id: string;
  recipient_email: string;
  event_type: string;
  subject: string;
  payload: Record<string, unknown>;
  attempts: number;
};

const esc = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeTime = (value: unknown) => String(value ?? "").slice(0, 5);

const formatDate = (value: unknown) => {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const titleCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

function eventContent(job: Job) {
  const p = job.payload ?? {};
  const client = esc(p.clientName || "Cliente");
  const service = esc(p.service || "Serviço");
  const date = titleCase(formatDate(p.date));
  const start = safeTime(p.start);
  const reason = esc(p.rejectionReason || "");
  const suggestedDate = titleCase(formatDate(p.suggestedDate));
  const suggestedStart = safeTime(p.suggestedStart);
  const clientUrl = esc(p.clientUrl || "https://pixicobarber.pages.dev/painel");
  const adminUrl = esc(p.adminUrl || "https://pixicobarber.pages.dev/admin/agendamentos");

  const appointment = `
    <div style="background:#111214;border:1px solid #2a2b2f;border-radius:16px;padding:18px 20px;margin:20px 0">
      <div style="font-size:12px;color:#caa94b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Agendamento</div>
      <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:6px">${service}</div>
      <div style="font-size:15px;color:#d7d7d7">${esc(date)} às ${esc(start)}</div>
    </div>`;

  switch (job.event_type) {
    case "admin_new_request":
      return { eyebrow: "Nova solicitação", heading: "Novo pedido de agendamento", body: `<p><strong>${client}</strong> enviou uma nova solicitação.</p>${appointment}`, button: ["Abrir painel administrativo", adminUrl] };
    case "admin_client_cancelled":
      return { eyebrow: "Cancelamento", heading: "Cliente cancelou o horário", body: `<p><strong>${client}</strong> cancelou o agendamento abaixo.</p>${appointment}`, button: ["Ver agendamentos", adminUrl] };
    case "admin_client_rescheduled":
      return { eyebrow: "Remarcação", heading: "Cliente confirmou uma remarcação", body: `<p><strong>${client}</strong> confirmou a atualização do horário.</p>${appointment}`, button: ["Abrir painel administrativo", adminUrl] };
    case "admin_client_update":
      return { eyebrow: "Atualização", heading: "Cliente atualizou um agendamento", body: `<p>Houve uma atualização feita por <strong>${client}</strong>.</p>${appointment}`, button: ["Abrir painel administrativo", adminUrl] };
    case "client_request_received":
      return { eyebrow: "Solicitação recebida", heading: "Recebemos seu pedido", body: `<p>Olá, <strong>${client}</strong>. Seu pedido chegou à Pixico Barber e está aguardando análise.</p>${appointment}<p>Você receberá outro e-mail assim que o horário for aprovado, rejeitado ou alterado.</p>`, button: ["Acompanhar agendamento", clientUrl] };
    case "client_approved":
      return { eyebrow: "Confirmado", heading: "Seu horário está confirmado ✅", body: `<p>Seu atendimento foi aprovado pela Pixico Barber.</p>${appointment}<p>Se precisar cancelar ou consultar os detalhes, acesse seu painel.</p>`, button: ["Ver meu agendamento", clientUrl] };
    case "client_rejected":
      return { eyebrow: "Atualização do pedido", heading: "Seu horário não pôde ser aprovado", body: `<p>A Pixico Barber não conseguiu confirmar esse horário.</p>${appointment}${reason ? `<div style="background:#251d13;border-left:3px solid #caa94b;padding:14px 16px;margin:18px 0;color:#eee"><strong>Motivo:</strong> ${reason}</div>` : ""}<p>Você pode voltar ao site e escolher outro horário disponível.</p>`, button: ["Escolher outro horário", clientUrl] };
    case "client_cancelled_by_shop":
      return { eyebrow: "Cancelamento", heading: "Seu agendamento foi cancelado", body: `<p>A Pixico Barber precisou cancelar o atendimento abaixo.</p>${appointment}<p>Você pode acessar o site para escolher uma nova data.</p>`, button: ["Agendar novamente", clientUrl] };
    case "client_cancelled_confirm":
      return { eyebrow: "Cancelamento confirmado", heading: "Seu horário foi cancelado", body: `<p>Confirmamos o cancelamento solicitado.</p>${appointment}<p>Quando quiser, você pode fazer um novo agendamento pelo site.</p>`, button: ["Fazer novo agendamento", clientUrl] };
    case "client_reschedule_proposed":
      return { eyebrow: "Novo horário sugerido", heading: "A Pixico sugeriu outro horário", body: `<p>A Pixico Barber sugeriu uma nova opção para seu atendimento.</p>${appointment}${suggestedDate ? `<div style="background:#111214;border:1px solid #caa94b;border-radius:16px;padding:18px 20px;margin:20px 0"><div style="font-size:12px;color:#caa94b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Horário sugerido</div><div style="font-size:17px;font-weight:700;color:#fff">${esc(suggestedDate)} às ${esc(suggestedStart)}</div></div>` : ""}<p>Acesse seu painel para conferir e responder.</p>`, button: ["Ver proposta", clientUrl] };
    case "client_rescheduled":
      return { eyebrow: "Horário atualizado", heading: "Seu novo horário está confirmado", body: `<p>Seu agendamento foi atualizado.</p>${appointment}`, button: ["Ver meu agendamento", clientUrl] };
    case "client_reminder_24h":
      return { eyebrow: "Lembrete · 24h", heading: "Seu horário é amanhã", body: `<p>Seu atendimento na Pixico Barber está chegando.</p>${appointment}`, button: ["Ver meu agendamento", clientUrl] };
    case "client_reminder_12h":
      return { eyebrow: "Lembrete · 12h", heading: "Faltam 12 horas para seu corte", body: `<p>Seu atendimento está chegando. Confira os detalhes abaixo.</p>${appointment}`, button: ["Ver meu agendamento", clientUrl] };
    case "client_reminder_1h":
      return { eyebrow: "Lembrete · 1h", heading: "Seu horário é daqui a 1 hora", body: `<p>Estamos esperando você na Pixico Barber.</p>${appointment}`, button: ["Ver meu agendamento", clientUrl] };
    default:
      return { eyebrow: "Pixico Barber", heading: "Atualização do seu agendamento", body: appointment, button: ["Abrir Pixico Barber", clientUrl] };
  }
}

function renderHtml(job: Job) {
  const c = eventContent(job);
  const [buttonText, buttonUrl] = c.button;
  const showCancel = job.event_type.startsWith("client_reminder_") || job.event_type === "client_approved";
  const cancelHtml = showCancel
    ? `<div style="margin-top:24px;padding:16px;background:#161311;border:1px solid #353027;border-radius:12px"><p style="margin:0 0 8px;font-size:14px;color:#ded5c4">Não poderá comparecer? Cancele antes do horário para evitar transtornos.</p><a href="https://pixicobarber.pages.dev/painel#meus-agendamentos" style="color:#caa94b;font-weight:700;text-decoration:underline">Abrir meu agendamento e cancelar</a></div>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#08090a;font-family:Arial,Helvetica,sans-serif;color:#ededed"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#08090a;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0d0e10;border:1px solid #232428;border-radius:22px;overflow:hidden"><tr><td style="height:5px;background:#caa94b"></td></tr><tr><td style="padding:30px 28px 12px;text-align:center"><div style="font-size:28px;font-weight:900;letter-spacing:1px;color:#fff">PIXICO <span style="color:#caa94b">BARBER</span></div><div style="font-size:11px;letter-spacing:3px;color:#8d8f94;margin-top:5px">BARBEARIA • ITACARANHA</div></td></tr><tr><td style="padding:18px 28px 30px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#caa94b;font-weight:700">${esc(c.eyebrow)}</div><h1 style="font-size:28px;line-height:1.2;color:#fff;margin:10px 0 16px">${esc(c.heading)}</h1><div style="font-size:16px;line-height:1.65;color:#d3d3d3">${c.body}${cancelHtml}</div><div style="text-align:center;margin:28px 0 6px"><a href="${buttonUrl}" style="display:inline-block;background:#caa94b;color:#08090a;text-decoration:none;font-weight:800;padding:14px 24px;border-radius:12px">${esc(buttonText)}</a></div></td></tr><tr><td style="border-top:1px solid #232428;padding:20px 28px;text-align:center;color:#777b82;font-size:12px;line-height:1.6">PIXICO Barber • Salvador/BA<br>Mensagem automática referente ao seu agendamento.</td></tr></table></td></tr></table></body></html>`;
}

function renderText(job: Job) {
  const p = job.payload ?? {};
  const date = titleCase(formatDate(p.date));
  const start = safeTime(p.start);
  const service = String(p.service || "Serviço");
  const client = String(p.clientName || "Cliente");
  const reason = String(p.rejectionReason || "");
  const clientUrl = String(p.clientUrl || "https://pixicobarber.pages.dev/painel");
  const adminUrl = String(p.adminUrl || "https://pixicobarber.pages.dev/admin/agendamentos");
  const adminEvent = job.event_type.startsWith("admin_");
  return ["PIXICO Barber","",job.subject,adminEvent ? `Cliente: ${client}` : `Olá, ${client}.`,`Serviço: ${service}`,`Data: ${date}`,`Horário: ${start}`,reason ? `Motivo: ${reason}` : "","",adminEvent ? adminUrl : clientUrl, job.event_type.startsWith("client_reminder_") ? "Não poderá comparecer? Cancele pelo seu painel: https://pixicobarber.pages.dev/painel#meus-agendamentos" : ""].filter(Boolean).join("\n");
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return Response.json({ ok:false,error:"Missing Supabase runtime secrets" }, { status:500 });

  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession:false, autoRefreshToken:false } });
  const { data: runtimeRows, error: runtimeError } = await supabase.rpc("get_pixico_email_runtime");
  if (runtimeError) return Response.json({ ok:false,error:runtimeError.message }, { status:500 });
  const runtime = Array.isArray(runtimeRows) ? runtimeRows[0] : runtimeRows;

  const suppliedToken = req.headers.get("x-pixico-dispatch-token") ?? "";
  if (!runtime?.dispatch_token || suppliedToken !== runtime.dispatch_token) {
    return Response.json({ ok:false,error:"Unauthorized" }, { status:401 });
  }

  if (!runtime?.enabled) return Response.json({ ok:true,disabled:true,sent:0,failed:0 });
  if (!runtime?.resend_api_key || !runtime?.sender_email) return Response.json({ ok:false,error:"Email runtime configuration incomplete" }, { status:500 });

  const { data: jobs, error: claimError } = await supabase.rpc("claim_email_outbox", { batch_size:10 });
  if (claimError) return Response.json({ ok:false,error:claimError.message }, { status:500 });

  let sent=0, failed=0;
  const results:Array<Record<string,unknown>>=[];

  for (const raw of (jobs ?? [])) {
    const job=raw as Job;
    let success=false;
    let providerId:string|null=null;
    let errorText:string|null=null;
    try {
      const response=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{Authorization:`Bearer ${runtime.resend_api_key}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          from:`${runtime.sender_name || "PIXICO Barber"} <${runtime.sender_email}>`,
          to:[job.recipient_email],
          reply_to:runtime.reply_to || undefined,
          subject:job.subject,
          html:renderHtml(job),
          text:renderText(job),
        }),
      });
      const responseText=await response.text();
      if(response.ok){
        success=true;
        try{providerId=JSON.parse(responseText)?.id ?? null}catch{providerId=null}
      } else {
        errorText=`Resend ${response.status}: ${responseText}`;
      }
    } catch(error) {
      errorText=error instanceof Error ? error.message : String(error);
    }

    const { error:finishError }=await supabase.rpc("finish_email_outbox",{
      p_id:job.id,p_success:success,p_provider_message_id:providerId,p_error:errorText
    });
    if(finishError) errorText=`${errorText ? errorText+" | " : ""}finish: ${finishError.message}`;
    if(success) sent++; else failed++;
    results.push({id:job.id,event:job.event_type,success,providerId,error:errorText});
  }

  return Response.json({ok:failed===0,sent,failed,results});
});
