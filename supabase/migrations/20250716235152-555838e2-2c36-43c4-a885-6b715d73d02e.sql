-- Confirmer tous les utilisateurs existants qui ne sont pas confirmés
UPDATE auth.users 
SET email_confirmed_at = now(), 
    updated_at = now()
WHERE email_confirmed_at IS NULL;