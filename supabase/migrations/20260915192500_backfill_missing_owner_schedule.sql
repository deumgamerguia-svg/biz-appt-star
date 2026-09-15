-- Completa somente estabelecimentos que ainda não possuem nenhum dia configurado.
-- Negócios que já têm horários definidos permanecem exatamente como estão.
INSERT INTO public.business_hours (business_id, weekday, starts_at, ends_at)
SELECT b.id, d.weekday, '08:30'::time, '19:00'::time
FROM public.businesses b
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6)) AS d(weekday)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.business_hours bh
  WHERE bh.business_id = b.id
)
ON CONFLICT (business_id, weekday) DO NOTHING;
