-- Add refund tracking columns to payments table
ALTER TABLE public.payments
ADD COLUMN refunded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN refund_amount NUMERIC DEFAULT 0,
ADD COLUMN refund_reason TEXT,
ADD COLUMN refunded_by UUID REFERENCES auth.users(id);

-- Create index for faster refund queries
CREATE INDEX idx_payments_refunded_at ON public.payments(refunded_at);

-- Add comment
COMMENT ON COLUMN public.payments.refunded_at IS 'Timestamp when payment was refunded';
COMMENT ON COLUMN public.payments.refund_amount IS 'Amount refunded (can be partial)';
COMMENT ON COLUMN public.payments.refund_reason IS 'Reason for refund';
COMMENT ON COLUMN public.payments.refunded_by IS 'Admin user who processed the refund';