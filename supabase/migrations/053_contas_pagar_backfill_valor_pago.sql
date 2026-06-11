-- Contas marcadas como pagas antes do campo valor_pago: preenche com o valor da parcela
UPDATE movelaria_contas_pagar
SET valor_pago = valor_parcela
WHERE status = 'pago'
  AND COALESCE(valor_pago, 0) = 0;
