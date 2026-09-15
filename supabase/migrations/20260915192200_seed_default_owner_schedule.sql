-- Garante que todo estabelecimento novo criado pelo Painel Master
-- já entre no Painel 2 com uma grade semanal utilizável.
CREATE OR REPLACE FUNCTION public.seed_default_business_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.business_hours (business_id, weekday, starts_at, ends_at)
  VALUES
    (NEW.id, 1, '08:30', '19:00'),
    (NEW.id, 2, '08:30', '19:00'),
    (NEW.id, 3, '08:30', '19:00'),
    (NEW.id, 4, '08:30', '19:00'),
    (NEW.id, 5, '08:30', '19:00'),
    (NEW.id, 6, '08:30', '19:00')
  ON CONFLICT (business_id, weekday) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_default_business_hours_on_business ON public.businesses;
CREATE TRIGGER seed_default_business_hours_on_business
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_business_hours();
