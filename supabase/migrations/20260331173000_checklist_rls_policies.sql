alter table public.checklist enable row level security;

drop policy if exists "checklist_select_authenticated" on public.checklist;
drop policy if exists "checklist_insert_admin" on public.checklist;
drop policy if exists "checklist_update_admin" on public.checklist;
drop policy if exists "checklist_delete_admin" on public.checklist;

create policy "checklist_select_authenticated"
on public.checklist
for select
to authenticated
using (true);

create policy "checklist_insert_admin"
on public.checklist
for insert
to authenticated
with check (public.my_role() = 'admin');

create policy "checklist_update_admin"
on public.checklist
for update
to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

create policy "checklist_delete_admin"
on public.checklist
for delete
to authenticated
using (public.my_role() = 'admin');
