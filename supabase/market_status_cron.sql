-- =============================================================
-- Cron automático de estados de mercados — Predikta
-- Ejecutar en Supabase → SQL Editor
-- Requiere extensión pg_cron (habilitada por defecto en Supabase)
-- =============================================================

-- Habilitar pg_cron si no está activo
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Función que actualiza estados vencidos
CREATE OR REPLACE FUNCTION update_expired_markets() RETURNS void AS $$
BEGIN
  -- Pending vencidos → cancelled (nunca se aprobaron a tiempo)
  UPDATE markets
  SET status = 'cancelled'
  WHERE status = 'pending'
    AND close_date < NOW();

  -- Approved/active vencidos → closed (listos para resolver)
  UPDATE markets
  SET status = 'closed'
  WHERE status IN ('approved', 'active')
    AND close_date < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar inmediatamente para limpiar el estado actual
SELECT update_expired_markets();

-- Programar ejecución cada hora
SELECT cron.schedule(
  'update-expired-markets',   -- nombre del job (único)
  '0 * * * *',                -- cada hora en punto
  'SELECT update_expired_markets()'
);
