-- Vérifier et créer le type user_role s'il n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'client');
    END IF;
END $$;

-- Vérifier et créer les autres types s'ils n'existent pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN
        CREATE TYPE public.product_type AS ENUM ('mais', 'tourteau_soja', 'ble', 'orge');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_type') THEN
        CREATE TYPE public.deal_type AS ENUM ('prime', 'flat');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revente_status') THEN
        CREATE TYPE public.revente_status AS ENUM ('en_attente', 'vendu', 'retire');
    END IF;
END $$;

-- Recréer la fonction handle_new_user avec le bon type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.clients (user_id, nom, role, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nom', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;