CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','accepted','declined','busy','missed','cancelled','ended')),
  offer text NOT NULL CHECK (length(offer) BETWEEN 10 AND 20000),
  answer text CHECK (answer IS NULL OR length(answer) BETWEEN 10 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  CHECK (caller_id <> callee_id)
);
CREATE INDEX calls_callee_idx ON public.calls (callee_id, created_at DESC);
CREATE INDEX calls_caller_idx ON public.calls (caller_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read their calls" ON public.calls
  FOR SELECT TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Members start calls" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = caller_id
    AND status = 'ringing'
    AND answer IS NULL
    AND NOT public.is_banned(auth.uid())
    AND NOT public.is_banned(callee_id)
  );

CREATE POLICY "Participants update their calls" ON public.calls
  FOR UPDATE TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE OR REPLACE FUNCTION public.guard_call_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF NEW.caller_id <> OLD.caller_id OR NEW.callee_id <> OLD.callee_id
     OR NEW.offer <> OLD.offer OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'call identity is immutable';
  END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.answer IS DISTINCT FROM OLD.answer THEN RAISE EXCEPTION 'answer is immutable'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'ringing' AND NEW.status IN ('accepted','declined','busy') THEN
    IF _uid IS DISTINCT FROM OLD.callee_id THEN RAISE EXCEPTION 'only the callee can respond'; END IF;
    IF NEW.status = 'accepted' THEN
      IF NEW.answer IS NULL THEN RAISE EXCEPTION 'answer required'; END IF;
      NEW.answered_at := now();
    ELSE
      NEW.answer := NULL;
      NEW.ended_at := now();
    END IF;
  ELSIF OLD.status = 'ringing' AND NEW.status IN ('cancelled','missed') THEN
    IF _uid IS DISTINCT FROM OLD.caller_id THEN RAISE EXCEPTION 'only the caller can cancel'; END IF;
    NEW.answer := NULL;
    NEW.ended_at := now();
  ELSIF OLD.status = 'accepted' AND NEW.status = 'ended' THEN
    IF NEW.answer IS DISTINCT FROM OLD.answer THEN RAISE EXCEPTION 'answer is immutable'; END IF;
    NEW.ended_at := now();
  ELSE
    RAISE EXCEPTION 'invalid call transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER calls_guard_update
BEFORE UPDATE ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.guard_call_update();

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;