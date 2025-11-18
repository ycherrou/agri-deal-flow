-- Renommer actif en active dans echeances pour correspondre au code TypeScript
ALTER TABLE public.echeances RENAME COLUMN actif TO active;

-- Renommer actif en active dans lignes_bancaires 
ALTER TABLE public.lignes_bancaires RENAME COLUMN actif TO active;

-- Renommer actif en active dans whatsapp_templates
ALTER TABLE public.whatsapp_templates RENAME COLUMN actif TO active;