export class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

export function notFoundHandler(request, _response, next) {
  next(new HttpError(404, 'API_NOT_FOUND', `No API route for ${request.method}`))
}

export function errorHandler(error, _request, response, _next) {
  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
    })
  }

  if (error?.type === 'entity.too.large') {
    return response.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    })
  }

  if (error instanceof HttpError) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    })
  }

  console.error(`[api-error] ${error?.name || 'UnknownError'}`)
  return response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  })
}
