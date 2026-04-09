export function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

export function getMethod(requestOrEvent) {
  return requestOrEvent?.method || requestOrEvent?.httpMethod || 'GET'
}

export async function parseJsonBody(requestOrEvent) {
  if (requestOrEvent && typeof requestOrEvent.json === 'function') {
    try {
      return await requestOrEvent.json()
    } catch {
      return null
    }
  }

  try {
    return JSON.parse(requestOrEvent?.body || '{}')
  } catch {
    return null
  }
}

export function clean(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

export function slugify(value = '') {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
