CREATE TABLE IF NOT EXISTS public.real_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('platform_post', 'manual')),
  source_post_id UUID NULL REFERENCES public.posts(id) ON DELETE SET NULL,
  my_side TEXT NOT NULL DEFAULT 'other' CHECK (my_side IN ('buy', 'sell', 'other')),
  counterparty_name TEXT NULL,
  counterparty_contact TEXT NULL,
  subject_title TEXT NOT NULL,
  category_name TEXT NULL,
  trade_type_label TEXT NULL,
  quantity NUMERIC(18, 4) NULL,
  unit_price NUMERIC(18, 2) NULL,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  deal_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_method TEXT NULL,
  payment_method TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
  notes TEXT NULL,
  subject_snapshot JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_orders_created_by_user_id
  ON public.real_orders(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_real_orders_deal_at
  ON public.real_orders(deal_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_orders_status
  ON public.real_orders(status);

CREATE INDEX IF NOT EXISTS idx_real_orders_source_post_id
  ON public.real_orders(source_post_id);

CREATE OR REPLACE FUNCTION public.set_real_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_real_orders_updated_at ON public.real_orders;

CREATE TRIGGER set_real_orders_updated_at
BEFORE UPDATE ON public.real_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_real_orders_updated_at();

ALTER TABLE public.real_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon and service role can manage real orders" ON public.real_orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.real_orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.real_orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.real_orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.real_orders;
