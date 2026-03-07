-- ═══════════════════════════════════════════════
-- PIXICO BARBER — FIX CONSTRAINT + TRIGGER FOTO
-- Cole TUDO no SQL Editor do Supabase → RUN
-- ═══════════════════════════════════════════════

-- 1. EXPANDIR constraint de status para incluir aguardando_cliente e remarcado
-- (O schema original só tinha: pendente, confirmado, concluido, cancelado_cliente, cancelado_admin, ausente, rejeitado)
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pendente', 'confirmado', 'concluido', 'cancelado_cliente', 'cancelado_admin', 'ausente', 'rejeitado', 'aguardando_cliente', 'remarcado'));

-- 2. Adicionar coluna favorito na tabela profiles (para estrela)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorito boolean DEFAULT false;

-- 3. CORRIGIR trigger para copiar foto_url do user_metadata para profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, sobrenome, whatsapp, role, foto_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'nome',
    new.raw_user_meta_data->>'sobrenome',
    new.raw_user_meta_data->>'whatsapp',
    COALESCE(new.raw_user_meta_data->>'role', 'client'),
    new.raw_user_meta_data->>'fotoUrl'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
