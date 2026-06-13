-- Messages for job conversations and attachments
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_involved_or_admin" ON public.messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND (j.poster_id = auth.uid() OR j.assigned_provider_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert_involved_or_admin" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = job_id
          AND (j.poster_id = auth.uid() OR j.assigned_provider_id = auth.uid())
      )
    )
  );
