-- ═══════════════════════════════════════════════
-- PIXICO BARBER - SUPABASE SCHEMA V1
-- Cole este script no SQL Editor do Supabase e clique em RUN
-- ═══════════════════════════════════════════════

-- 1. Tabela de Perfis (Profiles) - Estende o auth.users do Supabase
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL,
  sobrenome TEXT NOT NULL,
  whatsapp TEXT,
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  foto_url TEXT,
  nascimento DATE,
  observacoes TEXT,
  ultima_atividade TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ativar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Profiles
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins podem ver todos os perfis" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins podem atualizar todos os perfis" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger para criar um profile automaticamente quando um usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, sobrenome, whatsapp, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'nome',
    new.raw_user_meta_data->>'sobrenome',
    new.raw_user_meta_data->>'whatsapp',
    COALESCE(new.raw_user_meta_data->>'role', 'client')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Tabela de Serviços (Services)
CREATE TABLE public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao_curta TEXT,
  descricao_detalhada TEXT,
  preco DECIMAL(10,2) NOT NULL,
  preco_promocional DECIMAL(10,2),
  duracao INTEGER NOT NULL, -- em minutos
  categoria TEXT NOT NULL,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  ordem INTEGER DEFAULT 0,
  imagem_url TEXT,
  destaque BOOLEAN DEFAULT false,
  badge TEXT,
  visivel_home BOOLEAN DEFAULT true,
  visivel_cliente BOOLEAN DEFAULT true,
  visivel_agendamento BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Serviços ativos e visíveis podem ser vistos por todos
CREATE POLICY "Serviços visíveis são públicos" ON public.services
  FOR SELECT USING (status = 'ativo');

-- Apenas Admins podem modificar serviços
CREATE POLICY "Apenas admins podem inserir serviços" ON public.services
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Apenas admins podem atualizar serviços" ON public.services
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Apenas admins podem deletar serviços" ON public.services
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- 3. Tabela de Agendamentos (Appointments)
CREATE TABLE public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  servico_id UUID REFERENCES public.services(id) ON DELETE RESTRICT,
  data DATE NOT NULL,
  faixa_inicio TIME NOT NULL,
  faixa_fim TIME NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'concluido', 'cancelado_cliente', 'cancelado_admin', 'ausente', 'rejeitado')),
  notas_cliente TEXT,
  notas_admin TEXT,
  recurso_id TEXT, -- Para controle de barbeiro específico se houver
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Clientes podem ver seus agendamentos
CREATE POLICY "Clientes veem próprios agendamentos" ON public.appointments
  FOR SELECT USING (auth.uid() = cliente_id);

-- Clientes podem criar agendamentos (status pendente)
CREATE POLICY "Clientes podem criar agendamentos" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() = cliente_id);

-- Clientes podem cancelar seus agendamentos
CREATE POLICY "Clientes podem cancelar próprios agendamentos" ON public.appointments
  FOR UPDATE USING (auth.uid() = cliente_id)
  WITH CHECK (status = 'cancelado_cliente');

-- Admins podem ver e gerenciar todos os agendamentos
CREATE POLICY "Admins podem gerenciar todos os agendamentos" ON public.appointments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Habilitar Realtime para a tabela de Appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;


-- 4. Storage Bucket para Imagens (Fotos de Serviço e Perfil)
INSERT INTO storage.buckets (id, name, public) VALUES ('pixico-media', 'pixico-media', true);

CREATE POLICY "Imagens públicas para leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'pixico-media');

CREATE POLICY "Admins podem gerenciar imagens" ON storage.objects
  FOR ALL USING (
    bucket_id = 'pixico-media' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Clientes podem upar foto de perfil" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pixico-media' AND (storage.foldername(name))[1] = 'profiles' AND auth.uid() = owner
  );
