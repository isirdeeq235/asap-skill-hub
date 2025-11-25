-- Enable realtime for payments table
ALTER TABLE public.payments REPLICA IDENTITY FULL;

-- Add payments table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;