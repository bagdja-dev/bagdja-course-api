-- Migration: Add platform_product_id to courses table
-- This column links a local course to a product registered on the Bagdja Platform

ALTER TABLE "public"."courses" ADD COLUMN "platform_product_id" uuid;

-- Update existing courses with the provided platform product ID
UPDATE "public"."courses" SET "platform_product_id" = '72945a63-c27d-473b-a9fa-716057777100';

-- Migration: Add platform_product_id to books table
ALTER TABLE "public"."books" ADD COLUMN "platform_product_id" uuid;

-- Update existing books with the provided platform product ID
UPDATE "public"."books" SET "platform_product_id" = '5f56fc53-d3e7-4c5d-a7f0-909de676d45d';
