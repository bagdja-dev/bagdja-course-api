-- Migration: Add platform_ref_number to orders table
-- Goal: Store the reference number from Bagdja Platform Payment Service for better tracking and indexing

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='platform_ref_number') THEN
        ALTER TABLE "public"."orders" ADD COLUMN "platform_ref_number" text;
    END IF;
END $$;

-- Add index for faster lookups during webhook/reconciliation
CREATE INDEX IF NOT EXISTS orders_platform_ref_number_idx ON public.orders(platform_ref_number);

COMMENT ON COLUMN "public"."orders"."platform_ref_number" IS 'Reference number from Bagdja Platform Payment Service';
