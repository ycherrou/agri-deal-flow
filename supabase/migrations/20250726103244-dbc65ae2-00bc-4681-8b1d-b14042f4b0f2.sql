-- Corriger le parent_deal_id pour le deal 769b1a1e qui est issu du marché secondaire
UPDATE ventes 
SET parent_deal_id = 'f9d0074a-9d5c-4e36-ab70-8f0cf7b54809',
    updated_at = now()
WHERE id = '769b1a1e-c82e-4a65-8925-84cbd20588a5';