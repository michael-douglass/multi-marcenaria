-- Marca neutra (docs/marca-neutra, T09): o campo de sistema do programa passa a se chamar "Pontua".
-- O trigger de proteção trava o nome do campo (NEW.nome := OLD.nome); por isso fica desligado só aqui.
alter table crm.lead_custom_field_definitions disable trigger trg_proteger_campo_pontua;
update crm.lead_custom_field_definitions
   set nome = 'Pontua'
 where lower(btrim(nome)) like 'pontua %' and tipo = 'usuario_sistema' and config_pontua is not null;
alter table crm.lead_custom_field_definitions enable trigger trg_proteger_campo_pontua;
