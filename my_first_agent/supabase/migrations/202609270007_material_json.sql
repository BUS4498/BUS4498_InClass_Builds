begin;
do $$ begin
 if not exists (select 1 from storage.buckets where id='career-prep-private' and public=false) then
  raise exception 'Expected existing private career-prep-private bucket; stop and inspect';
 end if;
end $$;
update storage.buckets
 set allowed_mime_types=array_append(allowed_mime_types,'application/json')
 where id='career-prep-private' and public=false
 and allowed_mime_types is not null
 and not ('application/json'=any(allowed_mime_types));
-- Preserve private access, size limit, existing formats, and all stored objects.
commit;
