import type { ApprovoAlert, ApprovoSummary, ApprovoCriticidade, ApprovoEtapa, ApprovoTipoDocumento } from '@/types/approvo'
import { prisma } from './prisma'

// ─────────────────────────────────────────────────────────────────────────────
// approvoService — camada de acesso aos dados de Aprovações do Approvo.
//
// PRIVACIDADE: cada usuário vê SOMENTE a própria fila. As funções recebem as
// credenciais (códigos do Approvo) do usuário logado. Sem credenciais → sem dados.
// ─────────────────────────────────────────────────────────────────────────────

// Credenciais do Approvo por usuário (vêm do cadastro do usuário no GTec)
export type ApprovoCreds = {
  tipoAcesso: string
  codUsuario: number
  codPerfil: number
  codUsuarioMega: number
}

// Filtro padrão (genérico, não é específico de usuário) — capturado do DevTools.
const APPROVO_FILTRO_PADRAO =
  '{"codAplicacao":0,"status":"E","filtroNumValor":0,"filtroTexto":"","dataInicial":null,"dataFinal":null,"dataInicialAp":null,"dataFinalAp":null,"classeTab":0,"classePad":0,"classeIde":"","classeIn":0,"classe":"","cCustoTab":0,"cCustoPad":0,"cCustoIde":"","cCustoIn":0,"cCusto":"","projetoTab":0,"projetoPad":0,"projetoIde":"","projetoIn":0,"projeto":"","ordenacao":"R","paginacao":1,"filialIn":0,"filial":"","mobile":"N","ocultaApSuspensa":"N"}'

/** Lê as credenciais do Approvo do usuário logado. Retorna null se não configurado. */
export async function getApprovoCredsForUser(userId: string): Promise<ApprovoCreds | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { approvoTipoAcesso: true, approvoCodUsuario: true, approvoCodPerfil: true, approvoCodUsuarioMega: true },
  })
  if (!u || u.approvoCodUsuario == null || u.approvoCodPerfil == null || u.approvoCodUsuarioMega == null) {
    return null
  }
  return {
    tipoAcesso: u.approvoTipoAcesso ?? 'C',
    codUsuario: u.approvoCodUsuario,
    codPerfil: u.approvoCodPerfil,
    codUsuarioMega: u.approvoCodUsuarioMega,
  }
}

export const APPROVO_LINK =
  'https://approvocdg.megaerp.online/Alcada/ConsultaAlcada.aspx?acesso=vCZXXfA0hlDPO6T6d19p5Q%3d%3d'

// Endpoint real do Approvo (MegaERP) descoberto via DevTools
const APPROVO_BASE = 'https://approvocdg.megaerp.online/Alcada/WebMethodsAlcada.aspx'
const APPROVO_ENDPOINT = `${APPROVO_BASE}/ObterCardDocumentos`
const APPROVO_CONSULTA_BASE =
  'https://approvocdg.megaerp.online/Alcada/ConsultaAlcada.aspx'

