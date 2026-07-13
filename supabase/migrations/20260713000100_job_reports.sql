-- Job reports table for quick backend reporting
CREATE TABLE public.job_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'quick_report',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.job_reports TO authenticated;
GRANT ALL ON public.job_reports TO service_role;
ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_reports_select_involved_or_admin" ON public.job_reports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND (j.poster_id = auth.uid() OR j.assigned_provider_id = auth.uid())
    )
  );

CREATE POLICY "job_reports_insert_involved" ON public.job_reports FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND (j.poster_id = auth.uid() OR j.assigned_provider_id = auth.uid())
    )
  );
