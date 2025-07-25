-- Corriger la fonction get_contract_size - DDGS et Ferrailles n'ont pas de taille de contrat (0)
CREATE OR REPLACE FUNCTION public.get_contract_size(produit_type text)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    CASE produit_type::product_type
        WHEN 'mais' THEN RETURN 127;
        WHEN 'tourteau_soja' THEN RETURN 90.10;
        WHEN 'ble' THEN RETURN 50;
        WHEN 'orge' THEN RETURN 50;
        WHEN 'ddgs' THEN RETURN 0;  -- Pas de contrats futures pour DDGS
        WHEN 'ferrailles' THEN RETURN 0;  -- Pas de contrats futures pour Ferrailles
        ELSE RETURN 0;
    END CASE;
END;
$function$