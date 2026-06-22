import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = new URL(req.url)
  const ano = searchParams.get('ano') ? parseInt(searchParams.get('ano')!) : 2026

  const taxas = await prisma.taxaFrequencia.findMany({
    where: { ano },
    orderBy: [{ mes: 'asc' }],
  })

  return apiSuccess(taxas)
}
