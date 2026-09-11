-- Preserve legacy clients while new reservation handlers send explicit timezone-aware instants.
CREATE OR REPLACE FUNCTION public.reservas_ajustar_horario_bahia()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('solucoes.reserva_horario_explicito', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.inicio := NEW.inicio + interval '3 hours';
      NEW.fim := NEW.fim + interval '3 hours';
    ELSE
      IF NEW.inicio IS DISTINCT FROM OLD.inicio THEN
        NEW.inicio := NEW.inicio + interval '3 hours';
      END IF;
      IF NEW.fim IS DISTINCT FROM OLD.fim THEN
        NEW.fim := NEW.fim + interval '3 hours';
      END IF;
    END IF;
  END IF;
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;