/** Chama um WebMethod do Approvo e devolve o conteúdo de `d` já parseado. */
async function callApprovo(method: string, payload: object): Promise<any> {
  const res = await fetch(`${APPROVO_BASE}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(process.env.APPROVO_COOKIE ? { Cookie: process.env.APPROVO_COOKIE } : {}),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`${method} respondeu ${res.status}`)
  const raw = await res.json()
  const d = raw?.d
  return typeof d === 'string' ? JSON.parse(d) : d
}

/** Quebra a chave_completa nos componentes usados pelos WebMethods de detalhe. */
function parseChaveCompleta(chave: string) {
  const p = (chave ?? '').split(';')
  return {
    docInCodigo: Number(p[0]) || 0,
    numero:      p[1] ?? '',
    aplicacao:   Number(p[2]) || 0,
    orgTab:      Number(p[3]) || 0,
    orgPad:      Number(p[4]) || 0,
    orgIn:       Number(p[5]) || 0,
    orgTau:      p[6] ?? '',
    serTab:      Number(p[7]) || 0,
    serIn:       Number(p[8]) || 0,
    cotIn:       Number(p[9]) || 0,
  }
}

// ─── Helpers de parsing (a API pode mandar número como string PT-BR) ─────────

/** Retorna o primeiro campo (entre vários nomes possíveis) que tenha valor de texto. */
function firstStr(doc: any, keys: string[]): string {
  for (const k of keys) {
    const v = doc?.[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function parseValor(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    // "7.161,90" -> 7161.90  |  "7161.90" -> 7161.90
    const n = Number(v.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(n)) return n
    const n2 = Number(v)
    return isNaN(n2) ? 0 : n2
  }
  return 0
}

function parseDias(v: unknown): number {
  if (typeof v === 'number') return Math.floor(v)
  if (typeof v === 'string') {
    const m = v.match(/\d+/)
    return m ? parseInt(m[0], 10) : 0
  }
  return 0
}

function parseDataIso(v: unknown, diasPendente: number): string {
  if (typeof v === 'string' && v) {
    // formato /Date(123456789)/
    const ms = v.match(/\/Date\((\d+)\)\//)
    if (ms) return new Date(Number(ms[1])).toISOString()
    // formato dd/mm/yyyy
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/)
    if (br) {
      const ano = br[3].length === 2 ? `20${br[3]}` : br[3]
      const d = new Date(`${ano}-${br[2]}-${br[1]}T00:00:00`)
      if (!isNaN(d.getTime())) return d.toISOString()
    }
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  // fallback: calcula a partir dos dias pendentes
  return isoHaDias(diasPendente)
}

/** Mapeia o código de aplicação do Approvo para o nome do tipo de documento. */
function mapTipoDocumento(codigoAplicacao: unknown): string {
  const cod = Number(codigoAplicacao)
  if (cod === 17) return 'Solicitação de Obra'
  if (cod === 11) return 'Mapa de Cotação'
  return 'Documento Approvo'
}

/**
 * Regra de criticidade:
 * - normal:  até 1 dia pendente
 * - atenção: 2 dias pendente
 * - crítico: 3 dias ou mais  OU  valor > 50.000
 */
export function calcularCriticidade(diasPendente: number, valor: number): ApprovoCriticidade {
  if (diasPendente >= 3 || valor > 50000) return 'critico'
  if (diasPendente === 2) return 'atencao'
  return 'normal'
}

function isoHaDias(dias: number): string {
  return new Date(Date.now() - dias * 86400000).toISOString()
}

// ─── CADEIAS DE APROVAÇÃO (ALÇADA) por tipo de documento ─────────────────────
// ⚠️ Estes são apenas os NÍVEIS genéricos da alçada (sem nomes de pessoas).
// A estrutura real e os aprovadores nominais virão da API do Approvo.
const CADEIAS: Record<ApprovoTipoDocumento, string[]> = {
  'Mapa de Cotação':     ['Suprimentos', 'Coordenação', 'Diretoria'],
  'Medição de Contrato': ['Supervisão de Obra', 'Coordenação', 'Diretoria Técnica', 'Financeiro'],
  'Solicitação de Obra': ['Coordenação', 'Diretoria Técnica'],
  'Pedido de Compra':    ['Suprimentos', 'Coordenação', 'Financeiro'],
  'Aditivo Contratual':  ['Coordenação', 'Diretoria Técnica', 'Diretoria Geral'],
}

/** Monta a cadeia de etapas (níveis da alçada) dado o tipo e quantas já foram aprovadas. */
function montarEtapas(tipo: string, etapaAtual: number, diasPendente: number): ApprovoEtapa[] {
  const niveis = CADEIAS[tipo as ApprovoTipoDocumento] ?? []
  return niveis.map((nome, i) => {
    let status: ApprovoEtapa['status']
    if (i < etapaAtual) status = 'aprovado'
    else if (i === etapaAtual) status = 'pendente'
    else status = 'aguardando'
    const data = status === 'aprovado' ? isoHaDias(diasPendente + (etapaAtual - i)) : undefined
    // aprovador fica vazio no mock — será preenchido com o nome real pela API do Approvo
    return { ordem: i + 1, nome, aprovador: '', status, data }
  })
}

// ─── DADOS MOCKADOS ──────────────────────────────────────────────────────────
// ⚠️ DEMONSTRAÇÃO. Substituir pela resposta real da API do Approvo.
// Estrutura alinhada à tela real do Approvo: número, filial, solicitante, projeto.
// etapaAtual = quantos níveis da alçada já foram aprovados (o próximo é o "pendente").
const MOCK_BASE: (Omit<ApprovoAlert, 'data_criacao' | 'criticidade' | 'link_approvo' | 'etapas' | 'proximo_aprovador'> & { etapaAtual: number })[] = [
  { id: 'apv-2214', tipo_documento: 'Solicitação de Obra', numero_documento: '2214', descricao: 'Referente às saídas de materiais do almoxarifado local (baixas de reserva)', filial: 'Consorcio Taquarao - Filial',     solicitante: 'Ana Clivia',   contrato_vinculado: 'Taquarão',       projeto: 'Obras Taquarão',     centro_custo: 'Produção Própria', valor: 7161.90,  status: 'pendente', dias_pendente: 2, etapaAtual: 0 },
  { id: 'apv-0325', tipo_documento: 'Mapa de Cotação',     numero_documento: '325',  descricao: 'Mapa de cotação de materiais',                                            filial: 'Consorcio Aquiraz Pdd - Filial', solicitante: 'Maria Izabel', contrato_vinculado: 'PDD',            projeto: 'Obras PDD',          centro_custo: 'Produção Própria', valor: 24343.23, status: 'pendente', dias_pendente: 2, etapaAtual: 1 },
  { id: 'apv-0324', tipo_documento: 'Mapa de Cotação',     numero_documento: '324',  descricao: 'Mapa de cotação de materiais',                                            filial: 'Consorcio Aquiraz Pdd - Filial', solicitante: 'Maria Izabel', contrato_vinculado: 'PDD',            projeto: 'Obras PDD',          centro_custo: 'Produção Própria', valor: 10600.00, status: 'pendente', dias_pendente: 2, etapaAtual: 0 },
  { id: 'apv-0210', tipo_documento: 'Medição de Contrato', numero_documento: '210',  descricao: 'Medição de serviços executados no mês',                                   filial: 'Consorcio Transnordestina - Filial', solicitante: 'João Pereira', contrato_vinculado: 'Transnordestina', projeto: 'Obras TN',       centro_custo: 'Produção Própria', valor: 145200.00, status: 'pendente', dias_pendente: 3, etapaAtual: 1 },
  { id: 'apv-0118', tipo_documento: 'Pedido de Compra',    numero_documento: '118',  descricao: 'Aquisição de materiais de construção',                                    filial: 'Consorcio CE-6 - Filial',        solicitante: 'Carlos Souza', contrato_vinculado: 'CE-6',           projeto: 'Obras CE-6',         centro_custo: 'Produção Própria', valor: 32400.00, status: 'pendente', dias_pendente: 1, etapaAtual: 0 },
  { id: 'apv-0042', tipo_documento: 'Aditivo Contratual',  numero_documento: '42',   descricao: 'Aditivo de prazo e valor',                                                filial: 'Consorcio UNMTL - Filial',       solicitante: 'Marina Lopes', contrato_vinculado: 'UNMTL',          projeto: 'Obras UNMTL',        centro_custo: 'Produção Própria', valor: 86000.00, status: 'pendente', dias_pendente: 4, etapaAtual: 2 },
]

function buildMock(): ApprovoAlert[] {
  return MOCK_BASE.map(({ etapaAtual, ...b }) => {
    const etapas = montarEtapas(b.tipo_documento, etapaAtual, b.dias_pendente)
    const atual = etapas.find((e) => e.status === 'pendente') ?? null
    return {
      ...b,
      data_criacao: isoHaDias(b.dias_pendente),
      criticidade: calcularCriticidade(b.dias_pendente, b.valor),
      link_approvo: APPROVO_LINK,
      etapas,
      // próximo aprovador: o nome real virá da API; por ora exibimos o NÍVEL da alçada
      proximo_aprovador: atual ? { nome: '', etapa: atual.nome } : null,
      origem: 'mock' as const,
    }
  })
}

// ─── Funções públicas (assinatura pronta para API real) ──────────────────────

/**
 * Monta o corpo da requisição ao Approvo a partir das credenciais do usuário.
 * Assinatura do método (descoberta): ObterCardDocumentos(
 *   tipoAcesso, codUsuario, codPerfil, codUsuarioMega, filtro )
 */
function buildApprovoBody(creds: ApprovoCreds): string {
  return JSON.stringify({
    tipoAcesso:     creds.tipoAcesso,
    codUsuario:     creds.codUsuario,
    codPerfil:      creds.codPerfil,
    codUsuarioMega: creds.codUsuarioMega,
    filtro:         APPROVO_FILTRO_PADRAO,
  })
}

/**
 * Busca os documentos CRUS do endpoint do Approvo (sem transformação).
 * Útil para diagnóstico de quais campos a API realmente devolve.
 */
export async function getApprovoRawDocuments(creds: ApprovoCreds): Promise<any[]> {
  const body = buildApprovoBody(creds)

  const res = await fetch(APPROVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(process.env.APPROVO_COOKIE ? { Cookie: process.env.APPROVO_COOKIE } : {}),
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) throw new Error(`Approvo respondeu ${res.status}`)

  const raw = await res.json()
  if (raw?.Message && raw?.d === undefined) {
    throw new Error(`Approvo: ${String(raw.Message).slice(0, 200)}`)
  }
  return typeof raw?.d === 'string' ? JSON.parse(raw.d) : (Array.isArray(raw?.d) ? raw.d : [])
}

/**
 * Busca as aprovações REAIS no endpoint do Approvo (MegaERP) para um usuário.
 * Lança erro se a requisição falhar.
 */
export async function getApprovoRealAlerts(creds: ApprovoCreds): Promise<ApprovoAlert[]> {
  const documentos = await getApprovoRawDocuments(creds)

  return documentos.map((doc) => {
    const dias = parseDias(doc.dias_pendente)
    const valor = parseValor(doc.valor_documento)
    const tipo = mapTipoDocumento(doc.codigo_aplicacao)
    const filial = String(doc.nome_filial ?? '')
    const numero = String(doc.numero_documento ?? doc.doc_in_codigo ?? '')

    // Campos reais do card (ObterCardDocumentos). Muitos vêm vazios em mapas de
    // cotação (o card traz só o cabeçalho); preenchidos em outros tipos de doc.
    const descItem  = firstStr(doc, ['descricao_item'])
    const empreend  = firstStr(doc, ['nome_empreendimento'])
    const agente    = firstStr(doc, ['nome_agente'])
    const unidade   = firstStr(doc, ['unidade_medida'])
    const qtd       = doc.quantidade_item != null ? String(doc.quantidade_item) : ''
    const solicitante = firstStr(doc, ['nome_solicitante'])

    // Monta uma descrição útil a partir do que houver
    const partesDesc = [
      descItem,
      qtd && unidade ? `${qtd} ${unidade}` : '',
      agente ? `Fornecedor: ${agente}` : '',
    ].filter(Boolean)
    const descMontada = partesDesc.join(' · ')

    return {
      id: String(doc.doc_in_codigo ?? numero),
      tipo_documento: tipo,
      numero_documento: numero,
      descricao: descMontada || `${tipo}${numero ? ` (${numero})` : ''}`,
      filial,
      solicitante,
      contrato_vinculado: filial,
      projeto: empreend || undefined,
      centro_custo: '',
      valor,
      status: String(doc.status_documento ?? 'pendente'),
      data_criacao: parseDataIso(doc.data_documento, dias),
      dias_pendente: dias,
      criticidade: calcularCriticidade(dias, valor),
      // Por enquanto link base; quando o deep-link for validado, usar chave_encriptada
      link_approvo: APPROVO_CONSULTA_BASE,
      etapas: [],               // a cadeia de alçada não vem neste endpoint
      proximo_aprovador: null,
      chave_completa: doc.chave_completa ? String(doc.chave_completa) : undefined,
      chave_encriptada: doc.chave_encriptada ? String(doc.chave_encriptada) : undefined,
      origem: 'real' as const,
    }
  })
}

/**
 * Lista as aprovações pendentes DO USUÁRIO (creds).
 * - Sem creds (usuário sem Approvo configurado) → retorna [] (não mostra nada de ninguém).
 * - Com creds → busca a fila real do próprio usuário. Em caso de erro de rede, [].
 */
export async function getApprovoAlerts(creds: ApprovoCreds | null): Promise<ApprovoAlert[]> {
  if (!creds) return []
  try {
    const reais = await getApprovoRealAlerts(creds)
    return reais.sort((a, b) => b.dias_pendente - a.dias_pendente)
  } catch (err) {
    console.error('[Approvo] Falha ao buscar dados reais do usuário:', err instanceof Error ? err.message : err)
    return []
  }
}

// ─── Detalhe do documento (aprovadores + mapa de cotação) ────────────────────

export type ApprovoAprovador = {
  nome: string
  tipo: string          // 'P' = por alçada/prioridade | 'M' = obrigatório
  prioridade: number
  nivel: number
  substituto?: string
}

export type ApprovoCotacaoFornecedorItem = {
  nome: string
  quantidade: number
  unidade: string
  valor: number
  selecionada: boolean
}

export type ApprovoCotacaoItem = {
  descricao: string
  unidade: string
  melhorOferta: number
  ofertaSelecionada: number
  fornecedores: ApprovoCotacaoFornecedorItem[]
}

export type ApprovoFornecedorResumo = {
  nome: string
  documento?: string
  condicaoPagamento?: string
  somaUnitarios: number
  totalSelecionado: number
  total: number
  selecionados: number
}

export type ApprovoDetalhe = {
  aprovadores: ApprovoAprovador[]
  itens: ApprovoCotacaoItem[]
  fornecedores: ApprovoFornecedorResumo[]
}

/**
 * Busca o detalhe de um documento: próximos aprovadores (nomes) e, para mapas de
 * cotação (aplicação 11), os itens × fornecedores × preços.
 */
export async function getApprovoDetalhe(
  creds: ApprovoCreds,
  chaveCompleta: string,
  nomeUsuario: string,
): Promise<ApprovoDetalhe> {
  const k = parseChaveCompleta(chaveCompleta)
  const cotKeys = {
    OrgTab: k.orgTab, OrgPad: k.orgPad, OrgIn: k.orgIn, OrgTau: k.orgTau,
    SerTab: k.serTab, SerIn: k.serIn, CotIn: k.cotIn,
  }

  const [aprovRes, itensRes, fornRes] = await Promise.allSettled([
    callApprovo('GetProximosAprovadores', {
      codigoDocumento: k.docInCodigo,
      status: 'E',
      aplicacao: k.aplicacao,
      codigoUsuario: creds.codUsuario,
      nomeUsuario,
      chaveSolicitacao: '',
    }),
    k.aplicacao === 11 ? callApprovo('GetItensFornecedores', cotKeys) : Promise.resolve(null),
    k.aplicacao === 11 ? callApprovo('GetFornecedoresCotacao', cotKeys) : Promise.resolve(null),
  ])

  // Aprovadores
  let aprovadores: ApprovoAprovador[] = []
  if (aprovRes.status === 'fulfilled' && aprovRes.value?.approvers) {
    aprovadores = (aprovRes.value.approvers as any[]).map((a) => ({
      nome: String(a.nome_aprovador ?? ''),
      tipo: String(a.tipo_aprovador ?? ''),
      prioridade: Number(a.prioridade_aprov) || 0,
      nivel: Number(a.nivel_aprovacao) || 0,
      substituto: a.nome_substituto ? String(a.nome_substituto) : undefined,
    }))
  }

  // Itens do mapa de cotação
  let itens: ApprovoCotacaoItem[] = []
  let fornecedoresResumo: Record<string, ApprovoFornecedorResumo> = {}
  if (itensRes.status === 'fulfilled' && itensRes.value?.data) {
    const data = itensRes.value.data
    itens = (data.Itens ?? []).map((it: any) => ({
      descricao: String(it.Descricao ?? ''),
      unidade: String(it.Unidade ?? ''),
      melhorOferta: Number(it.ValorMelhorOferta) || 0,
      ofertaSelecionada: Number(it.ValorOfertaSelecionada) || 0,
      fornecedores: (it.FornecedoresItem ?? []).map((f: any) => ({
        nome: String(f.NomeFornecedor ?? ''),
        quantidade: Number(f.Quantidade) || 0,
        unidade: String(f.Unidade ?? ''),
        valor: Number(f.Valor) || 0,
        selecionada: Boolean(f.OfertaSelecionada),
      })),
    }))
    for (const f of (data.Fornecedores ?? [])) {
      fornecedoresResumo[String(f.NomeFornecedor)] = {
        nome: String(f.NomeFornecedor ?? ''),
        somaUnitarios: Number(f.SomaUnitarios) || 0,
        totalSelecionado: Number(f.SomaTotaisSelecionados) || 0,
        total: Number(f.SomaTotais) || 0,
        selecionados: Number(f.CountSelecionados) || 0,
      }
    }
  }

  // Enriquecer fornecedores com CNPJ/condição de pagamento
  if (fornRes.status === 'fulfilled' && Array.isArray(fornRes.value?.data)) {
    for (const f of fornRes.value.data) {
      const nome = String(f.DescricaoFornecedor ?? '')
      const r = fornecedoresResumo[nome] ?? {
        nome, somaUnitarios: 0, totalSelecionado: 0, total: 0, selecionados: 0,
      }
      r.documento = f.Documento ? String(f.Documento) : undefined
      r.condicaoPagamento = f.CondicaoPagamento ? String(f.CondicaoPagamento) : undefined
      fornecedoresResumo[nome] = r
    }
  }

  return {
    aprovadores,
    itens,
    fornecedores: Object.values(fornecedoresResumo),
  }
}

/** Resumo agregado das aprovações pendentes do usuário (para cards). */
export async function getApprovoSummary(creds: ApprovoCreds | null): Promise<ApprovoSummary> {
  const alerts = await getApprovoAlerts(creds)

  const quantidadePendente = alerts.length
  const valorTotalPendente = alerts.reduce((acc, a) => acc + a.valor, 0)
  const quantidadeCritica  = alerts.filter((a) => a.criticidade === 'critico').length

  const maisAntiga = alerts.reduce<ApprovoAlert | null>((max, a) =>
    !max || a.dias_pendente > max.dias_pendente ? a : max, null)

  return {
    quantidadePendente,
    valorTotalPendente,
    quantidadeCritica,
    aprovacaoMaisAntiga: maisAntiga
      ? { dias: maisAntiga.dias_pendente, descricao: maisAntiga.descricao, numero: maisAntiga.numero_documento }
      : null,
  }
}

/**
 * Aprovações pendentes vinculadas a um contrato.
 * Aceita uma ou mais referências (número/nome) e casa com contrato_vinculado.
 */
export async function getApprovoAlertsByContract(creds: ApprovoCreds | null, referencias: string | string[]): Promise<ApprovoAlert[]> {
  const refs = (Array.isArray(referencias) ? referencias : [referencias])
    .filter(Boolean)
    .map((r) => r.toLowerCase())

  if (refs.length === 0) return []

  const alerts = await getApprovoAlerts(creds)
  return alerts.filter((a) => {
    const vinc = a.contrato_vinculado.toLowerCase()
    return refs.some((r) => r.includes(vinc) || vinc.includes(r))
  })
}
