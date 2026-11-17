-- M08 (ajuste) — todas as empresas compartilham o schema crm: schema_nome deixa de ser único.
alter table public."CRM-multi-empresas>empresas<" drop constraint if exists "CRM-multi-empresas>empresas<_schema_nome_key";
alter table public."CRM-multi-empresas>empresas<" alter column schema_nome set default 'crm';
