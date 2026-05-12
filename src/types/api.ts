export type ApiSuccess<T> = {
  data: T
}

export type ApiError = {
  error: string
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status })
}

export function apiError(
  error: string,
  status = 400,
  details?: unknown
): Response {
  return Response.json({ error, details }, { status })
}

export function apiPaginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): Response {
  return Response.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
