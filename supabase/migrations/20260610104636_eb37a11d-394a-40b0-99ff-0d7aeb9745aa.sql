
CREATE TABLE public.wallets (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_naira INTEGER NOT NULL DEFAULT 0 CHECK (balance_naira >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_select_own_or_admin" ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wallets_insert_own" ON public.wallets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wallets_update_own_or_admin" ON public.wallets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_naira INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deposit','earning','withdrawal','refund')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wt_select_own_or_admin" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wt_insert_own_or_admin" ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.apply_wallet_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance_naira)
  VALUES (NEW.user_id, GREATEST(0, NEW.amount_naira))
  ON CONFLICT (user_id) DO UPDATE
    SET balance_naira = public.wallets.balance_naira + NEW.amount_naira,
        updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_tx_apply
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_wallet_transaction();
