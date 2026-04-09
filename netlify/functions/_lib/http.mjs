export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  }
}

export function parseJsonBody(event) {
  try {
    return JSON.parse(event.body || '{}')
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
