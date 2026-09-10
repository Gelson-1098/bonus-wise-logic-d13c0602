-- Padroniza siglas oficiais das lojas já cadastradas
UPDATE public.stores SET code = 'DACLI' WHERE code = 'ACL';
UPDATE public.stores SET code = 'DCAMB' WHERE code = 'CBL';
UPDATE public.stores SET code = 'DGGOP' WHERE code = 'GGP';
UPDATE public.stores SET code = 'DJDCA' WHERE code = 'JCB';
UPDATE public.stores SET code = 'DPCAN' WHERE code = 'PDC';
UPDATE public.stores SET code = 'DPINH' WHERE code = 'PNH';
UPDATE public.stores SET code = 'DPQMA' WHERE code = 'PMQ';
UPDATE public.stores SET code = 'DSRRA' WHERE code = 'SRR';
UPDATE public.stores SET code = 'DVCLE' WHERE code = 'VCL';
UPDATE public.stores SET code = 'DAGUA' WHERE code = 'AGR';

-- Cria as unidades oficiais ausentes
INSERT INTO public.stores (name, code, city, state, active)
SELECT 'Jabaquara', 'DJABA', 'São Paulo', 'SP', true
WHERE NOT EXISTS (SELECT 1 FROM public.stores WHERE code = 'DJABA');

INSERT INTO public.stores (name, code, city, state, active)
SELECT 'Aeroporto de Guarulhos', 'DAGUA', 'Guarulhos', 'SP', true
WHERE NOT EXISTS (SELECT 1 FROM public.stores WHERE code = 'DAGUA');