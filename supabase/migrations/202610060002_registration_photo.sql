-- PIXICO Barber — foto obrigatória e persistente já no cadastro.
-- O bucket é separado do restante das mídias para limitar tamanho e MIME
-- sem afetar imagens existentes do site.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pixico-registration',
  'pixico-registration',
  true,
  524288,
  array['image/jpeg']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pixico_registration_upload on storage.objects;
create policy pixico_registration_upload
on storage.objects
for insert
to anon
with check (
  bucket_id = 'pixico-registration'
  and (storage.foldername(name))[1] = 'pending'
  and storage.extension(name) = 'jpg'
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.jpg$'
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  photo_url text := nullif(btrim(new.raw_user_meta_data->>'fotoUrl'), '');
  photo_path text := nullif(btrim(new.raw_user_meta_data->>'fotoPath'), '');
begin
  if photo_url is null or photo_path is null then
    raise exception 'Foto de perfil obrigatória.';
  end if;

  if photo_path !~ '^pending/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.jpg$'
     or position('/storage/v1/object/public/pixico-registration/' || photo_path in photo_url) = 0
     or not exists (
       select 1
       from storage.objects o
       where o.bucket_id = 'pixico-registration'
         and o.name = photo_path
     )
  then
    raise exception 'Foto de perfil inválida.';
  end if;

  insert into public.profiles(id, nome, sobrenome, whatsapp, role, foto_url, nascimento, observacoes, email)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'nome',''),
    coalesce(new.raw_user_meta_data->>'sobrenome',''),
    new.raw_user_meta_data->>'whatsapp',
    'client',
    photo_url,
    nullif(new.raw_user_meta_data->>'nascimento','')::date,
    coalesce(new.raw_user_meta_data->>'observacoes',''),
    new.email
  );
  return new;
end
$function$;
