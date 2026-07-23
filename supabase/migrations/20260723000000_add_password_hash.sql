-- Add password_hash column to profiles table for our own auth
ALTER TABLE public.profiles ADD COLUMN password_hash text;
