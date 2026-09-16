-- Compatibilidade para bancos em que migrations públicas anteriores não foram aplicadas.
-- O Painel 1 precisa conseguir ler apenas o catálogo público; escritas continuam protegidas.

GRANT SELECT ON public.businesses TO anon;
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.professionals TO anon;
GRANT SELECT ON public.business_hours TO anon;
GRANT SELECT ON public.time_blocks TO anon;

DROP POLICY IF EXISTS "businesses_public_read" ON public.businesses;
CREATE POLICY "businesses_public_read"
  ON public.businesses
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "services_public_read" ON public.services;
CREATE POLICY "services_public_read"
  ON public.services
  FOR SELECT TO anon
  USING (active);

DROP POLICY IF EXISTS "professionals_public_read" ON public.professionals;
CREATE POLICY "professionals_public_read"
  ON public.professionals
  FOR SELECT TO anon
  USING (active);

DROP POLICY IF EXISTS "business_hours_public_read" ON public.business_hours;
CREATE POLICY "business_hours_public_read"
  ON public.business_hours
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "time_blocks_public_read" ON public.time_blocks;
CREATE POLICY "time_blocks_public_read"
  ON public.time_blocks
  FOR SELECT TO anon
  USING (true);

DO $$
BEGIN
  IF to_regclass('public.service_professionals') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.service_professionals TO anon';
    EXECUTE 'DROP POLICY IF EXISTS "service_professionals_public_read" ON public.service_professionals';
    EXECUTE $policy$
      CREATE POLICY "service_professionals_public_read"
      ON public.service_professionals
      FOR SELECT TO anon
      USING (
        EXISTS (
          SELECT 1 FROM public.services s
          WHERE s.id = service_id AND s.active AND COALESCE(s.show_service, true)
        )
        AND EXISTS (
          SELECT 1 FROM public.professionals p
          WHERE p.id = professional_id AND p.active
        )
      )
    $policy$;
  END IF;
END $$;
