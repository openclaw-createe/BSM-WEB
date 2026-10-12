create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.handle_admin_signup()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if lower(new.email) = 'info@barbershopmachine.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.handle_admin_signup();
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'info@barbershopmachine.com' on conflict do nothing;

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "Anyone reads settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins insert settings" on public.site_settings for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update settings" on public.site_settings for update to authenticated using (public.has_role(auth.uid(), 'admin'));
insert into public.site_settings (id, content) values (1, '{}'::jsonb);

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  alt text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.gallery_photos to anon, authenticated;
grant insert, update, delete on public.gallery_photos to authenticated;
grant all on public.gallery_photos to service_role;
alter table public.gallery_photos enable row level security;
create policy "Anyone reads photos" on public.gallery_photos for select to anon, authenticated using (true);
create policy "Admins insert photos" on public.gallery_photos for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update photos" on public.gallery_photos for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete photos" on public.gallery_photos for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select, update on public.bookings to authenticated;
create policy "Admins read bookings" on public.bookings for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Public read gallery files" on storage.objects for select using (bucket_id = 'gallery');
create policy "Admins upload gallery files" on storage.objects for insert to authenticated with check (bucket_id = 'gallery' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete gallery files" on storage.objects for delete to authenticated using (bucket_id = 'gallery' and public.has_role(auth.uid(), 'admin'));