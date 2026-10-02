import { test, expect } from '@playwright/test';
import { bahiaDate } from '../../src/lib/bookingRules.js';
const id = '11111111-1111-4111-8111-111111111111';
const serviceId = '44444444-4444-4444-8444-444444444444';
const tomorrow = new Date(bahiaDate() + 'T12:00:00'); tomorrow.setDate(tomorrow.getDate() + 1);
const day = bahiaDate(tomorrow);

async function mockBackend(page, { admin = false, failBooking = false, failService = false, failLogout = false, flagged = false } = {}) {
    const state = { mutations: [], apps: [], signedOut: false, failLogout, config: {nomeNegocio:'PIXICO Barber',whatsappNumero:'5571994096863',endereco:'Salvador',blacklistBehavior:'approval'} };
    const payload = Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url');
    state.accessToken = 'eyJhbGciOiJIUzI1NiJ9.'+payload+'.test-signature';
    const authUser = { id, email: 'teste@example.invalid', aud: 'authenticated', role: 'authenticated',
        user_metadata: { role: 'admin', nome: 'Metadados não confiáveis' } };
    const profile = { id, nome: 'Cliente', sobrenome: 'Teste', role: admin ? 'admin' : 'client', whatsapp: '5571999990000', foto_url: '', criado_em: '2026-01-01T12:00:00Z' };
    const service = { id: serviceId, nome: 'Corte', descricao_curta: 'Corte de teste', preco: 60, duracao: 45,
        categoria: 'corte', status: 'ativo', ordem: 1, visivel_home: true, visivel_cliente: true, visivel_agendamento: true };
    if (flagged) state.apps.push({id:'55555555-5555-4555-8555-555555555555',cliente_id:id,servico_id:serviceId,data:day,faixa_inicio:'09:00',faixa_fim:'09:45',status:'pendente',servico_nome_reservado:'Corte',preco_reservado:60,profiles:profile,services:service});
    await page.route('http://127.0.0.1:54321/**', async route => {
        const req = route.request(), url = new URL(req.url());
        const path = url.pathname, method = req.method();
        if (method !== 'GET' && method !== 'OPTIONS') state.mutations.push({ path, method, body: req.postDataJSON() });
        let response = {}, status = 200;
        const offset = Number(url.searchParams.get('offset') || 0);
        if (path.endsWith('/token')) {
            response = { access_token: state.accessToken, refresh_token: 'local-test-refresh',
                token_type: 'bearer', expires_in: 3600, user: authUser };
        } else if (path.endsWith('/signup')) response = { user: authUser };
        else if (path.endsWith('/user')) response = authUser;
        else if (path.endsWith('/logout')) { state.signOutScope = url.searchParams.get('scope'); if (state.failLogout) { status=500; response={message:'temporary outage'}; } else { state.signedOut = true; status = 204; } }
        else if (path.endsWith('/recover')) response = {};
        else if (path.endsWith('/profiles')) response = method === 'GET' ? profile : { id };
        else if (path.endsWith('/get_admin_clients')) response = [{ ...profile, role:'client', favorito:flagged, tags:[], blacklist:flagged }];
        else if (path.endsWith('/services')) { if (method !== 'GET' && failService) { status=503; response={message:'upstream unavailable'}; } else response=[service]; }
        else if (path.endsWith('/schedule_config')) response = [{ id:true, data:{ diasFuncionamento:[0,1,2,3,4,5,6], horarioInicio:'09:00',horarioFim:'18:00',intervaloAlmoco:{inicio:'12:00',fim:'14:00'},duracaoSlot:30,limiteClientesDia:16,limiteClientesTurno:8,bloqueiosEspeciais:[],ferias:[] } }];
        else if (path.endsWith('/business_settings')) { if (method === 'PATCH') state.config = req.postDataJSON().data; response = [{id:true,data:state.config}]; }
        else if (path.endsWith('/get_available_slots')) response = [{id:'09:00',inicio:'09:00',fim:'09:45',disponivel:true}];
        else if (path.endsWith('/get_admin_appointments')) response = state.apps;
        else if (path.endsWith('/appointments')) {
            if (method === 'POST') {
                if (failBooking) { status = 409; response = {code:'23P01',message:'conflict'}; }
                else { const a = {id:'55555555-5555-4555-8555-555555555555', ...req.postDataJSON(), servico_nome_reservado:'Corte',preco_reservado:60,profiles:profile,services:service}; state.apps.push(a); response = a; }
            } else if (method === 'PATCH') { Object.assign(state.apps[0],req.postDataJSON()); response = state.apps[0]; }
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
test('metadata cannot redirect a client to admin; logout completes and session is removed',async ({page}) => {
    const state = await mockBackend(page); await login(page);
    await expect(page).toHaveURL(/\/painel$/); await expect(page.getByRole('heading',{name:'Olá, Cliente'})).toBeVisible();
    await page.goto('/admin'); await expect(page).toHaveURL(/\/login$/);
    await page.goto('/painel'); await page.getByRole('button',{name:'Sair',exact:true}).click();
    await expect(page).toHaveURL(/\/$/); expect(state.signedOut).toBe(true);
    await page.goto('/painel'); await expect(page).toHaveURL(/\/login$/);
});
test('registration shows email confirmation without redirecting or embedding images in metadata',async ({page}) => {
    const state = await mockBackend(page); await page.goto('/cadastro');
    for (const [name,value] of Object.entries({nome:'Cliente',sobrenome:'Teste',whatsapp:'71999990000',email:'teste@example.invalid',senha:'LocalTest123!',confirmarSenha:'LocalTest123!'})) await page.locator('input[name='+name+']').fill(value);
    await page.getByRole('button',{name:'Criar Conta',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Verifique seu e-mail');
    await expect(page).toHaveURL(/\/cadastro$/);
    expect(state.mutations.find(m=>m.path.endsWith('/signup')).body.data.fotoUrl).toBeUndefined();
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
