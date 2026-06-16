-- =============================================================
-- Trust Score automático — Predikta
-- Ejecutar en Supabase → SQL Editor
-- =============================================================

-- Función helper: ajusta trust_score + level + registra historial
CREATE OR REPLACE FUNCTION adjust_trust_score(
  p_user_id   UUID,
  p_delta     INT,
  p_reason    TEXT,
  p_ref_id    UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_current   INT;
  v_new       INT;
  v_level     TEXT;
BEGIN
  SELECT trust_score INTO v_current FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_new := GREATEST(0, LEAST(100, v_current + p_delta));

  -- Calcular nivel (igual que la app)
  IF v_new >= 90 THEN v_level := 'premium';
  ELSIF v_new >= 80 THEN v_level := 'verificado';
  ELSE v_level := 'nuevo';
  END IF;

  UPDATE users SET trust_score = v_new, level = v_level::user_level WHERE id = p_user_id;

  INSERT INTO trust_score_history (user_id, delta, reason, reference_id, score_after)
  VALUES (p_user_id, p_delta, p_reason::trust_reason, p_ref_id, v_new);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================
-- TRIGGER 1: cambios de status en markets
-- approved  → creador +2
-- rejected  → creador -10
-- resolved  → creador +3
-- =============================================================
CREATE OR REPLACE FUNCTION trg_market_status_trust() RETURNS TRIGGER AS $$
BEGIN
  -- Solo actuar cuando status realmente cambia
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  IF NEW.status = 'approved' THEN
    PERFORM adjust_trust_score(NEW.creator_id, 2, 'Mercado aprobado', NEW.id);

  ELSIF NEW.status = 'rejected' THEN
    PERFORM adjust_trust_score(NEW.creator_id, -10, 'Mercado rechazado', NEW.id);

  ELSIF NEW.status = 'resolved' THEN
    PERFORM adjust_trust_score(NEW.creator_id, 3, 'Mercado resuelto exitosamente', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS market_status_trust_trigger ON markets;
CREATE TRIGGER market_status_trust_trigger
  AFTER UPDATE OF status ON markets
  FOR EACH ROW EXECUTE FUNCTION trg_market_status_trust();


-- =============================================================
-- TRIGGER 2: cambios de status en participations
-- won → apostador +2
-- =============================================================
CREATE OR REPLACE FUNCTION trg_participation_status_trust() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  IF NEW.status = 'won' THEN
    PERFORM adjust_trust_score(NEW.user_id, 2, 'Predicción correcta', NEW.market_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS participation_status_trust_trigger ON participations;
CREATE TRIGGER participation_status_trust_trigger
  AFTER UPDATE OF status ON participations
  FOR EACH ROW EXECUTE FUNCTION trg_participation_status_trust();
