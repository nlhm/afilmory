import { DbManager } from './db'
import { requireGallerySession } from './gallery-access/request'

export const guardGalleryAccess = <RequestType extends Request, Args extends unknown[], Result>(
  fn: (request: RequestType, ...args: Args) => Result,
) => {
  return async (request: RequestType, ...rest: Args): Promise<Awaited<Result> | Response> => {
    const unauthorized = requireGallerySession(request)
    if (unauthorized) {
      return unauthorized
    }

    return (await fn(request, ...rest)) as Awaited<Result>
  }
}

export const guardDbEnabled = <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
  return async (...rest: Args): Promise<Awaited<Result> | Response> => {
    if (!DbManager.shared.isEnabled()) {
      return new Response('Database is not enabled, the site owner has not configured the database.', { status: 500 })
    }

    await DbManager.shared.connect()

    return (await fn(...rest)) as Awaited<Result>
  }
}
