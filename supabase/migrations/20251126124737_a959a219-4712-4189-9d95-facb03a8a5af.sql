-- Remove refund tracking columns from payments table
ALTER TABLE public.payments
DROP COLUMN IF EXISTS refunded_at,
DROP COLUMN IF EXISTS refund_amount,
DROP COLUMN IF EXISTS refund_reason,
DROP COLUMN IF EXISTS refunded_by;

-- Drop the refund index
DROP INDEX IF EXISTS idx_payments_refunded_at;