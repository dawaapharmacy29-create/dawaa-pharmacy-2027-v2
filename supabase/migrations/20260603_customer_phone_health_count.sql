create or replace function public.count_invalid_customer_summary_phones()
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.customer_metrics_summary cms
  where public.dawaa_normalize_egypt_mobile(cms.customer_phone, cms.customer_code) is null;
$$;
