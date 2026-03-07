-- ═══════════════════════════════════════════════
-- PIXICO BARBER — FIX DEFINITIVO COMPLETO
-- Cole TUDO no SQL Editor do Supabase → RUN
-- ═══════════════════════════════════════════════

-- ─── 1. SERVICES: colunas extras + desativar RLS + seed ───
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS imagem_url text DEFAULT '';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS descricao_detalhada text DEFAULT '';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS preco_promocional numeric DEFAULT null;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS visivel_home boolean DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS visivel_cliente boolean DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS visivel_agendamento boolean DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS atualizado_em timestamptz DEFAULT now();

ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;

DELETE FROM public.services;
INSERT INTO public.services (nome, descricao_curta, preco, duracao, categoria, ordem, destaque, badge) VALUES
('Corte', 'Corte estrutural com técnica apurada', 60, 45, 'corte', 1, true, ''),
('Barba', 'Design de barba com alinhamento preciso', 50, 30, 'barba', 2, true, ''),
('Corte + Barba', 'A experiência completa', 100, 75, 'combo', 3, true, 'MAIS PEDIDO'),
('Sobrancelha', 'Design e alinhamento de sobrancelha', 20, 15, 'complemento', 4, false, ''),
('Pigmentação', 'Pigmentação capilar profissional', 80, 60, 'tratamento', 5, false, 'PREMIUM'),
('Acabamento', 'Acabamento na nuca', 30, 15, 'complemento', 6, false, ''),
('Corte Infantil', 'Corte infantil com cuidado especial', 40, 30, 'corte', 7, false, 'INFANTIL');


-- ─── 2. APPOINTMENTS: colunas extras + RLS simples ───
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS atualizado_em timestamptz DEFAULT now();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clientes veem próprios agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Clientes podem criar agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Clientes podem cancelar próprios agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Admins podem gerenciar todos os agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "appointments_select" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update" ON public.appointments;
DROP POLICY IF EXISTS "appointments_delete" ON public.appointments;
DROP POLICY IF EXISTS "appointments_read" ON public.appointments;
DROP POLICY IF EXISTS "appointments_read_authenticated" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_authenticated" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_authenticated" ON public.appointments;

CREATE POLICY "appointments_read" ON public.appointments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "appointments_insert" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "appointments_update" ON public.appointments
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "appointments_delete" ON public.appointments
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- ─── 3. PROFILES: RLS simples ───
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ultima_atividade timestamptz DEFAULT now();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Perfis visíveis para autenticados" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_any" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_authenticated" ON public.profiles;

CREATE POLICY "profiles_read" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() IS NOT NULL);
