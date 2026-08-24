-- OAuth credentials are server-only. RLS has no client policies on these
-- tables, and explicit grants keep them out of browser-facing PostgREST roles.
REVOKE ALL ON TABLE public.meta_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.meta_instagram_accounts FROM anon, authenticated;
GRANT ALL ON TABLE public.meta_connections TO service_role;
GRANT ALL ON TABLE public.meta_instagram_accounts TO service_role;

-- Collected account insights are shared with signed-in Velocity users.
REVOKE ALL ON TABLE public.ig_account_insights FROM anon, authenticated;
GRANT SELECT ON TABLE public.ig_account_insights TO authenticated;
GRANT ALL ON TABLE public.ig_account_insights TO service_role;

GRANT USAGE ON TYPE public.ig_scrape_data_source TO authenticated, service_role;
GRANT USAGE ON TYPE public.meta_oauth_provider TO service_role;
