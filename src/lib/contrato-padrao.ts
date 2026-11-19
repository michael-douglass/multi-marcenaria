/**
 * Modelo de contrato padrão (móveis planejados) — o mesmo que o banco cria em toda empresa nova
 * (`crm_seed_contrato_padrao`, supabase/migrations/20261118130000_contrato_padrao.sql).
 * PAR COM O SQL: ao mudar o texto ou os campos aqui, crie uma migration nova com o mesmo conteúdo.
 * `scripts/test-contrato-padrao.mjs` confere que os dois continuam iguais.
 * Ver docs/contrato-padrao/DESIGN.md.
 */
import type { ContratoVariavel } from '@/hooks/useContratosVariaveis';

export const CONTRATO_PADRAO_NOME = 'Contrato padrão — móveis planejados';

export type CampoContratoPadrao = Omit<ContratoVariavel, 'id'>;

/** 17 campos (ordem = ordem no formulário). */
export const CONTRATO_PADRAO_CAMPOS: ReadonlyArray<CampoContratoPadrao> = [
  { nome: 'cpf', label: 'CPF do Contratante', tipo: 'cpf', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: false, ordem: -1 },
  { nome: 'nome_do_cliente', label: 'Nome do cliente', tipo: 'texto', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: true, ordem: 1 },
  { nome: 'endereco', label: 'Endereço do cliente', tipo: 'texto', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: false, ordem: 2 },
  { nome: 'telefone', label: 'Telefone do cliente', tipo: 'texto', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: true, ordem: 3 },
  { nome: 'email', label: 'E-mail do cliente', tipo: 'texto', valor_padrao: null, obrigatorio: false, mostrar_no_link_publico: true, ordem: 4 },
  { nome: 'valor_total', label: 'Valor total', tipo: 'valor', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: false, ordem: 10 },
  { nome: 'ambientes_contemplados', label: 'Ambientes contemplados', tipo: 'texto', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: false, ordem: 11 },
  { nome: 'prazo_entrega_dias', label: 'Prazo de entrega (dias corridos)', tipo: 'numero', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: false, ordem: 12 },
  { nome: 'data_inicio_obra', label: 'Início da contagem do prazo', tipo: 'data', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: false, ordem: 13 },
  { nome: 'data_assinatura', label: 'Data da assinatura', tipo: 'data', valor_padrao: null, obrigatorio: true, mostrar_no_link_publico: false, ordem: 14 },
  { nome: 'percentual_entrada', label: 'Entrada (%)', tipo: 'numero', valor_padrao: '60', obrigatorio: true, mostrar_no_link_publico: false, ordem: 20 },
  { nome: 'garantia_anos', label: 'Garantia (anos)', tipo: 'numero', valor_padrao: '2', obrigatorio: true, mostrar_no_link_publico: false, ordem: 21 },
  { nome: 'tolerancia_dias', label: 'Tolerância (dias)', tipo: 'numero', valor_padrao: '10', obrigatorio: true, mostrar_no_link_publico: false, ordem: 22 },
  { nome: 'prazo_ajustes_dias', label: 'Prazo para pedir ajustes (dias)', tipo: 'numero', valor_padrao: '30', obrigatorio: true, mostrar_no_link_publico: false, ordem: 23 },
  { nome: 'foro_cidade', label: 'Foro (cidade/UF)', tipo: 'texto', valor_padrao: '{{empresa_cidade_uf}}', obrigatorio: true, mostrar_no_link_publico: false, ordem: 24 },
  { nome: 'chave_pix', label: 'Chave PIX', tipo: 'texto', valor_padrao: '{{empresa_cnpj}}', obrigatorio: true, mostrar_no_link_publico: false, ordem: 25 },
  { nome: 'incluir_clausula_imagem', label: 'Incluir cláusula de uso de imagem', tipo: 'sim_nao', valor_padrao: 'sim', obrigatorio: false, mostrar_no_link_publico: false, ordem: 26 },
];

