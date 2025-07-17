-- Corriger la fonction get_contract_size pour qu'elle accepte le type product_type
DROP FUNCTION IF EXISTS public.get_contract_size(text);

CREATE OR REPLACE FUNCTION public.get_contract_size(produit_type product_type)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    CASE produit_type
        WHEN 'mais' THEN RETURN 127;
        WHEN 'tourteau_soja' THEN RETURN 90.10;
        WHEN 'ble' THEN RETURN 50;
        WHEN 'orge' THEN RETURN 50;
        ELSE RETURN 0;
    END CASE;
END;
$function$;