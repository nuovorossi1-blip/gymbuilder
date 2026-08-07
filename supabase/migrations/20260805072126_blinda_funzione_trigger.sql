-- handle_new_user e' una funzione di trigger: nessuno deve poterla chiamare via API
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;;
