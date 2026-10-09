import { test, expect } from '@playwright/test';
import { bahiaDate } from '../../src/lib/bookingRules.js';
const id = '11111111-1111-4111-8111-111111111111';
const serviceId = '44444444-4444-4444-8444-444444444444';
const tomorrow = new Date(bahiaDate() + 'T12:00:00'); tomorrow.setDate(tomorrow.getDate() + 1);
const day = bahiaDate(tomorrow);
test.beforeEach(async ({page}) => {
    await page.route('**/*', route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
});

async function mockBackend(page, { admin = false, developer = false, failBooking = false, failService = false, failLogout = false, flagged = false, chemical = false, failOverride = false, failConfirmation = false } = {}) {
    const state = { mutations: [], apps: [], signedOut: false, failLogout, failConfirmation, config: {nomeNegocio:'PIXICO Barber',whatsappNumero:'5571994096863',endereco:'Salvador',blacklistBehavior:'approval'} };
    const payload = Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url');
    state.accessToken = 'eyJhbGciOiJIUzI1NiJ9.'+payload+'.test-signature';
    const authUser = { id, email: 'teste@example.invalid', aud: 'authenticated', role: 'authenticated',
        user_metadata: { role: 'admin', nome: 'Metadados não confiáveis' } };
    const profile = { id, nome: 'Cliente', sobrenome: 'Teste', role: admin ? 'admin' : 'client', is_developer: developer, whatsapp: '5571999990000', foto_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', criado_em: '2026-01-01T12:00:00Z' };
    const service = { id: serviceId, nome: 'Corte', descricao_curta: 'Corte de teste', preco: 60, duracao: 45,
        categoria: 'corte', status: 'ativo', ordem: 1, visivel_home: true, visivel_cliente: true, visivel_agendamento: true };
    if (chemical) Object.assign(service,{nome:typeof chemical==='string'?chemical:'Platinado',descricao_curta:'Químico de teste',preco:chemical==='Luzes'?80:100,duracao:null,confirmacao_manual:true,aplicacao_minutos:15});
    if (flagged) state.apps.push({id:'55555555-5555-4555-8555-555555555555',cliente_id:id,servico_id:serviceId,data:day,faixa_inicio:'09:00',faixa_fim:'09:45',status:'pendente',servico_nome_reservado:'Corte',preco_reservado:60,profiles:profile,services:service});
    if (flagged && chemical) Object.assign(state.apps[0],{servico_nome_reservado:service.nome,preco_reservado:service.preco,status:'solicitado',faixa_fim:null,confirmacao_manual:true});
    state.overrides=[];
    await page.route('http://127.0.0.1:54321/**', async route => {
        const req = route.request(), url = new URL(req.url());
        const path = url.pathname, method = req.method();
        if (method !== 'GET' && method !== 'OPTIONS') {
            const contentType = req.headers()['content-type'] || '';
            const body = contentType.includes('application/json') ? req.postDataJSON() : req.postData();
            state.mutations.push({ path, method, body });
        }
        let response = {}, status = 200;
        const offset = Number(url.searchParams.get('offset') || 0);
        if (path.startsWith('/storage/v1/object/pixico-registration/pending/')) {
            response = { Key: path.replace('/storage/v1/object/', '') };
        } else if (path.endsWith('/token')) {
            response = { access_token: state.accessToken, refresh_token: 'local-test-refresh',
                token_type: 'bearer', expires_in: 3600, user: authUser };
        } else if (path.endsWith('/signup')) response = { user: authUser };
        else if (path.endsWith('/user')) response = authUser;
        else if (path.endsWith('/logout')) { state.signOutScope = url.searchParams.get('scope'); if (state.failLogout) { status=500; response={message:'temporary outage'}; } else { state.signedOut = true; status = 204; } }
        else if (path.endsWith('/recover')) response = {};
        else if (path.endsWith('/profiles')) response = method === 'GET' ? profile : { id };
        else if (path.endsWith('/get_admin_clients')) response = [{ ...profile, role:'client', favorito:flagged, tags:[], blacklist:flagged }];
        else if (path.endsWith('/services')) { if (method !== 'GET' && failService) { status=503; response={message:'upstream unavailable'}; } else response=[service]; }
        else if (path.endsWith('/schedule_config')) response = [{ id:true, data:{ diasFuncionamento:[0,1,2,3,4,5,6], horarioInicio:'09:00',horarioFim:'20:00',intervaloAlmoco:{inicio:'13:00',fim:'15:30'},duracaoSlot:15,bloqueiosEspeciais:[],ferias:[] } }];
        else if (path.endsWith('/business_settings')) { if (method === 'PATCH') state.config = req.postDataJSON().data; response = [{id:true,data:state.config}]; }
        else if (path.endsWith('/day_overrides')) {
            if (method==='POST' && failOverride) {status=400;response={code:'P0001',message:'Regra invalida agendamento existente. Remarque ou cancele antes de alterar.'};}
            else if(method==='POST') {const row=req.postDataJSON();state.overrides=[row];response=row;}
            else if(method==='DELETE') {state.overrides=[];response=[];}
            else response=state.overrides;
        }
        else if (path.endsWith('/get_month_availability')) {
            const params = req.postDataJSON();
            const first = new Date(params.p_month + 'T12:00:00Z');
            const month = first.getUTCMonth();
            response = [];
            for (let offset = 0; offset < 31; offset++) {
                const cursor = new Date(first);
                cursor.setUTCDate(cursor.getUTCDate() + offset);
                if (cursor.getUTCMonth() !== month) break;
                response.push({ day: cursor.toISOString().slice(0, 10), available: true });
            }
        }
        else if (path.endsWith('/get_available_slots')) response = [{id:'09:00',inicio:'09:00',fim:chemical?null:'09:45',disponivel:true}];
        else if (path.endsWith('/get_admin_appointments')) response = state.apps;
        else if (path.endsWith('/get_suggestion_slots')) response = [{id:'11:00',inicio:'11:00',fim:'11:45',disponivel:true}];
        else if (path.endsWith('/get_edit_slots')) response = [
            {id:'09:30',inicio:'09:30',fim:'10:15',disponivel:true},
            {id:'10:00',inicio:'10:00',fim:'10:45',disponivel:false}
        ];
        else if (path.endsWith('/client_change_appointment')) {
            const body = req.postDataJSON();
            const old = state.apps.find(a => a.id === body.p_appointment);
            if (!old) {status=404;response={code:'P0001',message:'Agendamento não encontrado.'};}
            else {
                old.status='cancelado_cliente';
                const newId='77777777-7777-4777-8777-777777777777';
                state.apps.push({...old,id:newId,servico_id:body.p_service,data:body.p_date,faixa_inicio:body.p_start,faixa_fim:'10:15',status:'pendente'});
                response=newId;
            }
        }
        else if (path.endsWith('/appointments')) {
            if (method === 'POST') {
                if (failBooking) { status = 409; response = {code:'23P01',message:'conflict'}; }
                else { const a = {id:'55555555-5555-4555-8555-555555555555', ...req.postDataJSON(), confirmacao_manual:!!chemical,servico_nome_reservado:service.nome,preco_reservado:service.preco,profiles:profile,services:service}; state.apps.push(a); response = a; }
            } else if (method === 'PATCH') {
                if(state.failConfirmation && req.postDataJSON().status==='confirmado') {status=409;response={code:'23P01',message:'conflict'};}
                else {Object.assign(state.apps[0],req.postDataJSON());response=state.apps[0];}
            }
            else response = state.apps;
        } else response = [];
        if (offset > 0 && Array.isArray(response)) response = [];
        await route.fulfill({status,contentType:'application/json',body:status === 204 ? undefined : JSON.stringify(response)});
    });
    return state;
}
async function login(page) {
    await page.goto('/login');
    await page.locator('input[name=email]').fill('teste@example.invalid');
    await page.locator('input[name=senha]').fill('LocalTest123!');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
}

async function chooseBooking(page) {
    await page.goto('/agendar');
    await page.getByRole('button',{name:/Corte de teste/}).click();
    if (tomorrow.getDate() === 1) await page.getByRole('button').filter({has:page.locator('svg.lucide-chevron-right')}).click();
    await page.getByRole('button',{name:String(tomorrow.getDate()),exact:true}).click();
    await page.getByRole('button',{name:'09:00 — 09:45',exact:true}).click();
}

test('regular client sees a seven-day booking horizon', async ({page}) => {
    await mockBackend(page);
    await login(page); await expect(page).toHaveURL(/\/painel$/);
    await page.goto('/agendar');
    await page.getByRole('button',{name:/Corte de teste/}).click();
    const start = new Date(bahiaDate() + 'T12:00:00');
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const visibleEnd = bahiaDate(end).split('-').reverse().join('/');
    await expect(page.getByText(`Agenda móvel: escolha um dia até ${visibleEnd}. Novos dias abrem automaticamente.`)).toBeVisible();
    const nextMonth = page.locator('button:has(svg.lucide-chevron-right)').last();
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        await expect(nextMonth).toBeDisabled();
        const afterEnd = new Date(end); afterEnd.setDate(afterEnd.getDate() + 1);
        if (afterEnd.getMonth() === end.getMonth()) {
            await expect(page.getByRole('button',{name:String(afterEnd.getDate()),exact:true})).toHaveCount(0);
        }
    } else {
        await expect(nextMonth).toBeEnabled();
    }
});

test('developer client can navigate past the seven-day horizon', async ({page}) => {
    await mockBackend(page,{developer:true});
    await login(page); await expect(page).toHaveURL(/\/painel$/);
    await page.goto('/agendar');
    await page.getByRole('button',{name:/Corte de teste/}).click();
    await expect(page.getByText('Acesso de desenvolvedor: escolha qualquer dia disponível.')).toBeVisible();
    const nextMonth = page.locator('button:has(svg.lucide-chevron-right)').last();
    await expect(nextMonth).toBeEnabled();
    await nextMonth.click();
    const newMonth = new Date(bahiaDate() + 'T12:00:00'); newMonth.setMonth(newMonth.getMonth() + 1);
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    await expect(page.getByText(`${months[newMonth.getMonth()]} ${newMonth.getFullYear()}`)).toBeVisible();
});

for (const chemical of ['Platinado','Luzes']) test(`${chemical} request has variable duration, null end and no reservation guarantee`,async({page})=>{
    const state=await mockBackend(page,{chemical}); await login(page); await expect(page).toHaveURL(/\/painel$/);
    await page.goto('/agendar');
    await expect(page.getByRole('button',{name:new RegExp(chemical)})).toContainText('Duração variável');
    await page.getByRole('button',{name:new RegExp(chemical)}).click();
    await expect(page.getByRole('note')).toContainText('Este pedido não reserva uma vaga');
    if (tomorrow.getDate()===1) await page.getByRole('button').filter({has:page.locator('svg.lucide-chevron-right')}).click();
    await page.getByRole('button',{name:String(tomorrow.getDate()),exact:true}).click();
    await page.getByRole('button',{name:'09:00 — a definir',exact:true}).click();
    await page.getByRole('button',{name:'Confirmar Solicitação'}).click();
    await expect(page.getByRole('heading',{name:/Solicitação.*Enviada/})).toBeVisible();
    const body=state.mutations.find(m=>m.path.endsWith('/appointments')).body;
    expect(body.status).toBe('solicitado');expect(body.faixa_fim).toBeNull();
    await page.goto('/painel');
    await expect(page.getByText('Solicitação química · sem reserva',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await expect(page.getByText('Cancelado',{exact:true})).toBeVisible();
});

for (const chemical of ['Platinado','Luzes']) test(`admin validates and confirms the full ${chemical} occupation`,async({page})=>{
    await page.setViewportSize({width:chemical==='Platinado'?320:390,height:844});
    const state=await mockBackend(page,{admin:true,flagged:true,chemical}); await login(page);await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/agendamentos');
    await expect(page.locator('td').getByText('Solicitação química · sem reserva',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Aprovar',exact:true}).click();
    await expect.poll(()=>page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    await expect(page.getByRole('button',{name:'Fechar diálogo'})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByText(/incluindo processamento e lavagem/)).toBeVisible();
    await page.getByLabel('Fim ocupado').fill('09:15');
    await page.getByRole('button',{name:'Confirmar Aprovação'}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('30 a 480 minutos');
    expect(state.mutations.filter(m=>m.path.endsWith('/appointments')&&m.method==='PATCH')).toHaveLength(0);
    await page.getByLabel('Fim ocupado').fill('12:00');
    await page.screenshot({path:'test-results/chemical-confirmation-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Confirmar Aprovação'}).click();
    await expect(page.getByRole('heading',{name:'Aprovar Agendamento'})).toHaveCount(0);
    const body=state.mutations.find(m=>m.path.endsWith('/appointments')&&m.method==='PATCH').body;
    expect(body).toMatchObject({status:'confirmado',data:day,faixa_inicio:'09:00',faixa_fim:'12:00'});
});

test('admin saves multiple work intervals and arbitrary blocks; failed rules preserve editor',async({page})=>{
    const state=await mockBackend(page,{admin:true,failOverride:true});await login(page);await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/disponibilidade');
    if(tomorrow.getDate()===1) await page.getByRole('button').filter({has:page.locator('svg.lucide-chevron-right')}).click();
    await page.getByRole('button',{name:String(tomorrow.getDate()),exact:true}).click();
    await page.getByLabel('Trabalho 1 inicio').fill('08:00');
    await page.getByRole('button',{name:'+ Bloqueio',exact:true}).click();
    await page.getByLabel('Bloqueio 1 inicio').fill('10:07');await page.getByLabel('Bloqueio 1 fim').fill('10:22');
    await page.getByRole('button',{name:'+ Bloqueio',exact:true}).click();
    await page.getByLabel('Bloqueio 2 inicio').fill('16:03');await page.getByLabel('Bloqueio 2 fim').fill('16:18');
    await page.getByRole('button',{name:'Salvar exceção',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Remarque ou cancele');
    await expect(page.getByLabel('Trabalho 1 inicio')).toHaveValue('08:00');
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/date-override-mobile.png',fullPage:true});
    const body=state.mutations.find(m=>m.path.endsWith('/day_overrides')).body;
    expect(body.value.intervalos).toHaveLength(2);expect(body.value.bloqueios).toEqual([{inicio:'10:07',fim:'10:22'},{inicio:'16:03',fim:'16:18'}]);
});

test('chemical confirmation conflict preserves full occupation and permits a deliberate retry',async({page})=>{
    const state=await mockBackend(page,{admin:true,flagged:true,chemical:'Luzes',failConfirmation:true});
    await login(page);await expect(page).toHaveURL(/\/admin$/);await page.goto('/admin/agendamentos');
    await page.getByRole('button',{name:'Aprovar',exact:true}).click();
    await page.getByLabel('Fim ocupado').fill('12:00');
    await page.getByRole('button',{name:'Confirmar Aprovação'}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Escolha outro');
    await expect(page.getByLabel('Fim ocupado')).toHaveValue('12:00');
    expect(state.apps[0].status).toBe('solicitado');
    state.failConfirmation=false;
    await page.getByLabel('Início ocupado').fill('15:30');await page.getByLabel('Fim ocupado').fill('18:00');
    await page.getByRole('button',{name:'Confirmar Aprovação'}).click();
    await expect(page.getByRole('heading',{name:'Aprovar Agendamento'})).toHaveCount(0);
    expect(state.apps[0]).toMatchObject({status:'confirmado',faixa_inicio:'15:30',faixa_fim:'18:00'});
});

test('restoring a saved date exception refreshes the editor to the actual defaults',async({page})=>{
    const state=await mockBackend(page,{admin:true});await login(page);await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/disponibilidade');
    if(tomorrow.getDate()===1) await page.getByRole('button').filter({has:page.locator('svg.lucide-chevron-right')}).click();
    await page.getByRole('button',{name:String(tomorrow.getDate()),exact:true}).click();
    await page.getByLabel('Trabalho 1 inicio').fill('08:00');
    await page.getByRole('button',{name:'Salvar exceção',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Exceção salva');
    expect(state.overrides[0].value.intervalos[0].inicio).toBe('08:00');
    await page.getByRole('button',{name:'Restaurar padrão da data',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Expediente padrão restaurado');
    await expect(page.getByLabel('Trabalho 1 inicio')).toHaveValue('09:00');
    expect(state.overrides).toHaveLength(0);
});

test('cancelled chemical request never expands the occupied calendar to midnight',async({page})=>{
    const state=await mockBackend(page,{admin:true,flagged:true,chemical:true});
    Object.assign(state.apps[0],{status:'cancelado_cliente',data:bahiaDate()});
    state.apps.push({...state.apps[0],id:'66666666-6666-4666-8666-666666666666',status:'confirmado',
        servico_nome_reservado:'Reserva real',confirmacao_manual:false,faixa_inicio:'19:00',faixa_fim:'19:45'});
    await login(page);await expect(page).toHaveURL(/\/admin$/);await page.goto('/admin/calendario');
    await expect(page.getByText('Reserva real',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('00:00',{exact:true})).toHaveCount(0);
    await expect(page.getByText('Platinado',{exact:true})).toHaveCount(0);
});
test('metadata cannot redirect a client to admin; logout completes and session is removed',async ({page}) => {
    const state = await mockBackend(page); await login(page);
    await expect(page).toHaveURL(/\/painel$/); await expect(page.getByRole('heading',{name:'Olá, Cliente'})).toBeVisible();
    await page.goto('/admin'); await expect(page).toHaveURL(/\/login$/);
    await page.goto('/painel'); await page.getByRole('button',{name:'Sair',exact:true}).click();
    await expect(page).toHaveURL(/\/$/); expect(state.signedOut).toBe(true);
    await page.goto('/painel'); await expect(page).toHaveURL(/\/login$/);
});
test('registration stores only persistent photo references in signup metadata',async ({page}) => {
    const state = await mockBackend(page); await page.goto('/cadastro');
    for (const [name,value] of Object.entries({nome:'Cliente',sobrenome:'Teste',whatsapp:'71999990000',email:'teste@example.invalid',senha:'LocalTest123!',confirmarSenha:'LocalTest123!'})) await page.locator('input[name='+name+']').fill(value);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    await page.locator('input[type=file]').setInputFiles({name:'perfil.png',mimeType:'image/png',buffer:png});
    await expect(page.locator('img[alt="Foto"]')).toBeVisible();
    await page.getByRole('button',{name:'Criar Conta',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Verifique seu e-mail');
    await expect(page).toHaveURL(/\/cadastro$/);
    const signup = state.mutations.find(m=>m.path.endsWith('/signup')).body;
    expect(signup.data.fotoUrl).toMatch(/\/storage\/v1\/object\/public\/pixico-registration\/pending\/[0-9a-f-]+\.jpg$/);
    expect(signup.data.fotoUrl.startsWith('data:')).toBe(false);
    expect(signup.data.fotoPath).toMatch(/^pending\/[0-9a-f-]+\.jpg$/);
});
test('password recovery sends exact redirect and does not reveal account existence',async ({page}) => {
    const state = await mockBackend(page); await page.goto('/login');
    await page.getByRole('link',{name:'Esqueci minha senha'}).click();
    await page.getByRole('textbox',{name:'E-mail'}).fill('teste@example.invalid');
    await page.getByRole('button',{name:'Enviar link'}).click();
    await expect(page.getByRole('status')).toContainText('Se houver uma conta');
    expect(state.mutations.some(m=>m.path.endsWith('/recover'))).toBe(true);
});
test('booking uses server duration and prevents repeated submit; history reflects cancellation',async ({page}) => {
    const state = await mockBackend(page); await login(page); await expect(page).toHaveURL(/\/painel$/);
    await chooseBooking(page); await page.getByRole('button',{name:'Confirmar Solicitação'}).dblclick();
    await expect(page.getByRole('heading',{name:/Solicitação.*Enviada/})).toBeVisible();
    const posts = state.mutations.filter(m=>m.path.endsWith('/appointments') && m.method==='POST');
    expect(posts).toHaveLength(1); expect(posts[0].body.faixa_fim).toBe('09:45'); expect(posts[0].body.data).toBe(day);
    await page.goto('/painel'); await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Agendamento cancelado'})).toBeVisible();
    expect(state.apps[0].status).toBe('cancelado_cliente');
});
test('client changes booking to a free slot before the service date',async ({page}) => {
    const state=await mockBackend(page,{flagged:true});
    await login(page);
    await expect(page).toHaveURL(/\/painel$/);
    await page.getByRole('button',{name:'Alterar',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Alterar agendamento'});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('até o dia anterior',{exact:false})).toBeVisible();
    await dialog.getByRole('button',{name:'Horário 09:30 às 10:15'}).click();
    await dialog.getByRole('button',{name:'Solicitar alteração'}).click();
    await expect(dialog).toHaveCount(0);
    const changes=state.mutations.filter(m=>m.path.endsWith('/client_change_appointment'));
    expect(changes).toHaveLength(1);
    expect(changes[0].body).toMatchObject({p_date:day,p_start:'09:30',p_service:serviceId});
    await expect(page.getByText('Pendente',{exact:true}).first()).toBeVisible();
});

test('booking conflict remains on confirmation and offers clear recovery',async ({page}) => {
    await mockBackend(page,{failBooking:true}); await login(page); await expect(page).toHaveURL(/\/painel$/);
    await chooseBooking(page); await page.getByRole('button',{name:'Confirmar Solicitação'}).click();
    await expect(page.getByRole('alert')).toContainText('Escolha outro');
    await expect(page.getByRole('heading',{name:'Confirmação',exact:true})).toBeVisible();
});
test('all admin pages load on mobile without runtime errors or page overflow',async ({page}) => {
    await page.setViewportSize({width:320,height:844});
    const errors = []; page.on('pageerror',e=>errors.push(e.message));
    await mockBackend(page,{admin:true}); await login(page); await expect(page).toHaveURL(/\/admin$/);
    for (const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    for (const path of ['','agendamentos','calendario','servicos','clientes','disponibilidade','financeiro','notificacoes','configuracoes']) {
        await page.goto('/admin'+(path?'/'+path:''));
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.getByRole('status').filter({hasText:'Carregando...'})).toHaveCount(0);
        await expect.poll(async () => page.evaluate(() => ({ width:document.documentElement.scrollWidth, viewport:innerWidth, overflow:[...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right > innerWidth+1).slice(0,8).map(el=>el.tagName+'.'+el.className) })), { message: path }).toMatchObject({ width,viewport:width });
    }
    }
    expect(errors).toEqual([]);
    await page.screenshot({path:'test-results/admin-mobile.png'});
});

test('password recovery link updates password then clears session',async ({page}) => {
    const state = await mockBackend(page);
    await page.goto('/recuperar-acesso#access_token='+state.accessToken+'&refresh_token=mock-recovery&expires_in=3600&token_type=bearer&type=recovery');
    await expect(page.getByRole('heading',{name:'Nova senha',exact:true})).toBeVisible();
    await page.getByLabel('Nova senha', {exact:true}).fill('ChangedLocalTest123!');
    await page.getByLabel('Confirmar senha').fill('ChangedLocalTest123!');
    await page.getByRole('button',{name:'Salvar senha'}).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(state.mutations.some(m=>m.path.endsWith('/user') && m.method==='PUT' && m.body.password==='ChangedLocalTest123!')).toBe(true);
    expect(state.signedOut).toBe(true); expect(state.signOutScope).toBe('global');
});
test('failed service save keeps form open with useful error',async ({page}) => {
    await mockBackend(page,{admin:true,failService:true}); await login(page); await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/servicos'); await page.getByRole('button',{name:'Adicionar Serviço',exact:true}).click();
    const modal = page.getByRole('dialog',{name:'Novo Serviço'});
    await modal.locator('input[type=text]').first().fill('Serviço teste');
    await modal.getByRole('button',{name:'Criar Serviço',exact:true}).click();
    await expect(modal.getByRole('alert')).toContainText('Não foi possível salvar');
    await expect(modal.locator('input[type=text]').first()).toHaveValue('Serviço teste');
});
test('business settings save updates public contact and reports success',async ({page}) => {
    const state = await mockBackend(page,{admin:true}); await login(page); await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/configuracoes');
    await page.getByLabel('WhatsApp (Contato)').fill('5571988887777');
    await page.getByLabel('Endereço Completo').fill('Endereço de homologação');
    await page.getByRole('button',{name:'Salvar Alterações'}).click();
    await expect(page.getByRole('button',{name:'Salvo com sucesso'})).toBeVisible();
    expect(state.config.whatsappNumero).toBe('5571988887777');
    await page.goto('/');
    await expect(page.locator('footer')).toContainText('Endereço de homologação');
    await expect(page.locator('footer a').filter({hasText:'WhatsApp'})).toHaveAttribute('href',/5571988887777/);
});

test('client and public routes fit a 320px viewport',async ({page}) => {
    await page.setViewportSize({width:320,height:844}); await mockBackend(page); await login(page); await expect(page).toHaveURL(/\/painel$/);
    for (const path of ['/painel','/agendar','/cadastro','/recuperar-acesso','/']) {
        await page.goto(path); await expect(page.getByRole('heading').first()).toBeVisible();
        await expect(page.getByRole('status').filter({hasText:'Carregando...'})).toHaveCount(0);
                await page.screenshot({path:'test-results/client-mobile'+path.replaceAll('/','-')+'.png'});
        await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth),{message:path}).toBeLessThanOrEqual(320);
        if (path === '/') { await expect.poll(()=>page.locator('.hero-title-anim').first().evaluate(el=>Number(getComputedStyle(el).opacity))).toBe(1); await page.screenshot({path:'test-results/home-mobile.png'}); }
    }
});

test('password update survives failed signout and retries only session closure', async ({page}) => {
    const state = await mockBackend(page,{failLogout:true});
    await page.goto('/recuperar-acesso#access_token='+state.accessToken+'&refresh_token=mock-recovery&expires_in=3600&token_type=bearer&type=recovery');
    await page.getByLabel('Nova senha',{exact:true}).fill('ChangedLocalTest123!');
    await page.getByLabel('Confirmar senha').fill('ChangedLocalTest123!');
    await page.getByRole('button',{name:'Salvar senha'}).click();
    await expect(page.getByRole('alert')).toContainText('Sua senha foi alterada');
    state.failLogout = false;
    await page.getByRole('button',{name:'Encerrar sessões e entrar'}).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(state.mutations.filter(m=>m.path.endsWith('/user') && m.method==='PUT')).toHaveLength(1);
    expect(state.signOutScope).toBe('global');
});

test('admin appointments display persisted favorite and blacklist flags',async ({page}) => {
    await mockBackend(page,{admin:true,flagged:true}); await login(page); await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/agendamentos');
    await expect(page.getByRole('img',{name:'Cliente favorito'})).toBeVisible();
    await expect(page.getByRole('img',{name:'Cliente bloqueado'})).toBeVisible();
});


test('mobile menu stays fixed, readable and locks page scroll', async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await mockBackend(page);
    await page.goto('/');
    await page.getByRole('button',{name:'Abrir menu'}).click();
    await expect(page.getByRole('button',{name:'Fechar menu'})).toBeVisible();
    const menu = page.getByTestId('mobile-menu');
    for (const label of ['Home','Sobre','Serviços','Galeria','Contato']) {
        await expect(menu.getByRole('link',{name:label,exact:true})).toBeVisible();
    }
    expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
    await page.waitForTimeout(350);
    expect(await menu.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(0, 0, 0)');
    expect(Number(await menu.evaluate(el => getComputedStyle(el).opacity))).toBe(1);
    const positions = await menu.locator('a[href^="#"]').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
    expect(positions).toEqual([...positions].sort((a,b)=>a-b));
    await menu.getByRole('link',{name:'Galeria',exact:true}).click();
    await expect(page.getByRole('button',{name:'Abrir menu'})).toBeVisible();
    expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
});

test('registration requires a profile photo and carries it into first login', async ({page}) => {
    const state = await mockBackend(page);
    await page.goto('/cadastro');
    await page.locator('input[name=nome]').fill('Cliente');
    await page.locator('input[name=sobrenome]').fill('Foto');
    await page.locator('input[name=whatsapp]').fill('71999999999');
    await page.locator('input[name=email]').fill('teste@example.invalid');
    await page.locator('input[name=senha]').fill('LocalTest123!');
    await page.locator('input[name=confirmarSenha]').fill('LocalTest123!');

    await page.getByRole('button',{name:'Criar Conta'}).click();
    await expect(page.getByText('A foto de perfil é obrigatória para o cadastro.')).toBeVisible();

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    await page.locator('input[type=file]').setInputFiles({name:'perfil.png',mimeType:'image/png',buffer:png});
    await expect(page.locator('img[alt="Foto"]')).toBeVisible();
    await expect(page.getByRole('button',{name:'Remover foto'})).toHaveCount(0);
    await page.getByRole('button',{name:'Criar Conta'}).click();
    await expect(page.getByRole('status')).toContainText('Verifique seu e-mail');

    await page.getByRole('status').getByRole('link',{name:'Entrar'}).click();
    await page.locator('input[name=email]').fill('teste@example.invalid');
    await page.locator('input[name=senha]').fill('LocalTest123!');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page).toHaveURL(/\/painel$/);
    const signup = state.mutations.find(m=>m.path.endsWith('/signup')).body;
    expect(signup.data.fotoUrl).toMatch(/\/storage\/v1\/object\/public\/pixico-registration\/pending\/[0-9a-f-]+\.jpg$/);
    expect(signup.data.fotoPath).toMatch(/^pending\/[0-9a-f-]+\.jpg$/);
    expect(state.mutations.some(m=>m.path.endsWith('/profiles') && m.method==='PATCH')).toBe(false);
});

test('booking and admin catalog show the three practical service groups', async ({page}) => {
    await mockBackend(page);
    await login(page);
    await page.goto('/agendar');
    await expect(page.getByRole('heading',{name:'Serviços avulsos'})).toBeVisible();

    await mockBackend(page,{admin:true});
    await page.goto('/login');
    await page.locator('input[name=email]').fill('teste@example.invalid');
    await page.locator('input[name=senha]').fill('LocalTest123!');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.goto('/admin/servicos');
    await expect(page.getByRole('heading',{name:'Serviços avulsos'})).toBeVisible();
});

test('admin approval shows weekday beside the appointment date', async ({page}) => {
    await mockBackend(page,{admin:true,flagged:true});
    await login(page);
    await page.goto('/admin/agendamentos');
    const weekdayRaw = new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'America/Bahia'}).format(new Date(day+'T12:00:00Z'));
    const weekday = weekdayRaw.charAt(0).toUpperCase()+weekdayRaw.slice(1);
    await expect(page.getByText(weekday,{exact:true}).first()).toBeVisible();
    await page.getByRole('button',{name:'Aprovar',exact:true}).click();
    await expect(page.getByRole('dialog').getByText(weekday,{exact:true})).toBeVisible();
});

test('home images animate when they cross the mobile viewport center', async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await mockBackend(page);
    await page.goto('/');

    const assertCenterAnimation = async (locator) => {
        await locator.evaluate(el => el.scrollIntoView({block:'center'}));
        await page.waitForTimeout(250);
        await expect.poll(() => locator.evaluate(el => el.className.split(/\s+/).includes('grayscale-0'))).toBe(true);
        await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
        await page.waitForTimeout(250);
        await expect.poll(() => locator.evaluate(el => el.className.split(/\s+/).includes('grayscale-0'))).toBe(false);
    };

    await assertCenterAnimation(page.locator('.phil-image img'));
    await assertCenterAnimation(page.locator('.service-card img').first());
    await assertCenterAnimation(page.locator('.gallery-item img').first());
});


test('PWA install offer is one-time per browser after the user acts', async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await mockBackend(page);
    await page.goto('/');

    await page.evaluate(() => {
        const event = new Event('beforeinstallprompt');
        Object.defineProperty(event, 'prompt', { value: () => Promise.resolve() });
        Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });
        window.dispatchEvent(event);
    });

    await expect(page.getByText('Instalar PIXICO',{exact:true})).toBeVisible({timeout:4000});
    await page.getByRole('button',{name:'Instalar',exact:true}).click();
    await expect(page.getByText('Instalar PIXICO',{exact:true})).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('pwa-install-dismissed')))).toBe(true);

    await page.reload();
    await page.evaluate(() => {
        const event = new Event('beforeinstallprompt');
        Object.defineProperty(event, 'prompt', { value: () => Promise.resolve() });
        Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });
        window.dispatchEvent(event);
    });
    await page.waitForTimeout(2300);
    await expect(page.getByText('Instalar PIXICO',{exact:true})).toHaveCount(0);
});

test('admin rejects with a clear reason without mandatory WhatsApp handoff', async ({ page }) => {
    const state = await mockBackend(page, { admin:true, flagged:true });
    await login(page);
    await page.goto('/admin/agendamentos');
    await page.getByRole('button', { name:'Rejeitar', exact:true }).click();
    await expect(page.getByText(/WhatsApp é opcional/)).toBeVisible();
    await page.getByRole('button', { name:'Confirmar Rejeição' }).click();
    await expect(page.getByRole('alert')).toContainText('Informe um motivo claro');
    expect(state.apps[0].status).toBe('pendente');
    await page.getByPlaceholder('Observação adicional (opcional)').fill('Horário indisponível por manutenção.');
    await page.getByRole('button', { name:'Confirmar Rejeição' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.apps[0]).toMatchObject({ status:'rejeitado', motivo_rejeicao:' — Horário indisponível por manutenção.' });
});

test('admin suggests a free slot and waits for the client to accept', async ({ page }) => {
    const state = await mockBackend(page, { admin:true, flagged:true });
    await login(page);
    await page.goto('/admin/agendamentos');
    await page.getByRole('button', { name:'Rejeitar', exact:true }).click();
    await page.getByText('Sugerir novo horário ao cliente').click();
    await expect(page.getByRole('checkbox', { name:/Sugerir novo horário ao cliente/ })).toBeChecked();
    await page.getByRole('button', { name:'Selecionar ' + day.split('-').reverse().join('/') }).click();
    await expect(page.getByRole('button', { name:'Horário 11:00 às 11:45' })).toBeVisible();
    await page.getByRole('button', { name:'Horário 11:00 às 11:45' }).click();
    await page.getByRole('button', { name:'Enviar Proposta' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.apps[0].status).toBe('aguardando_cliente');
    expect(state.apps[0].sugestao_data).toBe(day);
    await expect(page.getByText('Aguardando aceite do cliente')).toBeVisible();
    await expect(page.getByRole('button', { name:'Confirmar Remarcação' })).toHaveCount(0);
});

test('admin preview enlarges client avatar, and Escape closes', async ({page}) => {
    await mockBackend(page,{admin:true,flagged:true});
    await login(page);
    await page.goto('/admin/agendamentos');
    await page.getByRole('button',{name:'Ampliar foto de Cliente'}).click();
    await expect(page.getByRole('dialog',{name:/Foto ampliada de Cliente/})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog',{name:/Foto ampliada de Cliente/})).toHaveCount(0);
});

for (const width of [390,1280]) test('admin date filter uses weekday calendar on '+width+'px', async ({page}) => {
    await page.setViewportSize({width,height:844});
    await mockBackend(page,{admin:true,flagged:true});
    await login(page);
    await page.goto('/admin/agendamentos');
    await page.getByRole('button',{name:'Filtrar por data'}).click();
    for (const label of ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'])
        await expect(page.getByText(label,{exact:true}).first()).toBeVisible();
    await page.getByRole('button',{name:'Selecionar '+day.split('-').reverse().join('/')}).click();
    await expect(page.getByText('1 resultado(s)')).toBeVisible();
    await page.getByRole('button',{name:'Filtrar por data'}).click();
    await page.getByRole('button',{name:'Limpar data'}).click();
    await expect(page.getByText('1 resultado(s)')).toBeVisible();
});

test('barber suggests an available slot on mobile without a native date input', async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await mockBackend(page,{admin:true,flagged:true});
    await login(page);
    await page.goto('/admin/agendamentos');
    await page.getByRole('button',{name:'Rejeitar',exact:true}).click();
    await page.getByText('Sugerir novo horário ao cliente').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button',{name:'Selecionar '+day.split('-').reverse().join('/')}).click();
    await dialog.getByRole('button',{name:'Horário 11:00 às 11:45'}).click();
    await expect(dialog.getByRole('button',{name:'Enviar Proposta'})).toBeEnabled();
    await dialog.screenshot({path:'test-results/admin-suggestion-mobile.png'});
});
