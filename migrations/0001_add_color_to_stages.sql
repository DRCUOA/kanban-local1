-- Add color column to stages table
ALTER TABLE "stages" ADD COLUMN IF NOT EXISTS "color" text;