export const CONTRATO_PADRAO_TEXTO = `CONTRATO DE PRESTAÇÃO DE SERVIÇO DE CONSTRUÇÃO, INSTALAÇÃO E MONTAGEM DE MÓVEIS PLANEJADOS

Por este instrumento particular de prestação de serviço, de um lado:
CONTRATANTE: {{nome_do_cliente}}, brasileiro(a), inscrito no CPF sob o nº {{cpf}}, residente e domiciliado {{endereco}}, Telefone: {{telefone}}.

CONTRATADO: {{empresa_razao_social}}, inscrita no CNPJ sob o nº {{empresa_cnpj}}, Telefone: {{empresa_telefone}}, neste ato representada por {{empresa_representante_nome}}, {{empresa_representante_qualificacao}}, inscrito no CPF sob o nº {{empresa_representante_cpf}}, com endereço profissional na {{empresa_endereco}}.

Têm entre si, justo e contratado, a PRESTAÇÃO DE SERVIÇOS DE MARCENARIA, mediante os termos e condições abaixo discriminados.

1. DO OBJETO DA CONTRATAÇÃO
1.1 Por se tratar de produção de móveis personalizados e pré-aprovados pela CONTRATANTE, não serão permitidas trocas de nenhuma natureza nos materiais descritos na especificação técnica, exceto aquelas eventualmente necessárias e detectadas no momento da medição técnica, bem como aquelas que não prejudiquem o orçamento aprovado, sob pena de variação no preço do objeto contratado.
1.2 A CONTRATADA não será responsável pelos serviços de elétrica e hidráulica, bem como adaptações e/ou adequações de alvenaria, elétrica ou estrutura de rebocos e paredes no local onde serão instalados os móveis.
1.3 Para a instalação dos móveis com fita LED e outros componentes elétricos, deverá a CONTRATADA, após análise das partes e se necessário, prover a contratação de profissional eletricista para acompanhar a montagem, de forma que a instalação não fique prejudicada.
2. DO PREÇO E CONDIÇÕES DE PAGAMENTO
2.1 O preço total acordado para o conjunto dos móveis planejados, incluindo todo o material, ferragens especiais, visitas técnicas de medição, instalação e acabamento, é de R$ {{valor_total}} ({{valor_total_extenso}}), o qual será quitado pelo CONTRATANTE da seguinte forma:
a) Entrada ({{percentual_entrada}}%): O valor de R$ {{valor_entrada}} ({{valor_entrada_extenso}}), a ser pago obrigatoriamente por meio de transferência eletrônica instantânea via PIX (Chave PIX: {{chave_pix}} - {{empresa_nome}}) no ato de assinatura deste instrumento. Este contrato passará a ser plenamente efetivo e o início dos prazos de fabricação e entrega previstos na Cláusula 4.1 passará a contar somente após a efetiva compensação e recebimento do referido pagamento via PIX;
b) Entrega ({{percentual_saldo}}%): O valor restante de R$ {{valor_saldo}} ({{valor_saldo_extenso}}), a ser pago imediatamente após a efetiva entrega, montagem e finalização de todos os móveis objeto deste contrato.
2.2 Caso o projeto aprovado seja modificado, por pedido ou mediante autorização da CONTRATANTE, durante a visita técnica de medição e posterior execução, poderá o CONTRATADO reajustar o valor do ORÇAMENTO.
3. DAS OBRIGAÇÕES DAS PARTES
3.1 Sendo obrigações do CONTRATANTE:
a) Disponibilizar o local da montagem livre de obras de construção ou reforma. Se por qualquer motivo a instalação for sobrestada em razão de tais obras, o pagamento referente à montagem deverá ser creditado até a data estipulada da entrega total, para que esta seja remarcada de comum acordo, não sendo os CONTRATADOS responsabilizados por atrasos a que não deram causa;
b) Apresentar ao profissional responsável pela montagem e instalação dos bens a planta hidráulica, elétrica, de aquecimento, refrigeração ou de gás do local. A inobservância desta cláusula desobriga o CONTRATADO de qualquer responsabilidade por eventuais danos de instalação;
c) Apresentar-se ou designar responsável no local da montagem, nos dias e horários combinados com o CONTRATADO, para viabilizar a realização dos serviços;
d) O CONTRATADO exime-se de qualquer responsabilidade referente a: existência de rebocos e tijolos frágeis ou de má qualidade que impeçam a sustentação robusta dos móveis; desníveis de paredes que impossibilitem a instalação segura; e ocorrência de focos de umidade, exposição solar excessiva ou infestações de insetos que possam danificar os bens.
3.2 Sendo obrigações dos CONTRATADOS:
a) Empregar as melhores técnicas e utilizar os melhores materiais para a execução do projeto ora contratado;
b) Cumprir todos os prazos aqui estipulados e cientificar o CONTRATANTE sobre as etapas de cumprimento dos serviços;
c) Produzir, instalar e adaptar o móvel na estrutura do ambiente, de acordo com o projeto de interiores referenciado;
d) Garantir o funcionamento de toda a estrutura, fornecendo garantia de {{garantia_anos}} ({{garantia_anos_extenso}}) anos, desde que o ambiente esteja livre de vazamentos e outros vícios que possam comprometer a integridade da madeira e/ou dos revestimentos.
4. DOS PRAZOS E OUTRAS AVENÇAS
4.1 É obrigação do CONTRATADO entregar, instalar e montar os produtos no prazo de {{prazo_entrega_dias}} ({{prazo_entrega_dias_extenso}}) dias corridos a contar do dia {{data_inicio_obra}}, observado o condicionante de efetivação do contrato descrito na Cláusula 2.1 (a). Considera-se também um prazo de {{tolerancia_dias}} ({{tolerancia_dias_extenso}}) dias de tolerância em caso de imprevistos devidamente justificados, observando-se o seguinte:
a) O CONTRATADO informará acerca do desenvolvimento da produção e realizará as instalações em etapas, de modo que no prazo indicado, todos os móveis estejam devidamente instalados;
b) Caso ocorram avarias nos móveis já instalados em razão da movimentação de outros prestadores de serviço no decorrer da finalização da obra, não haverá cobertura pela garantia do CONTRATADO;
c) Eventuais ajustes, regulagens e acabamentos adicionais podem ser realizados após a entrega, desde que solicitados pelo CONTRATANTE, não sendo computados no prazo limite do item 4.1.
4.2 Instalados e montados os produtos, a CONTRATANTE terá o prazo de {{prazo_ajustes_dias}} ({{prazo_ajustes_dias_extenso}}) dias para sinalizar a necessidade de ajustes técnicos adicionais.
4.3 A vigência do presente contrato inicia-se na data de sua assinatura e encerra-se com a efetiva entrega dos serviços.
{{#se incluir_clausula_imagem}}
4.4 A CONTRATANTE autoriza a captação de imagens do processo de construção e finalização dos móveis planejados contratados para veiculação nas redes sociais do CONTRATADO, comprometendo-se este a preservar dados pessoais, endereço e valores, limitando-se à exibição do ambiente trabalhado (registro de "antes" e "depois").
{{/se}}

5. DESCRITIVO E ESPECIFICAÇÕES TÉCNICAS DO PROJETO
5.1 Ambientes Contemplados
{{ambientes_contemplados}}

5.2 Especificações de Materiais e Acabamentos
Corrediça telescópica oferece suavidade, enquanto a invisível proporciona estética e qualidade. Dobradiças com amortecimento garantem durabilidade e conforto. Já a dobradiça 3D se destaca pela regulagem precisa, acabamento sofisticado e melhor alinhamento das portas, proporcionando mais estabilidade, praticidade e um padrão superior.

6. DO FORO
As partes elegem o Foro da Comarca de {{foro_cidade}} para dirimir quaisquer dúvidas ou controvérsias oriundas deste instrumento, renunciando expressamente a qualquer outro, por mais privilegiado que seja.
E, por estarem justas e contratadas, assinam o presente instrumento em duas vias de igual teor e forma na presença das testemunhas abaixo designadas.

{{empresa_cidade_uf}}, {{data_assinatura}}.`;
