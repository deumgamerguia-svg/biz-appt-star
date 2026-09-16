-- Dias da semana em que cada serviço pode ser agendado.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS working_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6]::smallint[];
