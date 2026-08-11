import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('AUTH_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('AUTH_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ANON_KEY = Deno.env.get('AUTH_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('AUTH_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
const RESEND_API_KEY = Deno.env.get('AUTH_RESEND_API_KEY') || Deno.env.get('RESEND_API_KEY')
const AUTH_EMAIL_FROM = Deno.env.get('AUTH_EMAIL_FROM') || 'welcome@mallucupid.com'
const AUTH_CORS_ORIGIN = Deno.env.get('AUTH_CORS_ORIGIN') || 'https://www.mallucupid.com'
const ALLOWED_CORS_ORIGINS = AUTH_CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
const PUBLIC_APP_URL = (Deno.env.get('AUTH_PUBLIC_APP_URL') || ALLOWED_CORS_ORIGINS[0] || 'https://www.mallucupid.com').replace(/\/$/, '')
const LOGO_URL = 'https://res.cloudinary.com/dsamz0zji/image/upload/v1784680966/mallucupidlogo_a44gud.png'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY')
}

const generateOtp = () => {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
  return String(100000 + (n % 900000))
}

const bytesToB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const b64ToBytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0))

const sealSecret = async (plain: string) => {
  const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SERVICE_ROLE_KEY))
  const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)))
  return `${bytesToB64(iv)}.${bytesToB64(cipher)}`
}

const openSecret = async (sealed: string) => {
  const [ivB64, cipherB64] = sealed.split('.')
  if (!ivB64 || !cipherB64) return ''
  const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SERVICE_ROLE_KEY))
  const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['decrypt'])
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(ivB64) }, key, b64ToBytes(cipherB64))
  return new TextDecoder().decode(plain)
}

const resolveStoredPassword = async (payload: Record<string, unknown> | null | undefined) => {
  if (!payload) return ''
  if (typeof payload.password_sealed === 'string' && payload.password_sealed) {
    return openSecret(payload.password_sealed)
  }
  // Legacy rows may still hold plaintext until used/expired.
  return typeof payload.password === 'string' ? payload.password : ''
}

const MAX_OTP_ATTEMPTS = 8

const bumpOtpAttempts = async (id: string, current: number) => {
  await fetch(`${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ attempts: (current || 0) + 1 }),
  })
}

const defaultHeaders = {
  'Content-Type': 'application/json',
}

const buildCookie = (name: string, value: string, maxAge: number) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`

const clearCookie = (name: string) =>
  `${name}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_CORS_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_CORS_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  }
}

const jsonResponse = (
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
  cookies: string[] = [],
  origin: string | null = null,
) => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...getCorsHeaders(origin),
    ...extraHeaders,
  })

  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie)
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  })
}

const authHeaders = (useService = false) => ({
  'Content-Type': 'application/json',
  apikey: useService ? SERVICE_ROLE_KEY : ANON_KEY,
  Authorization: `Bearer ${useService ? SERVICE_ROLE_KEY : ANON_KEY}`,
})

const clientIp = (req: Request) =>
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  req.headers.get('cf-connecting-ip') ||
  'unknown'

/** Sliding-window rate limit stored in DB (edge-only table). */
const enforceRateLimit = async (key: string, maxHits: number, windowMs: number) => {
  const now = Date.now()
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/auth_rate_limits?key=eq.${encodeURIComponent(key)}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  const windowStart = row ? new Date(row.window_start).getTime() : 0
  if (!row || now - windowStart > windowMs) {
    await fetch(`${SUPABASE_URL}/rest/v1/auth_rate_limits?on_conflict=key`, {
      method: 'POST',
      headers: { ...authHeaders(true), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key, hit_count: 1, window_start: new Date(now).toISOString() }]),
    })
    return { ok: true as const }
  }
  if ((row.hit_count || 0) >= maxHits) {
    return { ok: false as const, error: 'Too many requests. Try again later.' }
  }
  await fetch(`${SUPABASE_URL}/rest/v1/auth_rate_limits?key=eq.${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ hit_count: (row.hit_count || 0) + 1 }),
  })
  return { ok: true as const }
}

const maskAccountNumber = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length <= 4) return digits
  return `••••${digits.slice(-4)}`
}

const publicPayoutAccount = (row: Record<string, unknown> | null) => {
  if (!row) return null
  const number = String(row.account_number || '')
  return {
    account_holder: row.account_holder || '',
    account_number_last4: number.slice(-4),
    account_number_masked: maskAccountNumber(number),
    ifsc: row.ifsc || '',
    upi_id: row.upi_id || '',
    updated_at: row.updated_at || null,
    has_account: Boolean(number),
  }
}

const serializeCookies = (cookieHeader: string): Record<string, string> =>
  Object.fromEntries(
    cookieHeader
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [name, ...rest] = item.split('=')
        return [name, rest.join('=')]
      }),
  )

const parseJson = async (req: Request) => {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

const sendVerificationEmail = async (email: string, token: string): Promise<{ ok: boolean; error?: string }> => {
  if (!RESEND_API_KEY) {
    console.error('sendVerificationEmail: RESEND_API_KEY is not configured')
    return { ok: false, error: 'Email service not configured' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: AUTH_EMAIL_FROM,
      to: [email],
      subject: 'Your MalluCupid verification code',
      html: `<p>Your verification code is <strong>${token}</strong>.</p><p>It expires in 20 minutes.</p>`,
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    console.error(`sendVerificationEmail: Resend API error ${res.status}: ${errorBody}`)
    let detail = `Resend HTTP ${res.status}`
    try {
      const parsed = JSON.parse(errorBody)
      detail = parsed?.message || parsed?.error || detail
    } catch {
      if (errorBody) detail = errorBody.slice(0, 200)
    }
    return { ok: false, error: `Failed to send verification email: ${detail}` }
  }

  return { ok: true }
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getAuthUserEmail = async (userId: string): Promise<string> => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: authHeaders(true),
  })
  if (!res.ok) {
    console.error('getAuthUserEmail failed:', await res.text().catch(() => ''))
    return ''
  }
  const body = await res.json().catch(() => ({}))
  return typeof body.email === 'string' ? body.email.trim() : ''
}

const getCreatorGreetingName = async (creatorId: string): Promise<string> => {
  const profile = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${creatorId}&select=full_name,username&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = profile.ok ? await profile.json().catch(() => []) : []
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  return (row?.full_name || row?.username || 'Creator').toString()
}

const getActorDisplayName = async (actorId: string): Promise<string> => {
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${actorId}&select=username,full_name&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const profiles = profileRes.ok ? await profileRes.json().catch(() => []) : []
  const profile = Array.isArray(profiles) && profiles.length ? profiles[0] : null
  if (profile?.username) return String(profile.username)
  if (profile?.full_name) return String(profile.full_name)

  const account = await getAccount(actorId)
  if (account?.name) return String(account.name)
  return 'A MalluCupid user'
}

const buildCreatorNotificationHtml = (opts: {
  creatorName: string
  headline: string
  message: string
  detail?: string
}) => {
  const creator = escapeHtml(opts.creatorName)
  const headline = escapeHtml(opts.headline)
  const message = escapeHtml(opts.message)
  const detail = opts.detail ? escapeHtml(opts.detail) : ''
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fff5f7;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #ffe4e6;">
            <tr>
              <td style="padding:28px 28px 12px;text-align:center;background:linear-gradient(180deg,#fff1f2 0%,#ffffff 100%);">
                <img src="${LOGO_URL}" alt="MalluCupid" width="64" height="64" style="display:block;margin:0 auto 16px;border-radius:16px;" />
                <div style="font-size:22px;font-weight:700;color:#f43f5e;letter-spacing:-0.02em;">MalluCupid</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;">
                <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Hi <strong>${creator}</strong>,</p>
                <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#18181b;">${headline}</p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">${message}</p>
                ${detail ? `<p style="margin:0;padding:14px 16px;background:#fff1f2;border-radius:14px;font-size:14px;line-height:1.5;color:#9f1239;">${detail}</p>` : ''}
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#a1a1aa;">Keep creating. Your audience is growing on MalluCupid.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

const sendResendEmail = async (opts: {
  to: string
  subject: string
  html: string
}): Promise<boolean> => {
  if (!RESEND_API_KEY) {
    console.error('sendResendEmail: RESEND_API_KEY is not configured')
    return false
  }
  if (!opts.to) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: AUTH_EMAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  })
  if (!res.ok) {
    console.error('sendResendEmail failed:', await res.text().catch(() => ''))
    return false
  }
  return true
}

/** Fire-and-forget creator emails. Never blocks the API response path. */
const notifyCreatorByEmail = async (opts: {
  creatorId: string
  actorId: string
  kind: 'follow' | 'purchase' | 'exclusive'
  amount?: number
  currency?: string
  postPublicId?: string
  roomName?: string
}) => {
  try {
    if (!opts.creatorId || !opts.actorId || opts.creatorId === opts.actorId) return
    const [to, creatorName, actorName] = await Promise.all([
      getAuthUserEmail(opts.creatorId),
      getCreatorGreetingName(opts.creatorId),
      getActorDisplayName(opts.actorId),
    ])
    if (!to) {
      console.error('notifyCreatorByEmail: creator signup email missing', opts.creatorId)
      return
    }

    if (opts.kind === 'follow') {
      await sendResendEmail({
        to,
        subject: `@${actorName} followed you on MalluCupid`,
        html: buildCreatorNotificationHtml({
          creatorName,
          headline: 'You have a new follower',
          message: `@${actorName} just followed your MalluCupid account.`,
          detail: 'Open your dashboard to welcome them and keep sharing exclusive content.',
        }),
      })
      return
    }

    const amountLabel = typeof opts.amount === 'number'
      ? `₹${Number(opts.amount).toFixed(2)}`
      : 'a paid amount'

    if (opts.kind === 'exclusive') {
      const roomLabel = opts.roomName ? `"${opts.roomName}"` : 'an exclusive room'
      await sendResendEmail({
        to,
        subject: `@${actorName} entered your exclusive room`,
        html: buildCreatorNotificationHtml({
          creatorName,
          headline: 'Exclusive room entry',
          message: `@${actorName} paid ${amountLabel}/month and entered ${roomLabel}.`,
          detail: 'Check your wallet for the entry fee credit.',
        }),
      })
      return
    }

    await sendResendEmail({
      to,
      subject: `@${actorName} unlocked your paid post`,
      html: buildCreatorNotificationHtml({
        creatorName,
        headline: 'You made a sale',
        message: `@${actorName} paid ${amountLabel} and unlocked one of your exclusive posts.`,
        detail: opts.postPublicId
          ? `Post ID: ${opts.postPublicId}`
          : 'Check your wallet and notifications for the latest unlock.',
      }),
    })
  } catch (error) {
    console.error('notifyCreatorByEmail error:', error)
  }
}

const authErrorMessage = (data: Record<string, unknown>, fallback: string) => {
  if (!data) return fallback
  if (typeof data.msg === 'string' && data.msg) return data.msg
  if (typeof data.error_description === 'string' && data.error_description) return data.error_description
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.error === 'string' && data.error) return data.error
  if (data.error && typeof data.error === 'object' && typeof (data.error as { message?: string }).message === 'string') {
    return (data.error as { message: string }).message
  }
  return fallback
}

const isAuthError = (data: Record<string, unknown>) =>
  Boolean(data?.error || data?.error_code || data?.msg) && !data?.access_token

const signIn = async (email: string, password: string) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  })
  return res.json()
}

const refreshSession = async (refreshToken: string) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  return res.json()
}

const fetchUser = async (accessToken: string) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      ...authHeaders(),
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return res.json()
}

type AccountRole = 'creator' | 'user' | 'admin'

const getAccount = async (userId: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${userId}&select=id,role,name,email&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

/** Fetch the creator profile (username) for a given user id, if present. */
const getProfileUsername = async (userId: string): Promise<string> => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    if (!res.ok) return ''
    const rows = await res.json().catch(() => [])
    return Array.isArray(rows) && rows.length && rows[0]?.username
      ? String(rows[0].username)
      : ''
  } catch {
    return ''
  }
}

const userWithRole = async (user: Record<string, unknown>) => {
  if (!user?.id) return user
  const account = await getAccount(user.id as string)
  // Creators have a profile row with a permanent username; fans do not.
  // We expose the canonical username (creators) or fall back to the
  // account display name (fans) so the frontend never needs to watermark
  // with the user's email.
  const username = account?.role === 'creator'
    ? await getProfileUsername(user.id as string)
    : ''
  const metadata = user.user_metadata && typeof user.user_metadata === 'object'
    ? user.user_metadata as Record<string, unknown>
    : {}
  return {
    ...user,
    user_metadata: {
      ...metadata,
      role: account?.role || metadata.role || '',
      name: account?.name || metadata.name || '',
      username: username || metadata.username || '',
    },
  }
}

const requireAdmin = async (req: Request) => {
  const user = await requireUser(req)
  if (!user) return null
  const account = await getAccount(user.id)
  return account?.role === 'admin' ? user : null
}

const requireRole = async (req: Request, role: AccountRole) => {
  const user = await requireUser(req)
  if (!user) return null
  const account = await getAccount(user.id)
  return account?.role === role ? user : null
}

const handleLogin = async (req: Request) => {
  const origin = req.headers.get('origin')
  const { email, password } = await parseJson(req)
  if (!email || !password) return jsonResponse({ error: 'Missing credentials' }, 400, {}, [], origin)

  const data = await signIn(email, password)
  if (isAuthError(data)) return jsonResponse({ error: authErrorMessage(data, 'Login failed') }, 401, {}, [], origin)
  if (!data.access_token || !data.refresh_token) return jsonResponse({ error: 'Login did not return tokens' }, 500, {}, [], origin)

  const account = await getAccount(data.user?.id)
  if (account?.role === 'admin') {
    return jsonResponse({ error: 'Use the admin login page' }, 403, {}, [
      clearCookie('sb-access-token'),
      clearCookie('sb-refresh-token'),
    ], origin)
  }
  if (account?.role !== 'creator') {
    return jsonResponse({ error: "You don't have a creator account" }, 403, {}, [
      clearCookie('sb-access-token'),
      clearCookie('sb-refresh-token'),
    ], origin)
  }

  const cookies = [
    buildCookie('sb-access-token', data.access_token, data.expires_in || 3600),
    buildCookie('sb-refresh-token', data.refresh_token, 60 * 60 * 24 * 30),
  ]

  return jsonResponse({ user: await userWithRole(data.user) }, 200, {}, cookies, origin)
}

const handleUserLogin = async (req: Request) => {
  const origin = req.headers.get('origin')
  const { email, password } = await parseJson(req)
  if (!email || !password) return jsonResponse({ error: 'Missing credentials' }, 400, {}, [], origin)

  const data = await signIn(String(email).trim(), String(password))
  if (isAuthError(data)) return jsonResponse({ error: authErrorMessage(data, 'Login failed') }, 401, {}, [], origin)
  if (!data.access_token || !data.refresh_token) return jsonResponse({ error: 'Login did not return tokens' }, 500, {}, [], origin)

  const account = await getAccount(data.user?.id)
  if (account?.role !== 'user') {
    return jsonResponse({ error: "You don't have a user account" }, 403, {}, [], origin)
  }

  const cookies = [
    buildCookie('sb-access-token', data.access_token, data.expires_in || 3600),
    buildCookie('sb-refresh-token', data.refresh_token, 60 * 60 * 24 * 30),
  ]
  return jsonResponse({ user: await userWithRole(data.user) }, 200, {}, cookies, origin)
}

const handleLogout = async (req: Request) => {
  const origin = req.headers.get('origin')
  const cookies = serializeCookies(req.headers.get('cookie') || '')
  const accessToken = cookies['sb-access-token'] ? decodeURIComponent(cookies['sb-access-token']) : ''

  if (accessToken) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        Authorization: `Bearer ${accessToken}`,
      },
    })
  }

  return jsonResponse({ success: true }, 200, {}, [clearCookie('sb-access-token'), clearCookie('sb-refresh-token')], origin)
}

const handleSession = async (req: Request) => {
  const origin = req.headers.get('origin')
  const cookies = serializeCookies(req.headers.get('cookie') || '')
  const accessToken = cookies['sb-access-token'] ? decodeURIComponent(cookies['sb-access-token']) : ''
  const refreshToken = cookies['sb-refresh-token'] ? decodeURIComponent(cookies['sb-refresh-token']) : ''

  if (!accessToken && !refreshToken) return jsonResponse({ user: null }, 200, {}, [], origin)

  if (accessToken) {
    const user = await fetchUser(accessToken)
    if (user?.id) return jsonResponse({ user: await userWithRole(user) }, 200, {}, [], origin)
  }

  if (!refreshToken) return jsonResponse({ user: null }, 200, {}, [], origin)

  const refreshData = await refreshSession(refreshToken)
  if (refreshData.error) return jsonResponse({ user: null }, 200, {}, [], origin)
  if (!refreshData.access_token) return jsonResponse({ user: null }, 200, {}, [], origin)

  const cookiesToSet = [
    buildCookie('sb-access-token', refreshData.access_token, refreshData.expires_in || 3600),
    buildCookie('sb-refresh-token', refreshData.refresh_token || refreshToken, 60 * 60 * 24 * 30),
  ]

  const user = await fetchUser(refreshData.access_token)
  return jsonResponse({ user: user?.id ? await userWithRole(user) : null }, 200, {}, cookiesToSet, origin)
}

// Username rules: 6-25 chars; letters, numbers, underscore, dot, hyphen; no spaces.
const USERNAME_REGEX = /^[A-Za-z0-9._-]{6,25}$/
const USERNAME_TAKEN_ERROR = 'Username already taken. Choose a different one.'

const validateUsernameFormat = (username: string): string | null => {
  if (!username) return 'Username is required'
  if (/\s/.test(username)) return 'Username cannot contain spaces'
  if (username.length < 6) return 'Username must be at least 6 characters'
  if (username.length > 25) return 'Username must be 25 characters or fewer'
  if (!USERNAME_REGEX.test(username)) return 'Username can only contain letters, numbers, and _ . -'
  return null
}

// Escape LIKE wildcards so ilike behaves as case-insensitive equality
const escapeLike = (value: string) => value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')

/** Case-insensitive uniqueness check against profiles AND pending (unverified) signups. */
const isUsernameTaken = async (
  username: string,
  opts: { excludeUserId?: string; includePending?: boolean; excludeEmail?: string } = {},
): Promise<boolean | null> => {
  const { excludeUserId = '', includePending = true, excludeEmail = '' } = opts
  const pattern = encodeURIComponent(escapeLike(username))
  const exclude = excludeUserId ? `&id=neq.${excludeUserId}` : ''
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?username=ilike.${pattern}${exclude}&select=id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!profileRes.ok) return null
  const profiles = await profileRes.json().catch(() => null)
  if (!Array.isArray(profiles)) return null
  if (profiles.length > 0) return true

  if (!includePending) return false
  const emailFilter = excludeEmail ? `&email=neq.${encodeURIComponent(excludeEmail)}` : ''
  const pendingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?purpose=eq.signup&used=eq.false&expires_at=gt.${encodeURIComponent(new Date().toISOString())}${emailFilter}&payload->>username=ilike.${pattern}&select=id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!pendingRes.ok) return false
  const pending = await pendingRes.json().catch(() => [])
  return Array.isArray(pending) && pending.length > 0
}

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''
const validEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email)
const validPassword = (password: string) => password.length >= 8 && password.length <= 128
const validPublicSlug = (slug: string) => /^.{1,60}\d{5}$/.test(slug)

const handleUsernameCheck = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const username = (url.searchParams.get('u') || '').trim().toLowerCase()

  const formatError = validateUsernameFormat(username)
  if (formatError) {
    return jsonResponse({ available: false, reason: 'invalid', error: formatError }, 200, {}, [], origin)
  }

  const taken = await isUsernameTaken(username)
  if (taken === null) return jsonResponse({ error: 'Failed to check username' }, 500, {}, [], origin)
  if (taken) {
    return jsonResponse({ available: false, reason: 'taken', error: USERNAME_TAKEN_ERROR }, 200, {}, [], origin)
  }
  return jsonResponse({ available: true }, 200, {}, [], origin)
}

const handleSignup = async (req: Request) => {
  const origin = req.headers.get('origin')
  const body = await parseJson(req)
  const email = normalizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  if (!validEmail(email) || !password || !username) {
    return jsonResponse({ error: 'Valid email, username, and password are required' }, 400, {}, [], origin)
  }
  const limited = await enforceRateLimit(`otp:ip:${clientIp(req)}`, 40, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)
  const emailLimited = await enforceRateLimit(`otp:email:${email}`, 8, 15 * 60 * 1000)
  if (!emailLimited.ok) return jsonResponse({ error: emailLimited.error }, 429, {}, [], origin)
  if (!validPassword(password)) return jsonResponse({ error: 'Password must be 8-128 characters' }, 400, {}, [], origin)

  const formatError = validateUsernameFormat(username)
  if (formatError) return jsonResponse({ error: formatError }, 400, {}, [], origin)

  // Re-signup with the same email keeps the same username reserved for that email
  const taken = await isUsernameTaken(username, { excludeEmail: email })
  if (taken === null) return jsonResponse({ error: 'Failed to validate username' }, 500, {}, [], origin)
  if (taken) return jsonResponse({ error: USERNAME_TAKEN_ERROR }, 409, {}, [], origin)

  // Invalidate any prior unused signup OTPs for this email
  await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&purpose=eq.signup&used=eq.false`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=minimal' },
      body: JSON.stringify({ used: true }),
    },
  )

  const token = generateOtp()
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()
  const passwordSealed = await sealSecret(password)

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/email_verifications`, {
    method: 'POST',
    headers: {
      ...authHeaders(true),
      Prefer: 'return=representation',
    },
    body: JSON.stringify([{
      email,
      token,
      purpose: 'signup',
      payload: { username, password_sealed: passwordSealed },
      expires_at: expiresAt,
    }]),
  })

  if (!insertRes.ok) return jsonResponse({ error: 'Failed to store verification' }, 500, {}, [], origin)

  const sendResult = await sendVerificationEmail(email, token)
  if (!sendResult.ok) {
    await fetch(`${SUPABASE_URL}/rest/v1/email_verifications?token=eq.${encodeURIComponent(token)}&email=eq.${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
    })
    return jsonResponse({ error: sendResult.error || 'Failed to send verification email' }, 502, {}, [], origin)
  }

  return jsonResponse({ status: 'verification_sent' }, 200, {}, [], origin)
}

const handleResend = async (req: Request) => {
  const origin = req.headers.get('origin')
  const { email: rawEmail } = await parseJson(req)
  const email = normalizeEmail(rawEmail)
  if (!validEmail(email)) return jsonResponse({ error: 'Missing email' }, 400, {}, [], origin)
  const limited = await enforceRateLimit(`otp:email:${email}`, 8, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)

  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&purpose=eq.signup&used=eq.false&select=*&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )

  if (!lookupRes.ok) return jsonResponse({ error: 'Lookup failed' }, 500, {}, [], origin)

  const rows = await lookupRes.json()
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!row) return jsonResponse({ error: 'No pending verification for this email' }, 404, {}, [], origin)
  if ((row.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    return jsonResponse({ error: 'Too many attempts. Start signup again.' }, 429, {}, [], origin)
  }

  const token = generateOtp()
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()

  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(true),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ token, expires_at: expiresAt, attempts: (row.attempts || 0) + 1 }),
  })

  if (!updateRes.ok) return jsonResponse({ error: 'Failed to refresh verification' }, 500, {}, [], origin)

  const sendResult = await sendVerificationEmail(email, token)
  if (!sendResult.ok) return jsonResponse({ error: sendResult.error || 'Failed to send verification email' }, 502, {}, [], origin)

  return jsonResponse({ status: 'verification_sent' }, 200, {}, [], origin)
}

const handleVerify = async (req: Request) => {
  const origin = req.headers.get('origin')
  const body = await parseJson(req)
  const email = normalizeEmail(body.email)
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!validEmail(email) || !/^\d{6}$/.test(token)) {
    return jsonResponse({ error: 'Enter a valid email and 6-digit code' }, 400, {}, [], origin)
  }
  const limited = await enforceRateLimit(`verify:email:${email}`, 20, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)

  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&token=eq.${encodeURIComponent(token)}&purpose=eq.signup&used=eq.false&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )

  if (!lookupRes.ok) return jsonResponse({ error: 'Lookup failed' }, 500, {}, [], origin)

  const rows = await lookupRes.json()
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!row) {
    const pendingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&purpose=eq.signup&used=eq.false&select=id,attempts&order=created_at.desc&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const pending = pendingRes.ok ? await pendingRes.json().catch(() => []) : []
    if (Array.isArray(pending) && pending[0]?.id) await bumpOtpAttempts(pending[0].id, pending[0].attempts || 0)
    return jsonResponse({ error: 'Invalid or expired token' }, 400, {}, [], origin)
  }
  if ((row.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    return jsonResponse({ error: 'Too many attempts. Start signup again.' }, 429, {}, [], origin)
  }
  if (new Date(row.expires_at) < new Date()) return jsonResponse({ error: 'Expired token' }, 400, {}, [], origin)

  const username = row.payload?.username
  const password = await resolveStoredPassword(row.payload)

  if (!username || !password) return jsonResponse({ error: 'Verification payload invalid' }, 500, {}, [], origin)

  // Final backend check before account creation: the username may have been
  // claimed while this signup was waiting for OTP verification.
  const formatError = validateUsernameFormat(username)
  if (formatError) return jsonResponse({ error: formatError }, 400, {}, [], origin)
  const takenNow = await isUsernameTaken(username, { includePending: false })
  if (takenNow === null) return jsonResponse({ error: 'Failed to validate username' }, 500, {}, [], origin)
  if (takenNow) return jsonResponse({ error: USERNAME_TAKEN_ERROR }, 409, {}, [], origin)

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      ...authHeaders(true),
    },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username, role: 'creator' } }),
  })

  if (!userRes.ok) {
    const errorBody = await userRes.json().catch(() => ({}))
    return jsonResponse({ error: errorBody.message || 'Failed to create user' }, 500, {}, [], origin)
  }

  const created = await userRes.json()
  const userId = created.id || created.user?.id
  if (!userId) return jsonResponse({ error: 'User created but id missing' }, 500, {}, [], origin)

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      ...authHeaders(true),
      Prefer: 'return=representation',
    },
    body: JSON.stringify([{ id: userId, username }]),
  })

  if (!profileRes.ok) {
    const profileErr = await profileRes.text().catch(() => '')
    console.error('Failed to create profile:', profileErr)
    // DB-level unique index is the last line of defense against duplicate usernames.
    // Roll back the auth user so the email is not left orphaned.
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
    }).catch(() => {})
    if (profileErr.includes('23505') || profileErr.toLowerCase().includes('duplicate')) {
      return jsonResponse({ error: USERNAME_TAKEN_ERROR }, 409, {}, [], origin)
    }
    return jsonResponse({ error: 'User created but profile failed' }, 500, {}, [], origin)
  }

  await fetch(`${SUPABASE_URL}/rest/v1/user_accounts`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{
      id: userId,
      role: 'creator',
      email,
      name: '',
      updated_at: new Date().toISOString(),
    }]),
  })

  await fetch(`${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(true),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ used: true, payload: { username } }),
  })

  const signInData = await signIn(email, password)
  if (isAuthError(signInData) || !signInData.access_token) {
    return jsonResponse({ status: 'user_created', user: { id: userId, email } }, 200, {}, [], origin)
  }

  const cookies = [
    buildCookie('sb-access-token', signInData.access_token, signInData.expires_in || 3600),
    buildCookie('sb-refresh-token', signInData.refresh_token, 60 * 60 * 24 * 30),
  ]

  return jsonResponse({ status: 'user_created', user: await userWithRole(signInData.user) }, 200, {}, cookies, origin)
}

const issueOtp = async (
  email: string,
  purpose: 'user_signup' | 'user_reset' | 'creator_reset',
  payload: Record<string, unknown>,
) => {
  await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&purpose=eq.${purpose}&used=eq.false`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=minimal' },
      body: JSON.stringify({ used: true }),
    },
  )
  const safePayload = { ...payload }
  if (typeof safePayload.password === 'string') {
    safePayload.password_sealed = await sealSecret(String(safePayload.password))
    delete safePayload.password
  }
  const token = generateOtp()
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()
  const insert = await fetch(`${SUPABASE_URL}/rest/v1/email_verifications`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify([{ email, token, purpose, payload: safePayload, expires_at: expiresAt }]),
  })
  if (!insert.ok) return { ok: false, error: 'Failed to store verification' }
  const sent = await sendVerificationEmail(email, token)
  if (!sent.ok) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&purpose=eq.${purpose}&token=eq.${token}`,
      { method: 'DELETE', headers: { ...authHeaders(true) } },
    )
    return sent
  }
  return { ok: true }
}

const handleUserSignup = async (req: Request) => {
  const origin = req.headers.get('origin')
  const body = await parseJson(req)
  const email = normalizeEmail(body.email)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const redirectSlug = typeof body.redirect_slug === 'string' && validPublicSlug(body.redirect_slug)
    ? body.redirect_slug.toLowerCase()
    : ''

  if (!validEmail(email)) return jsonResponse({ error: 'Enter a valid email address' }, 400, {}, [], origin)
  if (name.length < 2 || name.length > 80) return jsonResponse({ error: 'Name must be 2-80 characters' }, 400, {}, [], origin)
  if (!validPassword(password)) return jsonResponse({ error: 'Password must be 8-128 characters' }, 400, {}, [], origin)
  const limited = await enforceRateLimit(`otp:email:${email}`, 8, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)

  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?email=ilike.${encodeURIComponent(email)}&select=id,role&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = existing.ok ? await existing.json().catch(() => []) : []
  if (Array.isArray(rows) && rows.length) {
    return jsonResponse({ error: 'An account already exists for this email' }, 409, {}, [], origin)
  }

  const issued = await issueOtp(email, 'user_signup', { name, password, redirect_slug: redirectSlug })
  if (!issued.ok) return jsonResponse({ error: issued.error || 'Failed to send verification code' }, 502, {}, [], origin)
  return jsonResponse({ status: 'verification_sent' }, 200, {}, [], origin)
}

const handleUserVerify = async (req: Request) => {
  const origin = req.headers.get('origin')
  const body = await parseJson(req)
  const email = normalizeEmail(body.email)
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!validEmail(email) || !/^\d{6}$/.test(token)) {
    return jsonResponse({ error: 'Enter a valid email and 6-digit code' }, 400, {}, [], origin)
  }
  const limited = await enforceRateLimit(`verify:email:${email}`, 20, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)
  const ipLimited = await enforceRateLimit(`verify:ip:${clientIp(req)}`, 40, 15 * 60 * 1000)
  if (!ipLimited.ok) return jsonResponse({ error: ipLimited.error }, 429, {}, [], origin)

  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&token=eq.${token}&purpose=eq.user_signup&used=eq.false&select=*&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = lookup.ok ? await lookup.json().catch(() => []) : []
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!row || new Date(row.expires_at) < new Date()) {
    const pendingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&purpose=eq.user_signup&used=eq.false&select=id,attempts&order=created_at.desc&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const pending = pendingRes.ok ? await pendingRes.json().catch(() => []) : []
    if (Array.isArray(pending) && pending[0]?.id) await bumpOtpAttempts(pending[0].id, pending[0].attempts || 0)
    return jsonResponse({ error: 'Invalid or expired verification code' }, 400, {}, [], origin)
  }
  if ((row.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    return jsonResponse({ error: 'Too many attempts. Start signup again.' }, 429, {}, [], origin)
  }

  const name = typeof row.payload?.name === 'string' ? row.payload.name.trim() : ''
  const password = await resolveStoredPassword(row.payload)
  if (!name || !validPassword(password)) return jsonResponse({ error: 'Verification payload invalid' }, 500, {}, [], origin)

  const createdRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'user' },
    }),
  })
  if (!createdRes.ok) {
    const errorBody = await createdRes.json().catch(() => ({}))
    return jsonResponse({ error: authErrorMessage(errorBody, 'Failed to create user') }, 409, {}, [], origin)
  }
  const created = await createdRes.json()
  const userId = created.id || created.user?.id
  if (!userId) return jsonResponse({ error: 'User id missing' }, 500, {}, [], origin)

  const accountRes = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: userId, role: 'user', name, email }]),
  })
  if (!accountRes.ok) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
    })
    return jsonResponse({ error: 'Failed to create user profile' }, 500, {}, [], origin)
  }

  await fetch(`${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ used: true }),
  })

  const signedIn = await signIn(email, password)
  if (isAuthError(signedIn) || !signedIn.access_token || !signedIn.refresh_token) {
    return jsonResponse({ error: 'Account created but automatic login failed' }, 500, {}, [], origin)
  }
  const cookies = [
    buildCookie('sb-access-token', signedIn.access_token, signedIn.expires_in || 3600),
    buildCookie('sb-refresh-token', signedIn.refresh_token, 60 * 60 * 24 * 30),
  ]
  return jsonResponse({
    status: 'user_created',
    user: await userWithRole(signedIn.user),
    redirect_slug: row.payload?.redirect_slug || '',
  }, 200, {}, cookies, origin)
}

const handleUserResend = async (req: Request) => {
  const origin = req.headers.get('origin')
  const email = normalizeEmail((await parseJson(req)).email)
  if (!validEmail(email)) return jsonResponse({ error: 'Enter a valid email address' }, 400, {}, [], origin)
  const limited = await enforceRateLimit(`otp:email:${email}`, 8, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)
  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&purpose=eq.user_signup&used=eq.false&select=payload&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = lookup.ok ? await lookup.json().catch(() => []) : []
  if (!Array.isArray(rows) || !rows.length) return jsonResponse({ error: 'No pending signup found' }, 404, {}, [], origin)
  const issued = await issueOtp(email, 'user_signup', rows[0].payload || {})
  if (!issued.ok) return jsonResponse({ error: issued.error || 'Failed to resend code' }, 502, {}, [], origin)
  return jsonResponse({ status: 'verification_sent' }, 200, {}, [], origin)
}

const handleUserForgot = async (req: Request) => {
  const origin = req.headers.get('origin')
  const body = await parseJson(req)
  const email = normalizeEmail(body.email)
  const redirectSlug = typeof body.redirect_slug === 'string' && validPublicSlug(body.redirect_slug)
    ? body.redirect_slug.toLowerCase()
    : ''
  if (!validEmail(email)) return jsonResponse({ error: 'Enter a valid email address' }, 400, {}, [], origin)
  const limited = await enforceRateLimit(`otp:email:${email}`, 8, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)

  const accountRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?email=ilike.${encodeURIComponent(email)}&role=eq.user&select=id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const accounts = accountRes.ok ? await accountRes.json().catch(() => []) : []
  if (!Array.isArray(accounts) || !accounts.length) {
    return jsonResponse({ error: "You don't have a user account" }, 404, {}, [], origin)
  }
  const issued = await issueOtp(email, 'user_reset', {
    user_id: accounts[0].id,
    redirect_slug: redirectSlug,
  })
  if (!issued.ok) return jsonResponse({ error: issued.error || 'Failed to send reset code' }, 502, {}, [], origin)
  return jsonResponse({ status: 'verification_sent' }, 200, {}, [], origin)
}

const handleUserReset = async (req: Request) => {
  const origin = req.headers.get('origin')
  const body = await parseJson(req)
  const email = normalizeEmail(body.email)
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!validEmail(email) || !/^\d{6}$/.test(token) || !validPassword(password)) {
    return jsonResponse({ error: 'Valid email, 6-digit code, and 8+ character password are required' }, 400, {}, [], origin)
  }
  const limited = await enforceRateLimit(`verify:email:${email}`, 20, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)
  const ipLimited = await enforceRateLimit(`verify:ip:${clientIp(req)}`, 40, 15 * 60 * 1000)
  if (!ipLimited.ok) return jsonResponse({ error: ipLimited.error }, 429, {}, [], origin)

  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&token=eq.${token}&purpose=eq.user_reset&used=eq.false&select=*&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = lookup.ok ? await lookup.json().catch(() => []) : []
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!row || new Date(row.expires_at) < new Date()) {
    const pendingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&purpose=eq.user_reset&used=eq.false&select=id,attempts&order=created_at.desc&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const pending = pendingRes.ok ? await pendingRes.json().catch(() => []) : []
    if (Array.isArray(pending) && pending[0]?.id) await bumpOtpAttempts(pending[0].id, pending[0].attempts || 0)
    return jsonResponse({ error: 'Invalid or expired verification code' }, 400, {}, [], origin)
  }
  if ((row.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    return jsonResponse({ error: 'Too many attempts. Request a new reset code.' }, 429, {}, [], origin)
  }
  const userId = row.payload?.user_id
  const account = userId ? await getAccount(userId) : null
  if (!userId || account?.role !== 'user') return jsonResponse({ error: 'User account not found' }, 404, {}, [], origin)

  const update = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ password }),
  })
  if (!update.ok) return jsonResponse({ error: 'Failed to update password' }, 500, {}, [], origin)
  await fetch(`${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ used: true }),
  })

  const signedIn = await signIn(email, password)
  if (isAuthError(signedIn) || !signedIn.access_token || !signedIn.refresh_token) {
    return jsonResponse({ error: 'Password updated but automatic login failed' }, 500, {}, [], origin)
  }
  const cookies = [
    buildCookie('sb-access-token', signedIn.access_token, signedIn.expires_in || 3600),
    buildCookie('sb-refresh-token', signedIn.refresh_token, 60 * 60 * 24 * 30),
  ]
  return jsonResponse({
    status: 'password_updated',
    user: await userWithRole(signedIn.user),
    redirect_slug: row.payload?.redirect_slug || '',
  }, 200, {}, cookies, origin)
}

const AVATAR_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const uploadAvatar = async (
  userId: string,
  base64: string,
  contentType: string,
): Promise<{ ok: boolean; url?: string; error?: string }> => {
  const ext = AVATAR_EXT[contentType]
  if (!ext) return { ok: false, error: 'Unsupported image type' }

  const cleaned = base64.includes(',') ? base64.split(',').pop() as string : base64
  let bytes: Uint8Array
  try {
    const binary = atob(cleaned)
    bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  } catch {
    return { ok: false, error: 'Invalid image data' }
  }

  if (bytes.byteLength > 5 * 1024 * 1024) return { ok: false, error: 'Image exceeds 5MB limit' }

  const path = `${userId}/avatar.${ext}`
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'Cache-Control': '3600',
    },
    body: bytes,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text().catch(() => '')
    console.error('Avatar upload failed:', err)
    return { ok: false, error: 'Failed to upload avatar' }
  }

  const url = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?v=${Date.now()}`
  return { ok: true, url }
}

// Per-request Set-Cookie values produced when requireUser silently refreshes
// an expired access token. Attached to the final Response in the serve wrapper.
const authCookiesByRequest = new WeakMap<Request, string[]>()

const rememberAuthCookies = (req: Request, cookies: string[]) => {
  if (!cookies.length) return
  authCookiesByRequest.set(req, [...(authCookiesByRequest.get(req) || []), ...cookies])
}

const attachAuthCookies = (req: Request, response: Response) => {
  const cookies = authCookiesByRequest.get(req)
  if (!cookies?.length) return response
  authCookiesByRequest.delete(req)
  const headers = new Headers(response.headers)
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

const requireUser = async (req: Request) => {
  const cookies = serializeCookies(req.headers.get('cookie') || '')
  const accessToken = cookies['sb-access-token'] ? decodeURIComponent(cookies['sb-access-token']) : ''
  const refreshToken = cookies['sb-refresh-token'] ? decodeURIComponent(cookies['sb-refresh-token']) : ''

  if (accessToken) {
    const user = await fetchUser(accessToken)
    if (user?.id) return user
  }

  if (!refreshToken) return null
  const refreshData = await refreshSession(refreshToken)
  if (refreshData.error || !refreshData.access_token) return null

  rememberAuthCookies(req, [
    buildCookie('sb-access-token', refreshData.access_token, refreshData.expires_in || 3600),
    buildCookie('sb-refresh-token', refreshData.refresh_token || refreshToken, 60 * 60 * 24 * 30),
  ])

  const user = await fetchUser(refreshData.access_token)
  return user?.id ? user : null
}

const POST_MEDIA_BUCKET = 'post-media'
const POST_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_IMAGE_SIZE = 50 * 1024 * 1024
const MAX_VIDEO_SIZE = 500 * 1024 * 1024
const MAX_IMAGES_PER_POST = 15
const MEDIA_TTL_SECONDS = 90
const VIEW_ONCE_TTL_SECONDS = 20
const AUTH_FN_BASE = `${SUPABASE_URL}/functions/v1/auth`

const securePostMediaUrl = (publicId: string, index: number) =>
  `${AUTH_FN_BASE}/secure-media?post=${encodeURIComponent(publicId)}&i=${index}`

const secureChatMediaUrl = (messageId: string) =>
  `${AUTH_FN_BASE}/secure-media?message=${encodeURIComponent(messageId)}`

const generatePostPublicId = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const random = new Uint8Array(12)
  crypto.getRandomValues(random)
  return Array.from(random, (byte) => alphabet[byte % alphabet.length]).join('')
}

const VERIFICATION_DOCS_BUCKET = 'verification-docs'
const VERIFICATION_ID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_VERIFICATION_ID_SIZE = 10 * 1024 * 1024
/** After suspension, this many resubmits auto-verify; the next requires admin approval. */
const MAX_AUTO_REVERIFIES = 3

const creatorHasVerifiedBadge = async (userId: string): Promise<boolean> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/creator_has_verified_badge`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ p_user_id: userId }),
  })
  if (!res.ok) {
    const p = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_verified,verification_status&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const rows = p.ok ? await p.json().catch(() => []) : []
    const row = Array.isArray(rows) && rows.length ? rows[0] : null
    return Boolean(row?.is_verified === true && row?.verification_status === 'verified')
  }
  const value = await res.json().catch(() => false)
  return value === true
}

const verificationRequiredResponse = (origin: string | null) =>
  jsonResponse(
    {
      error: 'Identity verification required before posting or creating Exclusive Rooms',
      code: 'verification_required',
    },
    403,
    {},
    [],
    origin,
  )

const contentLockedResponse = (origin: string | null) =>
  jsonResponse(
    {
      error: 'This creator’s content is locked while their verification badge is inactive',
      code: 'content_locked',
    },
    403,
    {},
    [],
    origin,
  )

const assertDobAtLeast18 = async (dobIso: string): Promise<boolean> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobIso)) return false
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_at_least_18`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ p_dob: dobIso }),
  })
  if (res.ok) {
    const value = await res.json().catch(() => false)
    return value === true
  }
  // Fallback if RPC unavailable
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobIso)
  if (!m) return false
  const dob = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(dob.getTime())) return false
  const now = new Date()
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()))
  return dob.getTime() <= cutoff.getTime()
}

const mapVerificationStatus = (row: Record<string, unknown> | null, profile?: Record<string, unknown> | null) => {
  const rowStatus = String(row?.status || '')
  const profileStatus = String(profile?.verification_status || 'unverified')
  const status = (['pending', 'verified', 'suspended', 'rejected'].includes(rowStatus)
    ? rowStatus
    : ['pending', 'verified', 'suspended', 'rejected'].includes(profileStatus)
      ? profileStatus
      : 'unverified') as string
  const badgeActive = profile?.is_verified === true && profileStatus === 'verified'
  const autoCount = Number(row?.auto_reverify_count || 0) || 0
  return {
    status,
    badge_active: badgeActive,
    public_id: (row?.public_id as string) || (profile?.verification_public_id as string) || null,
    legal_full_name: (row?.legal_full_name as string) || null,
    date_of_birth: (row?.date_of_birth as string) || null,
    submitted_at: (row?.submitted_at as string) || null,
    reviewed_at: (row?.reviewed_at as string) || null,
    admin_note: (row?.admin_note as string) || null,
    auto_reverify_count: autoCount,
    auto_reverifies_remaining: Math.max(0, MAX_AUTO_REVERIFIES - autoCount),
    needs_admin_approval: status === 'pending',
    content_locked: !badgeActive && (status === 'suspended' || status === 'pending' || status === 'rejected'),
  }
}

const signVerificationPaths = async (paths: string[], expiresIn = 300): Promise<Record<string, string>> => {
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return {}
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${VERIFICATION_DOCS_BUCKET}`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ paths: unique, expiresIn }),
  })
  if (!res.ok) return {}
  const body = await res.json().catch(() => [])
  const out: Record<string, string> = {}
  for (const item of Array.isArray(body) ? body : []) {
    if (item?.path && item?.signedURL) {
      out[item.path] = `${SUPABASE_URL}/storage/v1${item.signedURL}`
    }
  }
  return out
}

const mediaExtension = (contentType: string) => {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  const subtype = contentType.split('/')[1] || 'bin'
  return subtype.split(';')[0].replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
}

const signMediaPaths = async (paths: string[], expiresIn = MEDIA_TTL_SECONDS): Promise<Record<string, string>> => {
  if (!paths.length) return {}
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${POST_MEDIA_BUCKET}`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ expiresIn, paths }),
  })
  if (!res.ok) {
    console.error('Failed to sign media paths:', await res.text().catch(() => ''))
    return {}
  }
  const rows = await res.json().catch(() => [])
  const map: Record<string, string> = {}
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.signedURL && row?.path) map[row.path] = `${SUPABASE_URL}/storage/v1${row.signedURL}`
  }
  return map
}

const decoratePosts = async (posts: Array<Record<string, unknown>>) => {
  // Issue short-lived signed storage URLs only after the calling handler has
  // already authenticated the user. Avoids cross-origin cookie auth on <img>/<video>.
  const allPaths: string[] = []
  for (const post of posts) {
    const paths = Array.isArray(post.media_paths) ? post.media_paths as string[] : []
    for (const path of paths) if (typeof path === 'string' && path) allPaths.push(path)
  }
  const signed = await signMediaPaths(allPaths)
  return posts.map((post) => {
    const paths = Array.isArray(post.media_paths) ? post.media_paths as string[] : []
    const mediaUrls = paths.map((path) => signed[path] || '').filter(Boolean)
    return {
      id: post.id,
      public_id: post.public_id,
      caption: post.caption,
      media_type: post.media_type,
      media_urls: mediaUrls,
      media_url: mediaUrls[0] || '',
      media_count: paths.length,
      is_paid: post.is_paid,
      price: post.price,
      like_count: Number(post.like_count) || 0,
      view_count: Number(post.view_count) || 0,
      created_at: post.created_at,
    }
  })
}

/**
 * Guest endpoint for public creator pages (/<username><5-digit serial>).
 * No auth required. Paid posts never expose media URLs to guests — only a
 * locked flag and price.
 */
const handlePublicProfile = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const viewer = await requireUser(req)
  const slug = (url.searchParams.get('slug') || '').trim().toLowerCase()

  const match = slug.match(/^(.{1,60}?)(\d{5})$/)
  if (!match) return jsonResponse({ error: 'Creator not found' }, 404, {}, [], origin)
  const [, usernamePart, serialStr] = match
  const serial = Number(serialStr)

  // Serial is the unique key; the username prefix must match exactly
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?public_serial=eq.${serial}&select=id,username,full_name,bio,avatar_url,public_serial,is_verified,verification_status&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!profileRes.ok) return jsonResponse({ error: 'Failed to load creator' }, 500, {}, [], origin)
  const profileRows = await profileRes.json().catch(() => [])
  const profile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null
  if (!profile || String(profile.username).toLowerCase() !== usernamePart) {
    return jsonResponse({ error: 'Creator not found' }, 404, {}, [], origin)
  }

  const countHeaders = { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' }
  const [postsRes, followersRes, postCountRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/posts?creator_id=eq.${profile.id}&select=public_id,media_type,media_paths,is_paid,price,like_count,view_count,created_at&order=created_at.desc&limit=60`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(`${SUPABASE_URL}/rest/v1/follows?following_id=eq.${profile.id}&select=follower_id`, {
      method: 'HEAD',
      headers: countHeaders,
    }),
    fetch(`${SUPABASE_URL}/rest/v1/posts?creator_id=eq.${profile.id}&select=id`, {
      method: 'HEAD',
      headers: countHeaders,
    }),
  ])

  const countFrom = (res: Response) => {
    const total = (res.headers.get('content-range') || '').split('/')[1]
    return total && total !== '*' ? Number(total) || 0 : 0
  }

  const postRows = postsRes.ok ? await postsRes.json().catch(() => []) : []
  const posts = Array.isArray(postRows) ? postRows : []
  const creatorUnlocked = profile.is_verified === true && profile.verification_status === 'verified'
  // Owner may always see their own public page content; everyone else sees locked empty feed.
  const viewerIsOwner = Boolean(viewer?.id && viewer.id === profile.id)
  const contentLocked = !creatorUnlocked && !viewerIsOwner

  // Authenticated viewers get short-lived signed previews for free posts only.
  // Paid tiles stay locked on this endpoint (unlock via /post after purchase).
  const previewPaths: string[] = []
  if (!contentLocked) {
    for (const p of posts) {
      if (viewer?.id && p.is_paid !== true) {
        const paths = Array.isArray(p.media_paths) ? p.media_paths as string[] : []
        if (paths[0]) previewPaths.push(paths[0])
      }
    }
  }
  const signedPreviews = await signMediaPaths(previewPaths)
  const publicPosts = contentLocked
    ? []
    : posts.map((p) => {
      const paths = Array.isArray(p.media_paths) ? p.media_paths as string[] : []
      const canPreview = Boolean(viewer?.id) && p.is_paid !== true
      const preview = canPreview && paths[0] ? (signedPreviews[paths[0]] || '') : ''
      return {
        public_id: p.public_id,
        media_type: p.media_type,
        is_paid: p.is_paid === true,
        price: p.is_paid === true ? p.price : 0,
        media_url: preview,
        media_count: paths.length,
        like_count: Number(p.like_count) || 0,
        view_count: Number(p.view_count) || 0,
      }
    })

  let isFollowing = false
  if (viewer?.id) {
    const followRes = await fetch(
      `${SUPABASE_URL}/rest/v1/follows?follower_id=eq.${viewer.id}&following_id=eq.${profile.id}&select=follower_id&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const followRows = followRes.ok ? await followRes.json().catch(() => []) : []
    isFollowing = Array.isArray(followRows) && followRows.length > 0
  }

  return jsonResponse({
    profile: {
      username: profile.username,
      full_name: profile.full_name || '',
      avatar_url: profile.avatar_url || '',
      bio: profile.bio || '',
      serial: String(profile.public_serial).padStart(5, '0'),
      is_verified: creatorUnlocked,
    },
    stats: {
      posts: contentLocked ? 0 : (postCountRes.ok ? countFrom(postCountRes) : posts.length),
      followers: followersRes.ok ? countFrom(followersRes) : 0,
    },
    viewer: {
      authenticated: Boolean(viewer?.id),
      role: viewer?.id ? (await getAccount(viewer.id))?.role || '' : '',
      is_following: isFollowing,
    },
    posts: publicPosts,
    rooms: contentLocked ? [] : await listCreatorExclusiveRooms(profile.id, viewer?.id),
    content_locked: contentLocked,
  }, 200, {}, [], origin)
}

const handlePublicFollow = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Login required' }, 401, {}, [], origin)
  const account = await getAccount(user.id)
  if (!account || !['user', 'creator'].includes(account.role)) {
    return jsonResponse({ error: 'Valid account required' }, 403, {}, [], origin)
  }

  const body = await parseJson(req)
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const match = slug.match(/^(.{1,60}?)(\d{5})$/)
  if (!match) return jsonResponse({ error: 'Creator not found' }, 404, {}, [], origin)
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?public_serial=eq.${Number(match[2])}&username=eq.${encodeURIComponent(match[1])}&select=id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const profiles = profileRes.ok ? await profileRes.json().catch(() => []) : []
  const creator = Array.isArray(profiles) && profiles.length ? profiles[0] : null
  if (!creator) return jsonResponse({ error: 'Creator not found' }, 404, {}, [], origin)
  if (creator.id === user.id) return jsonResponse({ error: 'You cannot follow yourself' }, 400, {}, [], origin)

  const toggleRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/toggle_creator_follow`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ p_follower_id: user.id, p_creator_id: creator.id }),
  })
  if (!toggleRes.ok) {
    console.error('Follow toggle failed:', await toggleRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to update follow' }, 500, {}, [], origin)
  }
  const following = await toggleRes.json().catch(() => false)
  if (following === true) {
    await createNotification({
      user_id: creator.id,
      actor_id: user.id,
      type: 'follow',
    })
    // Email only on new follow, never on unfollow. Uses creator signup email.
    notifyCreatorByEmail({
      creatorId: creator.id,
      actorId: user.id,
      kind: 'follow',
    }).catch(() => {})
  } else {
    await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${creator.id}&actor_id=eq.${user.id}&type=eq.follow`,
      { method: 'DELETE', headers: { ...authHeaders(true) } },
    ).catch(() => {})
  }
  return jsonResponse({ following: following === true }, 200, {}, [], origin)
}

const handlePostUploadUrls = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)

  const body = await parseJson(req)
  const mediaType = body.media_type === 'video' ? 'video' : body.media_type === 'image' ? 'image' : null
  const files = Array.isArray(body.files) ? body.files : []
  if (!mediaType) return jsonResponse({ error: 'media_type must be image or video' }, 400, {}, [], origin)
  if (!files.length) return jsonResponse({ error: 'No files provided' }, 400, {}, [], origin)

  if (mediaType === 'image') {
    if (files.length > MAX_IMAGES_PER_POST) return jsonResponse({ error: `Maximum ${MAX_IMAGES_PER_POST} images per post` }, 400, {}, [], origin)
    for (const file of files) {
      if (!POST_IMAGE_TYPES.includes(file?.content_type)) return jsonResponse({ error: 'Only JPG, JPEG, or PNG images are allowed' }, 400, {}, [], origin)
      if (typeof file?.size !== 'number' || file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
        return jsonResponse({ error: 'Each image must be 50MB or smaller' }, 400, {}, [], origin)
      }
    }
  } else {
    if (files.length !== 1) return jsonResponse({ error: 'Exactly one video per post' }, 400, {}, [], origin)
    const file = files[0]
    if (typeof file?.content_type !== 'string' || !file.content_type.startsWith('video/')) {
      return jsonResponse({ error: 'Only video files are allowed' }, 400, {}, [], origin)
    }
    if (typeof file?.size !== 'number' || file.size <= 0 || file.size > MAX_VIDEO_SIZE) {
      return jsonResponse({ error: 'Video must be 500MB or smaller' }, 400, {}, [], origin)
    }
  }

  const publicId = generatePostPublicId()
  const uploads: Array<{ path: string; upload_url: string; content_type: string }> = []

  for (let i = 0; i < files.length; i++) {
    const contentType = files[i].content_type as string
    const path = `${user.id}/${publicId}/${i}.${mediaExtension(contentType)}`
    const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${POST_MEDIA_BUCKET}/${path}`, {
      method: 'POST',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({}),
    })
    if (!signRes.ok) {
      console.error('Failed to create signed upload URL:', await signRes.text().catch(() => ''))
      return jsonResponse({ error: 'Failed to prepare upload' }, 500, {}, [], origin)
    }
    const signBody = await signRes.json().catch(() => ({}))
    if (!signBody?.url) return jsonResponse({ error: 'Failed to prepare upload' }, 500, {}, [], origin)
    uploads.push({ path, upload_url: `${SUPABASE_URL}/storage/v1${signBody.url}`, content_type: contentType })
  }

  return jsonResponse({ post_public_id: publicId, uploads }, 200, {}, [], origin)
}

const handleCreatePost = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)

  const body = await parseJson(req)
  const publicId = typeof body.public_id === 'string' ? body.public_id : ''
  const caption = typeof body.caption === 'string' ? body.caption.trim() : ''
  const mediaType = body.media_type === 'video' ? 'video' : body.media_type === 'image' ? 'image' : null
  const mediaPaths = Array.isArray(body.media_paths) ? body.media_paths.filter((p: unknown) => typeof p === 'string') : []
  const isPaid = body.is_paid === true
  const price = isPaid ? Number(body.price) : 0

  if (!/^[A-Za-z0-9]{12}$/.test(publicId)) return jsonResponse({ error: 'Invalid post id' }, 400, {}, [], origin)
  if (!mediaType) return jsonResponse({ error: 'media_type must be image or video' }, 400, {}, [], origin)
  if (caption.length > 200) return jsonResponse({ error: 'Caption must be 200 characters or fewer' }, 400, {}, [], origin)
  if (isPaid && (!Number.isFinite(price) || price < 10)) return jsonResponse({ error: 'Minimum price is ₹10 for paid posts' }, 400, {}, [], origin)
  if (mediaType === 'image' && (mediaPaths.length < 1 || mediaPaths.length > MAX_IMAGES_PER_POST)) {
    return jsonResponse({ error: `Post must contain 1-${MAX_IMAGES_PER_POST} images` }, 400, {}, [], origin)
  }
  if (mediaType === 'video' && mediaPaths.length !== 1) return jsonResponse({ error: 'Post must contain exactly one video' }, 400, {}, [], origin)

  const prefix = `${user.id}/${publicId}/`
  if (!mediaPaths.every((path: string) => path.startsWith(prefix))) {
    return jsonResponse({ error: 'Invalid media paths' }, 400, {}, [], origin)
  }

  // Confirm the files actually landed in storage before creating the post row
  const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${POST_MEDIA_BUCKET}`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ prefix: `${user.id}/${publicId}`, limit: 100 }),
  })
  if (!listRes.ok) return jsonResponse({ error: 'Failed to verify uploads' }, 500, {}, [], origin)
  const objects = await listRes.json().catch(() => [])
  const uploadedNames = new Set((Array.isArray(objects) ? objects : []).map((obj: { name?: string }) => `${prefix}${obj?.name}`))
  if (!mediaPaths.every((path: string) => uploadedNames.has(path))) {
    return jsonResponse({ error: 'Some media files were not uploaded' }, 400, {}, [], origin)
  }

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      ...authHeaders(true),
      Prefer: 'return=representation',
    },
    body: JSON.stringify([{
      creator_id: user.id,
      public_id: publicId,
      caption,
      media_type: mediaType,
      media_url: '',
      media_paths: mediaPaths,
      is_paid: isPaid,
      price: isPaid ? price : 0,
    }]),
  })

  if (!insertRes.ok) {
    const err = await insertRes.text().catch(() => '')
    console.error('Failed to create post:', err)
    return jsonResponse({ error: 'Failed to create post' }, 500, {}, [], origin)
  }

  const rows = await insertRes.json().catch(() => [])
  const decorated = await decoratePosts(Array.isArray(rows) ? rows : [])
  return jsonResponse({ status: 'post_created', post: decorated[0] || null }, 200, {}, [], origin)
}

const handleGetProfile = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const [res, postsCountRes, followersCountRes, followingCountRes, postsRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=id,username,full_name,bio,avatar_url,location,instagram_url,facebook_url,gender,public_serial,is_verified,verification_public_id,verification_status&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(`${SUPABASE_URL}/rest/v1/posts?creator_id=eq.${user.id}&select=id`, {
      method: 'HEAD',
      headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' },
    }),
    fetch(`${SUPABASE_URL}/rest/v1/follows?following_id=eq.${user.id}&select=follower_id`, {
      method: 'HEAD',
      headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' },
    }),
    fetch(`${SUPABASE_URL}/rest/v1/follows?follower_id=eq.${user.id}&select=following_id`, {
      method: 'HEAD',
      headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' },
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/posts?creator_id=eq.${user.id}&select=id,public_id,caption,media_type,media_paths,is_paid,price,like_count,view_count,created_at&order=created_at.desc&limit=50`,
      { headers: { ...authHeaders(true) } },
    ),
  ])

  if (!res.ok) return jsonResponse({ error: 'Failed to load profile' }, 500, {}, [], origin)

  const rows = await res.json().catch(() => [])
  const profile = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!profile) return jsonResponse({ error: 'Profile not found' }, 404, {}, [], origin)

  const readCount = (response: Response) => {
    const range = response.headers.get('content-range') || ''
    const total = range.split('/')[1]
    return total && total !== '*' ? Number(total) || 0 : 0
  }
  const rawPosts = postsRes.ok ? await postsRes.json().catch(() => []) : []
  const posts = await decoratePosts(Array.isArray(rawPosts) ? rawPosts : [])
  const stats = {
    posts: postsCountRes.ok ? readCount(postsCountRes) : 0,
    followers: followersCountRes.ok ? readCount(followersCountRes) : 0,
    following: followingCountRes.ok ? readCount(followingCountRes) : 0,
  }

  const rooms = await listCreatorExclusiveRooms(user.id, user.id)
  return jsonResponse({ profile, stats, posts, rooms }, 200, {}, [], origin)
}

const handleProfile = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user?.id) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)

  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
  const bio = typeof body.bio === 'string' ? body.bio.trim() : ''
  const location = typeof body.location === 'string' ? body.location.trim() : ''
  const instagramUrl = typeof body.instagram_url === 'string' ? body.instagram_url.trim() : ''
  const facebookUrl = typeof body.facebook_url === 'string' ? body.facebook_url.trim() : ''
  const gender = typeof body.gender === 'string' ? body.gender : 'Prefer not to say'
  if (!fullName) return jsonResponse({ error: 'Display name is required' }, 400, {}, [], origin)
  if (!bio) return jsonResponse({ error: 'Bio is required' }, 400, {}, [], origin)
  if (fullName.length > 100) return jsonResponse({ error: 'Display name must be 100 characters or fewer' }, 400, {}, [], origin)
  if (bio.length > 400) return jsonResponse({ error: 'Bio must be 400 characters or fewer' }, 400, {}, [], origin)
  if (location.length > 100) return jsonResponse({ error: 'Location must be 100 characters or fewer' }, 400, {}, [], origin)
  if (!['Prefer not to say', 'Male', 'Female', 'Transgender'].includes(gender)) {
    return jsonResponse({ error: 'Invalid gender' }, 400, {}, [], origin)
  }
  for (const [label, value] of [['Instagram', instagramUrl], ['Facebook', facebookUrl]]) {
    if (!value) continue
    try {
      const parsed = new URL(value)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      return jsonResponse({ error: `${label} URL is invalid` }, 400, {}, [], origin)
    }
  }

  // Usernames are permanent once created at signup. Reject any attempt to
  // change it, even from clients that bypass the frontend.
  const requestedUsername = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  if (requestedUsername) {
    const current = await fetchProfileBrief(user.id)
    const currentUsername = String(current?.username || '').toLowerCase()
    if (currentUsername && requestedUsername !== currentUsername) {
      return jsonResponse({ error: 'Username cannot be changed' }, 400, {}, [], origin)
    }
  }

  const patch: Record<string, unknown> = {
    full_name: fullName,
    bio,
    location,
    instagram_url: instagramUrl,
    facebook_url: facebookUrl,
    gender,
    updated_at: new Date().toISOString(),
  }

  if (typeof body.avatar_base64 === 'string' && body.avatar_base64) {
    const contentType = typeof body.avatar_content_type === 'string' ? body.avatar_content_type : 'image/jpeg'
    const uploaded = await uploadAvatar(user.id, body.avatar_base64, contentType)
    if (!uploaded.ok) return jsonResponse({ error: uploaded.error || 'Failed to upload avatar' }, 400, {}, [], origin)
    patch.avatar_url = uploaded.url
  } else if (typeof body.avatar_url === 'string' && body.avatar_url) {
    patch.avatar_url = body.avatar_url
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(true),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.error('Profile update failed:', err)
    return jsonResponse({ error: 'Failed to update profile' }, 500, {}, [], origin)
  }

  const rows = await res.json().catch(() => [])
  return jsonResponse({ profile: Array.isArray(rows) ? rows[0] : rows }, 200, {}, [], origin)
}

const handleGetPayoutAccount = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/payout_accounts?user_id=eq.${user.id}&select=account_holder,account_number,ifsc,upi_id,updated_at&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load payout account' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  return jsonResponse({ account: publicPayoutAccount(row) }, 200, {}, [], origin)
}

const handleSavePayoutAccount = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const accountHolder = typeof body.account_holder === 'string' ? body.account_holder.trim() : ''
  const accountNumber = typeof body.account_number === 'string' ? body.account_number.trim() : ''
  const ifsc = typeof body.ifsc === 'string' ? body.ifsc.trim().toUpperCase() : ''
  const upiId = typeof body.upi_id === 'string' ? body.upi_id.trim() : ''

  if (accountHolder.length < 2 || accountHolder.length > 100) {
    return jsonResponse({ error: 'Account holder name must be 2-100 characters' }, 400, {}, [], origin)
  }
  if (!/^\d{9,18}$/.test(accountNumber)) {
    return jsonResponse({ error: 'Account number must be 9-18 digits' }, 400, {}, [], origin)
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return jsonResponse({ error: 'Enter a valid IFSC code (e.g. SBIN0001234)' }, 400, {}, [], origin)
  }
  if (upiId && !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(upiId)) {
    return jsonResponse({ error: 'Enter a valid UPI ID (e.g. name@bank)' }, 400, {}, [], origin)
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/payout_accounts?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      ...authHeaders(true),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([{
      user_id: user.id,
      account_holder: accountHolder,
      account_number: accountNumber,
      ifsc,
      upi_id: upiId,
      updated_at: new Date().toISOString(),
    }]),
  })

  if (!res.ok) {
    console.error('Payout account save failed:', await res.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to save bank details' }, 500, {}, [], origin)
  }
  const rows = await res.json().catch(() => [])
  const row = Array.isArray(rows) ? rows[0] : rows
  return jsonResponse({ account: publicPayoutAccount(row) }, 200, {}, [], origin)
}

const handleGetWallet = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user?.id) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  // Lifetime = all paid sales (posts + exclusive). Available = paid ≥24h ago − withdrawals.
  const [lifetimeRes, withdrawableRes, salesRes, exclusiveSalesRes, wdRes, countRes, exclusiveCountRes, payoutRes, feeBpsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/rpc/wallet_lifetime_paise`, {
      method: 'POST',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({ p_creator_id: user.id }),
    }),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/wallet_withdrawable_paise`, {
      method: 'POST',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({ p_creator_id: user.id }),
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/post_purchases?creator_id=eq.${user.id}&status=eq.paid&select=id,amount,amount_paise,paid_at,post_id,user_id&order=paid_at.desc&limit=100`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?creator_id=eq.${user.id}&status=eq.paid&select=id,amount_paise,paid_at,room_id,user_id&order=paid_at.desc&limit=100`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/wallet_withdrawals?creator_id=eq.${user.id}&select=id,amount_paise,platform_fee_paise,net_payout_paise,fee_bps,status,account_holder,account_number_last4,ifsc,upi_id,created_at,processed_at,transfer_txn_id&order=created_at.desc&limit=50`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/post_purchases?creator_id=eq.${user.id}&status=eq.paid&select=id`,
      { method: 'HEAD', headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?creator_id=eq.${user.id}&status=eq.paid&select=id`,
      { method: 'HEAD', headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/payout_accounts?user_id=eq.${user.id}&select=account_holder,account_number,ifsc,upi_id,updated_at&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/platform_withdrawal_fee_bps`, {
      method: 'POST',
      headers: { ...authHeaders(true) },
      body: '{}',
    }),
  ])

  if (!salesRes.ok) return jsonResponse({ error: 'Failed to load sales' }, 500, {}, [], origin)
  const salesRaw = await salesRes.json().catch(() => [])
  const salesRows = Array.isArray(salesRaw) ? salesRaw : []
  const exclusiveRaw = exclusiveSalesRes.ok ? await exclusiveSalesRes.json().catch(() => []) : []
  const exclusiveRows = Array.isArray(exclusiveRaw) ? exclusiveRaw : []
  const withdrawals = wdRes.ok ? await wdRes.json().catch(() => []) : []

  let lifetimePaise = Number(lifetimeRes.ok ? await lifetimeRes.json().catch(() => 0) : 0) || 0
  let withdrawablePaise = Number(withdrawableRes.ok ? await withdrawableRes.json().catch(() => 0) : 0) || 0
  if (!lifetimeRes.ok) {
    for (const sale of salesRows) {
      lifetimePaise += Number(sale.amount_paise || Math.round(Number(sale.amount || 0) * 100))
    }
    for (const sale of exclusiveRows) lifetimePaise += Number(sale.amount_paise || 0)
  }
  if (!withdrawableRes.ok) withdrawablePaise = lifetimePaise
  let reservedPaise = 0
  for (const w of Array.isArray(withdrawals) ? withdrawals : []) {
    if (w.status === 'pending' || w.status === 'accepted' || w.status === 'paid') {
      reservedPaise += Number(w.amount_paise || 0)
    }
  }
  const availablePaise = Math.max(0, withdrawablePaise - reservedPaise)
  const heldPaise = Math.max(0, lifetimePaise - withdrawablePaise)
  const readCountHdr = (response: Response) => {
    const total = (response.headers.get('content-range') || '').split('/')[1]
    return total && total !== '*' ? Number(total) || 0 : 0
  }
  const salesCount = (countRes.ok ? readCountHdr(countRes) : salesRows.length)
    + (exclusiveCountRes.ok ? readCountHdr(exclusiveCountRes) : exclusiveRows.length)

  const postIds = [...new Set(salesRows.map((s: { post_id: string }) => s.post_id).filter(Boolean))]
  let postMap: Record<string, { public_id: string; caption: string }> = {}
  if (postIds.length) {
    const postsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=in.(${postIds.join(',')})&select=id,public_id,caption`,
      { headers: { ...authHeaders(true) } },
    )
    const posts = postsRes.ok ? await postsRes.json().catch(() => []) : []
    for (const p of Array.isArray(posts) ? posts : []) {
      postMap[p.id] = { public_id: p.public_id, caption: p.caption || '' }
    }
  }

  const roomIds = [...new Set(exclusiveRows.map((s: { room_id: string }) => s.room_id).filter(Boolean))]
  let roomMap: Record<string, string> = {}
  if (roomIds.length) {
    const roomsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_rooms?id=in.(${roomIds.join(',')})&select=id,name`,
      { headers: { ...authHeaders(true) } },
    )
    for (const r of roomsRes.ok ? await roomsRes.json().catch(() => []) : []) {
      roomMap[r.id] = r.name || 'Exclusive'
    }
  }

  const postSales = salesRows.map((s: Record<string, unknown>) => {
    const paise = Number(s.amount_paise || Math.round(Number(s.amount || 0) * 100))
    const post = postMap[String(s.post_id)] || { public_id: '', caption: '' }
    const paidAt = s.paid_at ? new Date(String(s.paid_at)).getTime() : 0
    return {
      id: s.id,
      kind: 'post',
      amount: paise / 100,
      amount_paise: paise,
      paid_at: s.paid_at,
      withdrawable: paidAt > 0 && Date.now() >= paidAt + 24 * 60 * 60 * 1000,
      unlocks_at: paidAt ? new Date(paidAt + 24 * 60 * 60 * 1000).toISOString() : null,
      post_public_id: post.public_id,
      caption: post.caption || 'Post unlock',
    }
  })
  const exclusiveSalesMapped = exclusiveRows.map((s: Record<string, unknown>) => {
    const paise = Number(s.amount_paise || 0)
    const paidAt = s.paid_at ? new Date(String(s.paid_at)).getTime() : 0
    const roomName = roomMap[String(s.room_id)] || 'Exclusive room'
    return {
      id: s.id,
      kind: 'exclusive',
      amount: paise / 100,
      amount_paise: paise,
      paid_at: s.paid_at,
      withdrawable: paidAt > 0 && Date.now() >= paidAt + 24 * 60 * 60 * 1000,
      unlocks_at: paidAt ? new Date(paidAt + 24 * 60 * 60 * 1000).toISOString() : null,
      post_public_id: '',
      caption: `${roomName} · monthly entry`,
    }
  })
  const sales = [...postSales, ...exclusiveSalesMapped]
    .sort((x, y) => new Date(String(y.paid_at || 0)).getTime() - new Date(String(x.paid_at || 0)).getTime())
    .slice(0, 100)

  const payoutRows = payoutRes.ok ? await payoutRes.json().catch(() => []) : []
  const payout = Array.isArray(payoutRows) && payoutRows.length ? payoutRows[0] : null

  let feeBps = Number(feeBpsRes.ok ? await feeBpsRes.json().catch(() => 900) : 900)
  if (!Number.isFinite(feeBps) || feeBps < 0) feeBps = 900

  let previewFeePaise = 0
  let previewNetPaise = availablePaise
  if (availablePaise > 0) {
    const [feeRes, netRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/calc_withdrawal_platform_fee_paise`, {
        method: 'POST',
        headers: { ...authHeaders(true) },
        body: JSON.stringify({ p_amount_paise: availablePaise }),
      }),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/calc_withdrawal_net_payout_paise`, {
        method: 'POST',
        headers: { ...authHeaders(true) },
        body: JSON.stringify({ p_amount_paise: availablePaise }),
      }),
    ])
    previewFeePaise = Number(feeRes.ok ? await feeRes.json().catch(() => 0) : 0) || 0
    previewNetPaise = Number(netRes.ok ? await netRes.json().catch(() => availablePaise) : availablePaise) || 0
  }

  const mapWithdrawal = (w: Record<string, unknown>) => {
    const amountPaise = Number(w.amount_paise || 0)
    const feePaise = Number(w.platform_fee_paise ?? 0)
    const netPaise = Number(w.net_payout_paise ?? Math.max(0, amountPaise - feePaise))
    const rowFeeBps = Number(w.fee_bps ?? feeBps)
    return {
      ...w,
      amount: amountPaise / 100,
      amount_paise: amountPaise,
      platform_fee: feePaise / 100,
      platform_fee_paise: feePaise,
      net_payout: netPaise / 100,
      net_payout_paise: netPaise,
      fee_bps: rowFeeBps,
      fee_percent: rowFeeBps / 100,
    }
  }

  return jsonResponse({
    available_balance: availablePaise / 100,
    available_paise: availablePaise,
    lifetime_earnings: lifetimePaise / 100,
    lifetime_paise: lifetimePaise,
    held_balance: heldPaise / 100,
    held_paise: heldPaise,
    sales_count: salesCount,
    min_withdraw: 100,
    withdraw_hold_hours: 24,
    platform_fee_bps: feeBps,
    platform_fee_percent: feeBps / 100,
    withdraw_preview: {
      gross: availablePaise / 100,
      platform_fee: previewFeePaise / 100,
      net_payout: previewNetPaise / 100,
      fee_bps: feeBps,
      fee_percent: feeBps / 100,
    },
    sales,
    withdrawals: Array.isArray(withdrawals) ? withdrawals.map(mapWithdrawal) : [],
    account: publicPayoutAccount(payout),
  }, 200, {}, [], origin)
}

const handleWalletWithdraw = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user?.id) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount < 100) {
    return jsonResponse({ error: 'Minimum withdrawal is ₹100' }, 400, {}, [], origin)
  }
  const amountPaise = Math.round(amount * 100)

  const payoutRes = await fetch(
    `${SUPABASE_URL}/rest/v1/payout_accounts?user_id=eq.${user.id}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const payoutRows = payoutRes.ok ? await payoutRes.json().catch(() => []) : []
  const payout = Array.isArray(payoutRows) && payoutRows.length ? payoutRows[0] : null
  if (!payout?.account_number) {
    return jsonResponse({ error: 'Add bank details before withdrawing' }, 400, {}, [], origin)
  }

  // Atomic balance check + insert (prevents double-spend races).
  const insert = await fetch(`${SUPABASE_URL}/rest/v1/rpc/request_wallet_withdrawal`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({
      p_creator_id: user.id,
      p_amount_paise: amountPaise,
      p_account_holder: payout.account_holder,
      p_account_number_last4: String(payout.account_number).slice(-4),
      p_ifsc: payout.ifsc,
      p_upi_id: payout.upi_id || '',
    }),
  })
  if (!insert.ok) {
    const errText = await insert.text().catch(() => '')
    console.error('Withdraw failed:', errText)
    if (/insufficient_balance/i.test(errText)) {
      return jsonResponse({ error: 'Insufficient available balance' }, 400, {}, [], origin)
    }
    if (/minimum_withdrawal/i.test(errText)) {
      return jsonResponse({ error: 'Minimum withdrawal is ₹100' }, 400, {}, [], origin)
    }
    if (/fee_calc_mismatch/i.test(errText)) {
      return jsonResponse({ error: 'Platform fee calculation failed' }, 500, {}, [], origin)
    }
    return jsonResponse({ error: 'Failed to submit withdrawal' }, 500, {}, [], origin)
  }
  const row = await insert.json().catch(() => null)
  const amountPaiseOut = Number(row?.amount_paise ?? amountPaise)
  const feePaise = Number(row?.platform_fee_paise ?? 0)
  const netPaise = Number(row?.net_payout_paise ?? Math.max(0, amountPaiseOut - feePaise))
  const feeBps = Number(row?.fee_bps ?? 0)
  return jsonResponse({
    status: 'withdrawal_requested',
    withdrawal: row ? {
      ...row,
      amount: amountPaiseOut / 100,
      platform_fee: feePaise / 100,
      net_payout: netPaise / 100,
      fee_bps: feeBps,
      fee_percent: feeBps / 100,
    } : null,
  }, 200, {}, [], origin)
}

const AUTH_ADMIN_SECRET = Deno.env.get('AUTH_ADMIN_SECRET') || ''

const requireAdminSecret = (req: Request) => {
  if (!AUTH_ADMIN_SECRET) return false
  const header = req.headers.get('authorization') || ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  const alt = req.headers.get('x-admin-secret') || ''
  return bearer === AUTH_ADMIN_SECRET || alt === AUTH_ADMIN_SECRET
}

/** Mark a pending withdrawal paid or rejected. Admin session or AUTH_ADMIN_SECRET. */
const handleAdminWalletWithdraw = async (req: Request) => {
  const origin = req.headers.get('origin')
  const adminUser = await requireAdmin(req)
  if (!adminUser && !requireAdminSecret(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  }

  const body = await parseJson(req)
  const id = typeof body.withdrawal_id === 'string' ? body.withdrawal_id.trim() : ''
  const status = body.status === 'paid' || body.status === 'rejected' || body.status === 'accepted'
    ? body.status
    : ''
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
  if (!/^[0-9a-f-]{36}$/i.test(id) || !status) {
    return jsonResponse({ error: 'withdrawal_id and status required' }, 400, {}, [], origin)
  }

  const update: Record<string, unknown> = { status }
  if (status === 'accepted') update.accepted_at = new Date().toISOString()
  if (status === 'paid' || status === 'rejected') update.processed_at = new Date().toISOString()
  if (note) update.note = note

  const filter = status === 'accepted'
    ? `id=eq.${id}&status=eq.pending`
    : status === 'paid'
    ? `id=eq.${id}&status=in.(pending,accepted)`
    : `id=eq.${id}&status=in.(pending,accepted)`

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/wallet_withdrawals?${filter}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=representation' },
      body: JSON.stringify(update),
    },
  )
  if (!res.ok) {
    console.error('Admin withdraw update failed:', await res.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to update withdrawal' }, 500, {}, [], origin)
  }
  const rows = await res.json().catch(() => [])
  if (!Array.isArray(rows) || !rows.length) {
    return jsonResponse({ error: 'Withdrawal not found or already processed' }, 404, {}, [], origin)
  }
  return jsonResponse({ status: 'updated', withdrawal: rows[0] }, 200, {}, [], origin)
}

const uploadAdminSlip = async (
  withdrawalId: string,
  base64: string,
  contentType: string,
): Promise<{ ok: boolean; path?: string; error?: string }> => {
  const allowed: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  const ext = allowed[contentType]
  if (!ext) return { ok: false, error: 'Slip must be JPG, PNG, WEBP, or PDF' }
  const cleaned = base64.includes(',') ? base64.split(',').pop() as string : base64
  let bytes: Uint8Array
  try {
    const binary = atob(cleaned)
    bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  } catch {
    return { ok: false, error: 'Invalid slip data' }
  }
  if (bytes.byteLength > 5 * 1024 * 1024) return { ok: false, error: 'Slip exceeds 5MB' }
  const path = `${withdrawalId}/slip.${ext}`
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/admin-slips/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: bytes,
  })
  if (!uploadRes.ok) {
    console.error('Slip upload failed:', await uploadRes.text().catch(() => ''))
    return { ok: false, error: 'Failed to upload slip' }
  }
  return { ok: true, path }
}

const signAdminSlip = async (path: string) => {
  if (!path) return ''
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/admin-slips`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ expiresIn: 600, paths: [path] }),
  })
  if (!res.ok) return ''
  const rows = await res.json().catch(() => [])
  const row = Array.isArray(rows) ? rows[0] : null
  return row?.signedURL ? `${SUPABASE_URL}/storage/v1${row.signedURL}` : ''
}

const handleAdminCompleteWithdrawal = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const id = typeof body.withdrawal_id === 'string' ? body.withdrawal_id.trim() : ''
  const txnId = typeof body.transfer_txn_id === 'string' ? body.transfer_txn_id.trim().slice(0, 120) : ''
  const amount = Number(body.transfer_amount)
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
  if (!/^[0-9a-f-]{36}$/i.test(id) || !txnId) {
    return jsonResponse({ error: 'withdrawal_id and transfer_txn_id required' }, 400, {}, [], origin)
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ error: 'Enter a valid transferred amount' }, 400, {}, [], origin)
  }
  const amountPaise = Math.round(amount * 100)

  let slipPath = ''
  if (typeof body.slip_base64 === 'string' && body.slip_base64) {
    const contentType = typeof body.slip_content_type === 'string' ? body.slip_content_type : 'image/jpeg'
    const uploaded = await uploadAdminSlip(id, body.slip_base64, contentType)
    if (!uploaded.ok) return jsonResponse({ error: uploaded.error || 'Slip upload failed' }, 400, {}, [], origin)
    slipPath = uploaded.path || ''
  }

  const update: Record<string, unknown> = {
    status: 'paid',
    processed_at: new Date().toISOString(),
    transfer_txn_id: txnId,
    transfer_amount_paise: amountPaise,
  }
  if (slipPath) update.transfer_slip_path = slipPath
  if (note) update.note = note
  if (!body.skip_accept) update.accepted_at = new Date().toISOString()

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/wallet_withdrawals?id=eq.${id}&status=in.(pending,accepted)`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=representation' },
      body: JSON.stringify(update),
    },
  )
  if (!res.ok) {
    console.error('Complete withdrawal failed:', await res.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to complete withdrawal' }, 500, {}, [], origin)
  }
  const rows = await res.json().catch(() => [])
  if (!Array.isArray(rows) || !rows.length) {
    return jsonResponse({ error: 'Withdrawal not found or already processed' }, 404, {}, [], origin)
  }
  return jsonResponse({ status: 'paid', withdrawal: rows[0] }, 200, {}, [], origin)
}

const handleAdminLogin = async (req: Request) => {
  const origin = req.headers.get('origin')
  const { email, password } = await parseJson(req)
  const normalized = normalizeEmail(email)
  if (!validEmail(normalized) || !password) {
    return jsonResponse({ error: 'Missing credentials' }, 400, {}, [], origin)
  }
  const limited = await enforceRateLimit(`admin-login:ip:${clientIp(req)}`, 20, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)

  const data = await signIn(normalized, password)
  if (isAuthError(data)) return jsonResponse({ error: authErrorMessage(data, 'Login failed') }, 401, {}, [], origin)
  if (!data.access_token || !data.refresh_token) {
    return jsonResponse({ error: 'Login did not return tokens' }, 500, {}, [], origin)
  }

  const account = await getAccount(data.user?.id)
  if (account?.role !== 'admin') {
    return jsonResponse({ error: 'Admin access denied' }, 403, {}, [
      clearCookie('sb-access-token'),
      clearCookie('sb-refresh-token'),
    ], origin)
  }

  const cookies = [
    buildCookie('sb-access-token', data.access_token, data.expires_in || 3600),
    buildCookie('sb-refresh-token', data.refresh_token, 60 * 60 * 24 * 30),
  ]
  const user = await userWithRole(data.user)
  return jsonResponse({
    user,
    admin_id: data.user.id,
    redirect_path: `/admin${data.user.id}`,
  }, 200, {}, cookies, origin)
}

const countRows = async (table: string, filter = '') => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id${filter}`,
    { method: 'HEAD', headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' } },
  )
  const total = (res.headers.get('content-range') || '').split('/')[1]
  return total && total !== '*' ? Number(total) || 0 : 0
}

const handleAdminStats = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const [users, creators, posts, openTickets, postReports, userReports, pendingWd] = await Promise.all([
    countRows('user_accounts'),
    countRows('user_accounts', '&role=eq.creator'),
    countRows('posts'),
    countRows('support_tickets', '&status=eq.open'),
    countRows('post_reports'),
    countRows('user_reports'),
    countRows('wallet_withdrawals', '&status=eq.pending'),
  ])

  return jsonResponse({
    stats: {
      users,
      creators,
      posts,
      open_tickets: openTickets,
      post_reports: postReports,
      user_reports: userReports,
      pending_withdrawals: pendingWd,
    },
  }, 200, {}, [], origin)
}

const handleAdminUsers = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?select=id,role,name,email,created_at&order=created_at.desc&limit=200`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load users' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const list = Array.isArray(rows) ? rows : []
  const creatorIds = list.filter((r) => r.role === 'creator').map((r) => r.id)
  const profiles: Record<string, { username: string; avatar_url: string; full_name: string }> = {}
  if (creatorIds.length) {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${creatorIds.join(',')})&select=id,username,avatar_url,full_name`,
      { headers: { ...authHeaders(true) } },
    )
    const profileRows = profileRes.ok ? await profileRes.json().catch(() => []) : []
    for (const p of Array.isArray(profileRows) ? profileRows : []) {
      profiles[p.id] = {
        username: p.username || '',
        avatar_url: p.avatar_url || '',
        full_name: p.full_name || '',
      }
    }
  }

  return jsonResponse({
    users: list.map((row) => ({
      id: row.id,
      role: row.role,
      name: row.name || profiles[row.id]?.full_name || '',
      email: row.email || '',
      username: profiles[row.id]?.username || '',
      avatar_url: profiles[row.id]?.avatar_url || '',
      created_at: row.created_at,
    })),
  }, 200, {}, [], origin)
}

const handleAdminUserDetail = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const id = url.searchParams.get('id') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonResponse({ error: 'Invalid user id' }, 400, {}, [], origin)

  const accountRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${id}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const accounts = accountRes.ok ? await accountRes.json().catch(() => []) : []
  const account = Array.isArray(accounts) && accounts.length ? accounts[0] : null
  if (!account) return jsonResponse({ error: 'User not found' }, 404, {}, [], origin)

  const [profileRes, postsCountRes, followersCountRes, lifetimeRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=id,username,full_name,avatar_url,bio,created_at&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/posts?creator_id=eq.${id}&select=id`,
      { method: 'HEAD', headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/follows?following_id=eq.${id}&select=follower_id`,
      { method: 'HEAD', headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' } },
    ),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/wallet_lifetime_paise`, {
      method: 'POST',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({ p_creator_id: id }),
    }),
  ])
  const profiles = profileRes.ok ? await profileRes.json().catch(() => []) : []
  const profile = Array.isArray(profiles) && profiles.length ? profiles[0] : null
  const postsCount = Number((postsCountRes.headers.get('content-range') || '').split('/')[1] || 0) || 0
  const followersCount = Number((followersCountRes.headers.get('content-range') || '').split('/')[1] || 0) || 0
  const lifetimePaise = Number(lifetimeRes.ok ? await lifetimeRes.json().catch(() => 0) : 0) || 0

  return jsonResponse({
    user: {
      id: account.id,
      role: account.role,
      name: account.name || profile?.full_name || '',
      email: account.email || '',
      username: profile?.username || '',
      avatar_url: profile?.avatar_url || '',
      bio: profile?.bio || '',
      post_count: postsCount,
      followers_count: followersCount,
      joined_at: account.created_at,
      total_earnings: lifetimePaise / 100,
      total_earnings_paise: lifetimePaise,
    },
  }, 200, {}, [], origin)
}

const handleAdminPosts = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?select=id,public_id,caption,media_type,is_paid,price,creator_id,like_count,view_count,created_at&order=created_at.desc&limit=200`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load posts' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const list = Array.isArray(rows) ? rows : []
  const creatorIds = [...new Set(list.map((p) => p.creator_id).filter(Boolean))]
  const profiles: Record<string, string> = {}
  if (creatorIds.length) {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${creatorIds.join(',')})&select=id,username`,
      { headers: { ...authHeaders(true) } },
    )
    const profileRows = profileRes.ok ? await profileRes.json().catch(() => []) : []
    for (const p of Array.isArray(profileRows) ? profileRows : []) profiles[p.id] = p.username || ''
  }

  return jsonResponse({
    posts: list.map((p) => ({
      id: p.id,
      public_id: p.public_id,
      caption: p.caption || '',
      media_type: p.media_type,
      is_paid: p.is_paid === true,
      price: Number(p.price) || 0,
      creator_id: p.creator_id,
      creator_username: profiles[p.creator_id] || '',
      like_count: Number(p.like_count) || 0,
      view_count: Number(p.view_count) || 0,
      created_at: p.created_at,
    })),
  }, 200, {}, [], origin)
}

const handleAdminViewPost = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const post = await fetchPostByPublicId(url.searchParams.get('public_id') || '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)

  const paths = Array.isArray(post.media_paths) ? post.media_paths as string[] : []
  const signed = await signMediaPaths(paths, 300)
  const mediaUrls = paths.map((path: string) => signed[path] || '').filter(Boolean)
  const owner = await fetchProfileBrief(post.creator_id)

  return jsonResponse({
    post: {
      public_id: post.public_id,
      caption: post.caption || '',
      media_type: post.media_type,
      media_urls: mediaUrls,
      is_paid: post.is_paid === true,
      price: Number(post.price) || 0,
      like_count: Number(post.like_count) || 0,
      view_count: Number(post.view_count) || 0,
      created_at: post.created_at,
      creator: {
        id: post.creator_id,
        username: owner?.username || '',
        full_name: owner?.full_name || '',
        avatar_url: owner?.avatar_url || '',
      },
    },
  }, 200, {}, [], origin)
}

const handleAdminDeletePost = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const post = await fetchPostByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)

  const paths = Array.isArray(post.media_paths) ? post.media_paths as string[] : []
  if (paths.length) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${POST_MEDIA_BUCKET}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({ prefixes: paths }),
    }).catch(() => {})
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post.id}`, {
    method: 'DELETE',
    headers: { ...authHeaders(true) },
  })
  if (!res.ok) return jsonResponse({ error: 'Failed to delete post' }, 500, {}, [], origin)
  return jsonResponse({ status: 'post_deleted' }, 200, {}, [], origin)
}

const handleAdminSupportTickets = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/support_tickets?select=*&order=created_at.desc&limit=200`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load tickets' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const list = Array.isArray(rows) ? rows : []
  const userIds = [...new Set(list.map((t) => t.user_id).filter(Boolean))]
  const accounts: Record<string, { name: string; email: string }> = {}
  if (userIds.length) {
    const accountRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_accounts?id=in.(${userIds.join(',')})&select=id,name,email`,
      { headers: { ...authHeaders(true) } },
    )
    const accountRows = accountRes.ok ? await accountRes.json().catch(() => []) : []
    for (const a of Array.isArray(accountRows) ? accountRows : []) {
      accounts[a.id] = { name: a.name || '', email: a.email || '' }
    }
  }

  return jsonResponse({
    tickets: list.map((t) => ({
      id: t.id,
      user_id: t.user_id,
      user_name: accounts[t.user_id]?.name || '',
      user_email: accounts[t.user_id]?.email || '',
      subject: t.subject,
      message: t.message,
      status: t.status,
      admin_reply: t.admin_reply || '',
      created_at: t.created_at,
      updated_at: t.updated_at,
    })),
  }, 200, {}, [], origin)
}

const handleAdminUpdateSupportTicket = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const status = body.status === 'open' || body.status === 'in_progress' || body.status === 'resolved'
    ? body.status
    : ''
  const adminReply = typeof body.admin_reply === 'string' ? body.admin_reply.trim().slice(0, 2000) : ''
  if (!/^[0-9a-f-]{36}$/i.test(id) || !status) {
    return jsonResponse({ error: 'id and status required' }, 400, {}, [], origin)
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/support_tickets?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify({
      status,
      admin_reply: adminReply,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) return jsonResponse({ error: 'Failed to update ticket' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  return jsonResponse({ ticket: Array.isArray(rows) ? rows[0] : rows }, 200, {}, [], origin)
}

const handleAdminPostReports = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/post_reports?select=*&order=created_at.desc&limit=200`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load reports' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  return jsonResponse({ reports: Array.isArray(rows) ? rows : [] }, 200, {}, [], origin)
}

const handleAdminUserReports = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_reports?select=*&order=created_at.desc&limit=200`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load reports' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  return jsonResponse({ reports: Array.isArray(rows) ? rows : [] }, 200, {}, [], origin)
}

const handleAdminWithdrawals = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/wallet_withdrawals?select=*&order=created_at.desc&limit=200`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load withdrawals' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const list = Array.isArray(rows) ? rows : []
  const creatorIds = [...new Set(list.map((w) => w.creator_id).filter(Boolean))]
  const accounts: Record<string, { name: string; email: string }> = {}
  const profiles: Record<string, { username: string; avatar_url: string }> = {}
  const payouts: Record<string, Record<string, unknown>> = {}
  if (creatorIds.length) {
    const [accountRes, profileRes, payoutRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/user_accounts?id=in.(${creatorIds.join(',')})&select=id,name,email`,
        { headers: { ...authHeaders(true) } },
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${creatorIds.join(',')})&select=id,username,avatar_url`,
        { headers: { ...authHeaders(true) } },
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/payout_accounts?user_id=in.(${creatorIds.join(',')})&select=*`,
        { headers: { ...authHeaders(true) } },
      ),
    ])
    for (const a of accountRes.ok ? await accountRes.json().catch(() => []) : []) {
      accounts[a.id] = { name: a.name || '', email: a.email || '' }
    }
    for (const p of profileRes.ok ? await profileRes.json().catch(() => []) : []) {
      profiles[p.id] = { username: p.username || '', avatar_url: p.avatar_url || '' }
    }
    for (const p of payoutRes.ok ? await payoutRes.json().catch(() => []) : []) {
      payouts[p.user_id] = p
    }
  }

  const withdrawals = await Promise.all(list.map(async (w) => {
    const slipUrl = w.transfer_slip_path ? await signAdminSlip(String(w.transfer_slip_path)) : ''
    const payout = payouts[w.creator_id]
    const amountPaise = Number(w.amount_paise || 0)
    const feePaise = Number(w.platform_fee_paise ?? 0)
    const netPaise = Number(w.net_payout_paise ?? Math.max(0, amountPaise - feePaise))
    const feeBps = Number(w.fee_bps ?? 0)
    return {
      ...w,
      amount: amountPaise / 100,
      amount_paise: amountPaise,
      platform_fee: feePaise / 100,
      platform_fee_paise: feePaise,
      net_payout: netPaise / 100,
      net_payout_paise: netPaise,
      fee_bps: feeBps,
      fee_percent: feeBps / 100,
      transfer_amount: w.transfer_amount_paise != null ? Number(w.transfer_amount_paise) / 100 : null,
      transfer_slip_url: slipUrl,
      creator_name: accounts[w.creator_id]?.name || '',
      creator_email: accounts[w.creator_id]?.email || '',
      creator_username: profiles[w.creator_id]?.username || '',
      creator_avatar_url: profiles[w.creator_id]?.avatar_url || '',
      bank: payout ? {
        account_holder: payout.account_holder || w.account_holder,
        account_number_masked: maskAccountNumber(String(payout.account_number || '')),
        account_number_last4: String(payout.account_number || w.account_number_last4 || '').slice(-4),
        ifsc: payout.ifsc || w.ifsc,
        upi_id: payout.upi_id || w.upi_id || '',
      } : {
        account_holder: w.account_holder,
        account_number_masked: `••••${w.account_number_last4}`,
        account_number_last4: w.account_number_last4,
        ifsc: w.ifsc,
        upi_id: w.upi_id || '',
      },
    }
  }))

  return jsonResponse({ withdrawals }, 200, {}, [], origin)
}

const handleAdminPayments = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/post_purchases?status=eq.paid&select=id,amount,amount_paise,currency,paid_at,verified_at,razorpay_order_id,razorpay_payment_id,post_id,user_id,creator_id,created_at&order=paid_at.desc&limit=300`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load payments' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const list = Array.isArray(rows) ? rows : []
  const postIds = [...new Set(list.map((r) => r.post_id).filter(Boolean))]
  const userIds = [...new Set(list.flatMap((r) => [r.user_id, r.creator_id]).filter(Boolean))]
  const posts: Record<string, { public_id: string; caption: string }> = {}
  const profiles: Record<string, string> = {}
  const accounts: Record<string, string> = {}
  if (postIds.length) {
    const postsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=in.(${postIds.join(',')})&select=id,public_id,caption`,
      { headers: { ...authHeaders(true) } },
    )
    for (const p of postsRes.ok ? await postsRes.json().catch(() => []) : []) {
      posts[p.id] = { public_id: p.public_id, caption: p.caption || '' }
    }
  }
  if (userIds.length) {
    const [profileRes, accountRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${userIds.join(',')})&select=id,username`,
        { headers: { ...authHeaders(true) } },
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/user_accounts?id=in.(${userIds.join(',')})&select=id,name,email`,
        { headers: { ...authHeaders(true) } },
      ),
    ])
    for (const p of profileRes.ok ? await profileRes.json().catch(() => []) : []) {
      profiles[p.id] = p.username || ''
    }
    for (const a of accountRes.ok ? await accountRes.json().catch(() => []) : []) {
      accounts[a.id] = a.name || a.email || ''
    }
  }

  const exRes = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?status=eq.paid&select=id,amount_paise,paid_at,razorpay_order_id,razorpay_payment_id,room_id,user_id,creator_id&order=paid_at.desc&limit=300`,
    { headers: { ...authHeaders(true) } },
  )
  const exList = exRes.ok ? await exRes.json().catch(() => []) : []
  const exclusiveList = Array.isArray(exList) ? exList : []
  const roomIdsAdmin = [...new Set(exclusiveList.map((r) => r.room_id).filter(Boolean))]
  const roomsAdmin: Record<string, string> = {}
  const moreUserIds = [...new Set(exclusiveList.flatMap((r) => [r.user_id, r.creator_id]).filter(Boolean))]
  if (roomIdsAdmin.length) {
    const roomsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_rooms?id=in.(${roomIdsAdmin.join(',')})&select=id,name`,
      { headers: { ...authHeaders(true) } },
    )
    for (const r of roomsRes.ok ? await roomsRes.json().catch(() => []) : []) {
      roomsAdmin[r.id] = r.name || 'Exclusive'
    }
  }
  const missingUsers = moreUserIds.filter((id) => !profiles[id] && !accounts[id])
  if (missingUsers.length) {
    const [profileRes2, accountRes2] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${missingUsers.join(',')})&select=id,username`,
        { headers: { ...authHeaders(true) } },
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/user_accounts?id=in.(${missingUsers.join(',')})&select=id,name,email`,
        { headers: { ...authHeaders(true) } },
      ),
    ])
    for (const p of profileRes2.ok ? await profileRes2.json().catch(() => []) : []) {
      profiles[p.id] = p.username || ''
    }
    for (const a of accountRes2.ok ? await accountRes2.json().catch(() => []) : []) {
      accounts[a.id] = a.name || a.email || ''
    }
  }

  const postPayments = list.map((r) => {
    const paise = Number(r.amount_paise || Math.round(Number(r.amount || 0) * 100))
    const paidAt = r.paid_at ? new Date(String(r.paid_at)).getTime() : 0
    return {
      id: r.id,
      kind: 'post',
      amount: paise / 100,
      amount_paise: paise,
      currency: r.currency || 'INR',
      paid_at: r.paid_at,
      withdrawable: paidAt > 0 && Date.now() >= paidAt + 24 * 60 * 60 * 1000,
      unlocks_at: paidAt ? new Date(paidAt + 24 * 60 * 60 * 1000).toISOString() : null,
      razorpay_order_id: r.razorpay_order_id || '',
      razorpay_payment_id: r.razorpay_payment_id || '',
      post_public_id: posts[r.post_id]?.public_id || '',
      post_caption: posts[r.post_id]?.caption || '',
      buyer_name: accounts[r.user_id] || profiles[r.user_id] || '',
      creator_username: profiles[r.creator_id] || '',
      creator_id: r.creator_id,
    }
  })
  const exclusivePayments = exclusiveList.map((r) => {
    const paise = Number(r.amount_paise || 0)
    const paidAt = r.paid_at ? new Date(String(r.paid_at)).getTime() : 0
    return {
      id: r.id,
      kind: 'exclusive',
      amount: paise / 100,
      amount_paise: paise,
      currency: 'INR',
      paid_at: r.paid_at,
      withdrawable: paidAt > 0 && Date.now() >= paidAt + 24 * 60 * 60 * 1000,
      unlocks_at: paidAt ? new Date(paidAt + 24 * 60 * 60 * 1000).toISOString() : null,
      razorpay_order_id: r.razorpay_order_id || '',
      razorpay_payment_id: r.razorpay_payment_id || '',
      post_public_id: '',
      post_caption: `${roomsAdmin[r.room_id] || 'Exclusive'} · monthly entry`,
      buyer_name: accounts[r.user_id] || profiles[r.user_id] || '',
      creator_username: profiles[r.creator_id] || '',
      creator_id: r.creator_id,
    }
  })

  return jsonResponse({
    payments: [...postPayments, ...exclusivePayments]
      .sort((x, y) => new Date(String(y.paid_at || 0)).getTime() - new Date(String(x.paid_at || 0)).getTime())
      .slice(0, 300),
  }, 200, {}, [], origin)
}


const handleAdminSettlements = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!await requireAdmin(req)) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const creatorsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?role=eq.creator&select=id,name,email&order=created_at.desc&limit=200`,
    { headers: { ...authHeaders(true) } },
  )
  if (!creatorsRes.ok) return jsonResponse({ error: 'Failed to load creators' }, 500, {}, [], origin)
  const creators = await creatorsRes.json().catch(() => [])
  const list = Array.isArray(creators) ? creators : []
  if (!list.length) return jsonResponse({ settlements: [] }, 200, {}, [], origin)

  const ids = list.map((c) => c.id)
  const [profileRes, purchasesRes, wdRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,username,avatar_url,full_name`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/post_purchases?creator_id=in.(${ids.join(',')})&status=eq.paid&select=creator_id,amount,amount_paise`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/wallet_withdrawals?creator_id=in.(${ids.join(',')})&status=eq.paid&select=creator_id,amount_paise`,
      { headers: { ...authHeaders(true) } },
    ),
  ])
  const profiles: Record<string, { username: string; avatar_url: string; full_name: string }> = {}
  for (const p of profileRes.ok ? await profileRes.json().catch(() => []) : []) {
    profiles[p.id] = { username: p.username || '', avatar_url: p.avatar_url || '', full_name: p.full_name || '' }
  }
  const earnings: Record<string, number> = {}
  for (const row of purchasesRes.ok ? await purchasesRes.json().catch(() => []) : []) {
    const paise = Number(row.amount_paise || Math.round(Number(row.amount || 0) * 100))
    earnings[row.creator_id] = (earnings[row.creator_id] || 0) + paise
  }
  const settled: Record<string, number> = {}
  for (const row of wdRes.ok ? await wdRes.json().catch(() => []) : []) {
    settled[row.creator_id] = (settled[row.creator_id] || 0) + Number(row.amount_paise || 0)
  }

  return jsonResponse({
    settlements: list.map((c) => {
      const total = earnings[c.id] || 0
      const paid = settled[c.id] || 0
      return {
        creator_id: c.id,
        name: c.name || profiles[c.id]?.full_name || '',
        email: c.email || '',
        username: profiles[c.id]?.username || '',
        avatar_url: profiles[c.id]?.avatar_url || '',
        total_earnings: total / 100,
        total_settled: paid / 100,
        balance_to_settle: Math.max(0, total - paid) / 100,
      }
    }).sort((a, b) => b.balance_to_settle - a.balance_to_settle),
  }, 200, {}, [], origin)
}

const handleGetSupportTickets = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/support_tickets?user_id=eq.${user.id}&select=id,subject,message,status,admin_reply,created_at&order=created_at.desc&limit=50`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load support tokens' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  return jsonResponse({ tickets: Array.isArray(rows) ? rows : [] }, 200, {}, [], origin)
}

const handleCreateSupportTicket = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (subject.length < 3 || subject.length > 120) {
    return jsonResponse({ error: 'Subject must be 3-120 characters' }, 400, {}, [], origin)
  }
  if (message.length < 10 || message.length > 1000) {
    return jsonResponse({ error: 'Message must be 10-1000 characters' }, 400, {}, [], origin)
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/support_tickets`, {
    method: 'POST',
    headers: {
      ...authHeaders(true),
      Prefer: 'return=representation',
    },
    body: JSON.stringify([{ user_id: user.id, subject, message }]),
  })

  if (!res.ok) {
    console.error('Support ticket create failed:', await res.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to create support token' }, 500, {}, [], origin)
  }
  const rows = await res.json().catch(() => [])
  return jsonResponse({ ticket: Array.isArray(rows) ? rows[0] : rows }, 200, {}, [], origin)
}

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || ''
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || ''

// Platform fee charged on top of every payment (post unlock, exclusive room
// subscription, live stream booking, live stream gift). NEVER trust the
// frontend — every breakdown is recomputed server-side from this constant.
//
// User-pays model:  user pays content_amount + 3% platform_fee = final_amount.
// Creator receives: content_amount (no further deduction at purchase time;
// withdrawal fees are handled separately in migration 022).
const PLATFORM_FEE_PERCENT = 3
const computePlatformFeeBreakdown = (contentAmountPaise: number) => {
  const safe = Number.isFinite(contentAmountPaise) && contentAmountPaise > 0 ? Math.round(contentAmountPaise) : 0
  const feePaise = Math.round(safe * PLATFORM_FEE_PERCENT / 100)
  return {
    amount_paise: safe,                    // content amount (= creator revenue)
    platform_fee_percent: PLATFORM_FEE_PERCENT,
    platform_fee_paise: feePaise,          // 3% of content amount
    net_to_creator_paise: safe,            // creator gets the full content amount
    final_amount_paise: safe + feePaise,   // user pays this via Razorpay
  }
}

const REPORT_REASONS = [
  'Nudity or sexual content',
  'Harassment or bullying',
  'Spam or scam',
  'Violence or dangerous content',
  'Hate speech',
  'Intellectual property violation',
  'Impersonation',
  'Other',
]

const fetchPostByPublicId = async (publicId: string) => {
  if (!/^[A-Za-z0-9]{12}$/.test(publicId)) return null
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?public_id=eq.${encodeURIComponent(publicId)}&select=id,creator_id,public_id,caption,media_type,media_paths,is_paid,price,like_count,view_count,created_at&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

// Fire-and-forget notification insert. Never notifies the actor about their
// own action; duplicate "like" notifications are ignored via the unique index.
const createNotification = async (n: {
  user_id: string
  actor_id: string
  type: 'like' | 'purchase' | 'request' | 'accept' | 'follow'
  post_id?: string
  post_public_id?: string
  conversation_id?: string
}) => {
  if (!n.user_id || !n.actor_id || n.user_id === n.actor_id) return
  await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify([n]),
  }).catch(() => {})
}

const handleGetNotifications = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=100`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load notifications' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const list = Array.isArray(rows) ? rows : []

  // Resolve creator profiles, consumer account names, and post captions.
  const actorIds = [...new Set(list.map((n) => n.actor_id).filter(Boolean))]
  const postIds = [...new Set(list.map((n) => n.post_id).filter(Boolean))]

  const [actorsRes, actorAccountsRes, postsRes] = await Promise.all([
    actorIds.length
      ? fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=in.(${actorIds.join(',')})&select=id,username,full_name,avatar_url`,
          { headers: { ...authHeaders(true) } },
        )
      : null,
    actorIds.length
      ? fetch(
          `${SUPABASE_URL}/rest/v1/user_accounts?id=in.(${actorIds.join(',')})&select=id,name`,
          { headers: { ...authHeaders(true) } },
        )
      : null,
    postIds.length
      ? fetch(
          `${SUPABASE_URL}/rest/v1/posts?id=in.(${postIds.join(',')})&select=id,caption`,
          { headers: { ...authHeaders(true) } },
        )
      : null,
  ])

  const actors: Record<string, Record<string, unknown>> = {}
  if (actorsRes?.ok) {
    for (const p of await actorsRes.json().catch(() => [])) actors[p.id] = p
  }
  if (actorAccountsRes?.ok) {
    for (const account of await actorAccountsRes.json().catch(() => [])) {
      if (!actors[account.id]) {
        actors[account.id] = {
          id: account.id,
          username: account.name || 'MalluCupid user',
          full_name: account.name || 'MalluCupid user',
          avatar_url: '',
        }
      }
    }
  }
  const captions: Record<string, string> = {}
  if (postsRes?.ok) {
    for (const p of await postsRes.json().catch(() => [])) captions[p.id] = p.caption || ''
  }

  const notifications = list.map((n) => {
    const actor = actors[n.actor_id] || {}
    return {
      id: n.id,
      type: n.type,
      read: n.read,
      created_at: n.created_at,
      actor: {
        username: actor.username || '',
        full_name: actor.full_name || '',
        avatar_url: actor.avatar_url || '',
      },
      post_public_id: n.post_public_id || null,
      post_caption: n.post_id ? captions[n.post_id] || null : null,
      conversation_id: n.conversation_id || null,
    }
  })

  const unreadCount = list.filter((n) => !n.read).length
  return jsonResponse({ notifications, unread_count: unreadCount }, 200, {}, [], origin)
}

const handleMarkNotificationsRead = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ read: true }),
  })
  if (!res.ok) return jsonResponse({ error: 'Failed to update notifications' }, 500, {}, [], origin)
  return jsonResponse({ status: 'read' }, 200, {}, [], origin)
}

const fetchProfileBrief = async (userId: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,username,full_name,avatar_url&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  if (Array.isArray(rows) && rows.length) return rows[0]

  const accountRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${userId}&select=id,name&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const accounts = accountRes.ok ? await accountRes.json().catch(() => []) : []
  const account = Array.isArray(accounts) && accounts.length ? accounts[0] : null
  if (!account) return null
  return {
    id: account.id,
    username: account.name || 'MalluCupid user',
    full_name: account.name || 'MalluCupid user',
    avatar_url: '',
  }
}

const hasPaidForPost = async (postId: string, userId: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/post_purchases?post_id=eq.${postId}&user_id=eq.${userId}&status=eq.paid&select=id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return false
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length > 0
}

const handleSecureMedia = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const postPublicId = url.searchParams.get('post') || ''
  const messageId = url.searchParams.get('message') || ''
  const index = Math.max(0, Number(url.searchParams.get('i') || '0') || 0)
  let target = ''

  if (postPublicId) {
    const post = await fetchPostByPublicId(postPublicId)
    if (!post) return jsonResponse({ error: 'Not found' }, 404, {}, [], origin)
    if (post.creator_id !== user.id && !(await creatorHasVerifiedBadge(post.creator_id))) {
      return contentLockedResponse(origin)
    }
    const hasAccess = post.creator_id === user.id || post.is_paid !== true || await hasPaidForPost(post.id, user.id)
    if (!hasAccess) return jsonResponse({ error: 'Forbidden' }, 403, {}, [], origin)
    const paths = Array.isArray(post.media_paths) ? post.media_paths as string[] : []
    const path = paths[index]
    if (!path) return jsonResponse({ error: 'Not found' }, 404, {}, [], origin)
    const signed = await signMediaPaths([path], MEDIA_TTL_SECONDS)
    target = signed[path] || ''
  } else if (messageId && /^[0-9a-f-]{36}$/i.test(messageId)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${messageId}&select=*&limit=1`, {
      headers: { ...authHeaders(true) },
    })
    const rows = res.ok ? await res.json().catch(() => []) : []
    const msg = Array.isArray(rows) && rows.length ? rows[0] : null
    if (!msg?.media_path) return jsonResponse({ error: 'Not found' }, 404, {}, [], origin)
    if (msg.is_once) return jsonResponse({ error: 'Use view-once endpoint' }, 403, {}, [], origin)
    if (msg.deleted_for_all) return jsonResponse({ error: 'Not found' }, 404, {}, [], origin)
    const convo = await getConversationForUser(String(msg.conversation_id), user.id)
    if (!convo) return jsonResponse({ error: 'Forbidden' }, 403, {}, [], origin)
    target = await signChatPath(String(msg.media_path), MEDIA_TTL_SECONDS)
  } else {
    return jsonResponse({ error: 'Bad request' }, 400, {}, [], origin)
  }

  if (!target) return jsonResponse({ error: 'Unavailable' }, 500, {}, [], origin)

  // 302 after auth/access checks. Direct storage URLs are short-lived and never
  // issued without a prior membership/purchase verification on this endpoint.
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Referrer-Policy': 'no-referrer',
      ...getCorsHeaders(origin),
    },
  })
}

const handleGetPost = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const publicId = url.searchParams.get('id') || ''
  const post = await fetchPostByPublicId(publicId)
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)

  const isOwner = post.creator_id === user.id
  if (!isOwner && !(await creatorHasVerifiedBadge(post.creator_id))) {
    return contentLockedResponse(origin)
  }
  // Access is decided server-side only: owner, free post, or a recorded paid purchase.
  const hasAccess = isOwner || post.is_paid !== true || (await hasPaidForPost(post.id, user.id))

  const viewCountPromise = isOwner
    ? Promise.resolve(Number(post.view_count) || 0)
    : fetch(`${SUPABASE_URL}/rest/v1/rpc/record_post_view`, {
        method: 'POST',
        headers: { ...authHeaders(true) },
        body: JSON.stringify({ p_post_id: post.id, p_viewer_id: user.id }),
      }).then((res) => res.ok ? res.json() : Number(post.view_count) || 0).catch(() => Number(post.view_count) || 0)

  const [owner, likedRes, viewCount] = await Promise.all([
    fetchProfileBrief(post.creator_id),
    fetch(`${SUPABASE_URL}/rest/v1/post_likes?post_id=eq.${post.id}&user_id=eq.${user.id}&select=user_id&limit=1`, {
      headers: { ...authHeaders(true) },
    }),
    viewCountPromise,
  ])

  const likedRows = likedRes.ok ? await likedRes.json().catch(() => []) : []
  const likedByMe = Array.isArray(likedRows) && likedRows.length > 0

  const paths = Array.isArray(post.media_paths) ? post.media_paths as string[] : []
  // Short-lived signed URLs after server-side access check (no cross-origin cookie needed).
  const signed = hasAccess ? await signMediaPaths(paths) : {}
  const mediaUrls = hasAccess ? paths.map((path: string) => signed[path] || '').filter(Boolean) : []

  return jsonResponse({
    post: {
      public_id: post.public_id,
      caption: post.caption,
      media_type: post.media_type,
      media_urls: mediaUrls,
      media_count: paths.length,
      is_paid: post.is_paid,
      price: post.price,
      created_at: post.created_at,
      is_owner: isOwner,
      has_access: hasAccess,
      like_count: Number(post.like_count) || 0,
      view_count: Number(viewCount) || 0,
      liked_by_me: likedByMe,
      owner: owner
        ? { username: owner.username, full_name: owner.full_name, avatar_url: owner.avatar_url }
        : null,
    },
  }, 200, {}, [], origin)
}

const handleTogglePostLike = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const post = await fetchPostByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)
  if (post.creator_id !== user.id && !(await creatorHasVerifiedBadge(post.creator_id))) {
    return contentLockedResponse(origin)
  }

  const hasAccess = post.creator_id === user.id || post.is_paid !== true || await hasPaidForPost(post.id, user.id)
  if (!hasAccess) return jsonResponse({ error: 'Unlock this post before liking it' }, 403, {}, [], origin)

  const toggleRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/toggle_post_like`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ p_post_id: post.id, p_user_id: user.id }),
  })
  if (!toggleRes.ok) {
    console.error('Post like toggle failed:', await toggleRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to update like' }, 500, {}, [], origin)
  }
  const toggleRows = await toggleRes.json().catch(() => [])
  const result = Array.isArray(toggleRows) ? toggleRows[0] : null
  const liked = result?.liked === true

  if (liked) {
    await createNotification({
      user_id: post.creator_id,
      actor_id: user.id,
      type: 'like',
      post_id: post.id,
      post_public_id: post.public_id,
    })
  } else {
    await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${post.creator_id}&actor_id=eq.${user.id}&post_id=eq.${post.id}&type=eq.like`,
      { method: 'DELETE', headers: { ...authHeaders(true) } },
    ).catch(() => {})
  }

  return jsonResponse({ liked, like_count: Number(result?.total) || 0 }, 200, {}, [], origin)
}

const handleUpdatePost = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)

  const body = await parseJson(req)
  const post = await fetchPostByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)
  if (post.creator_id !== user.id) return jsonResponse({ error: 'You can only edit your own posts' }, 403, {}, [], origin)

  const caption = typeof body.caption === 'string' ? body.caption.trim() : ''
  const isPaid = body.is_paid === true
  const price = isPaid ? Number(body.price) : 0

  if (caption.length > 200) return jsonResponse({ error: 'Caption must be 200 characters or fewer' }, 400, {}, [], origin)
  if (isPaid && (!Number.isFinite(price) || price < 10)) {
    return jsonResponse({ error: 'Minimum price is ₹10 for paid posts' }, 400, {}, [], origin)
  }

  // Update in place; the existing post id / public_id never changes.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify({ caption, is_paid: isPaid, price: isPaid ? price : 0 }),
  })

  if (!res.ok) {
    console.error('Post update failed:', await res.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to update post' }, 500, {}, [], origin)
  }

  const rows = await res.json().catch(() => [])
  const decorated = await decoratePosts(Array.isArray(rows) ? rows : [])
  return jsonResponse({ status: 'post_updated', post: decorated[0] || null }, 200, {}, [], origin)
}

const handleDeletePost = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const post = await fetchPostByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)
  if (post.creator_id !== user.id) return jsonResponse({ error: 'You can only delete your own posts' }, 403, {}, [], origin)

  const paths = Array.isArray(post.media_paths) ? post.media_paths as string[] : []
  if (paths.length) {
    const removeRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${POST_MEDIA_BUCKET}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({ prefixes: paths }),
    })
    if (!removeRes.ok) console.error('Failed to remove post media:', await removeRes.text().catch(() => ''))
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post.id}`, {
    method: 'DELETE',
    headers: { ...authHeaders(true) },
  })

  if (!res.ok) {
    console.error('Post delete failed:', await res.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to delete post' }, 500, {}, [], origin)
  }

  return jsonResponse({ status: 'post_deleted' }, 200, {}, [], origin)
}

const handleReportPost = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const post = await fetchPostByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)
  if (post.creator_id === user.id) return jsonResponse({ error: 'You cannot report your own post' }, 400, {}, [], origin)

  const reason = typeof body.reason === 'string' ? body.reason : ''
  const details = typeof body.details === 'string' ? body.details.trim() : ''
  if (!REPORT_REASONS.includes(reason)) return jsonResponse({ error: 'Select a valid reason' }, 400, {}, [], origin)
  if (details.length > 750) return jsonResponse({ error: 'Additional details must be 750 characters or fewer' }, 400, {}, [], origin)

  const [reporter, owner] = await Promise.all([
    fetchProfileBrief(user.id),
    fetchProfileBrief(post.creator_id),
  ])

  const res = await fetch(`${SUPABASE_URL}/rest/v1/post_reports`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify([{
      post_id: post.id,
      post_public_id: post.public_id,
      owner_id: post.creator_id,
      owner_username: owner?.username || '',
      reporter_id: user.id,
      reporter_username: reporter?.username || '',
      reason,
      details,
    }]),
  })

  if (!res.ok) {
    console.error('Post report failed:', await res.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to submit report' }, 500, {}, [], origin)
  }

  return jsonResponse({ status: 'report_submitted' }, 200, {}, [], origin)
}

const handlePostCheckout = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const post = await fetchPostByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)
  if (post.creator_id !== user.id && !(await creatorHasVerifiedBadge(post.creator_id))) {
    return contentLockedResponse(origin)
  }
  if (post.creator_id === user.id) return jsonResponse({ already_unlocked: true }, 200, {}, [], origin)
  if (post.is_paid !== true) return jsonResponse({ already_unlocked: true }, 200, {}, [], origin)
  if (await hasPaidForPost(post.id, user.id)) return jsonResponse({ already_unlocked: true }, 200, {}, [], origin)

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: 'Payments are not configured yet. Please try again later.' }, 503, {}, [], origin)
  }

  // ── Server-side breakdown (NEVER trust the frontend) ────────────────────
  // content_amount = post.price; user pays content_amount + 3% platform fee.
  const contentPaise = Math.round(Number(post.price) * 100)
  if (!Number.isFinite(contentPaise) || contentPaise < 100) {
    return jsonResponse({ error: 'Invalid post price' }, 500, {}, [], origin)
  }
  const breakdown = computePlatformFeeBreakdown(contentPaise)
  const orderAmountPaise = breakdown.final_amount_paise

  // Reconcile/reuse an existing pending order. This prevents creating a new
  // charge request when the previous payment was captured but its browser
  // callback was lost.
  const pendingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/post_purchases?post_id=eq.${post.id}&user_id=eq.${user.id}&select=id,status,amount,amount_paise,creator_id,razorpay_order_id,razorpay_payment_id,final_amount_paise,platform_fee_paise,net_to_creator_paise&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const pendingRows = pendingRes.ok ? await pendingRes.json().catch(() => []) : []
  const pending = Array.isArray(pendingRows) && pendingRows.length ? pendingRows[0] : null
  if (pending?.status === 'created' && pending.razorpay_order_id) {
    const payments = await razorpayGet(`/orders/${encodeURIComponent(pending.razorpay_order_id)}/payments`)
    const items = Array.isArray(payments?.items) ? payments.items : []
    const captured = items.find((payment: Record<string, unknown>) =>
      payment.status === 'captured'
        && paymentMatchesPurchase(payment, pending, pending.razorpay_order_id),
    )
    if (captured?.id && await recordPaidPurchase(pending, post, user.id, captured.id)) {
      return jsonResponse({ already_unlocked: true }, 200, {}, [], origin)
    }
    const existingOrder = await razorpayGet(`/orders/${encodeURIComponent(pending.razorpay_order_id)}`)
    if (
      existingOrder?.id
      && existingOrder.status !== 'paid'
      && Number(existingOrder.amount) === orderAmountPaise
      && existingOrder.currency === 'INR'
    ) {
      return jsonResponse({
        key_id: RAZORPAY_KEY_ID,
        order_id: existingOrder.id,
        amount: orderAmountPaise,
        currency: 'INR',
        post_public_id: post.public_id,
        content_name: String(post.caption || '').slice(0, 120),
        content_type: 'paid',
        content_amount_paise: breakdown.amount_paise,
        platform_fee_percent: PLATFORM_FEE_PERCENT,
        platform_fee_paise: breakdown.platform_fee_paise,
        final_amount_paise: breakdown.final_amount_paise,
      }, 200, {}, [], origin)
    }
  }

  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
    },
    body: JSON.stringify({
      amount: orderAmountPaise,
      currency: 'INR',
      receipt: `${post.public_id}-${user.id.slice(0, 8)}`,
      notes: { post_public_id: post.public_id, buyer_id: user.id, content_amount_paise: String(contentPaise), platform_fee_paise: String(breakdown.platform_fee_paise) },
    }),
  })

  if (!orderRes.ok) {
    console.error('Razorpay order failed:', await orderRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to start payment. Please try again.' }, 502, {}, [], origin)
  }

  const order = await orderRes.json().catch(() => ({}))
  if (!order?.id) return jsonResponse({ error: 'Failed to start payment. Please try again.' }, 502, {}, [], origin)

  // One row per (post, user); re-initiating checkout refreshes the pending order id
  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/post_purchases?on_conflict=post_id,user_id`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{
      post_id: post.id,
      creator_id: post.creator_id,
      user_id: user.id,
      amount: post.price,
      amount_paise: contentPaise,
      currency: 'INR',
      provider: 'razorpay',
      razorpay_order_id: order.id,
      razorpay_payment_id: '',
      status: 'created',
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      platform_fee_paise: breakdown.platform_fee_paise,
      net_to_creator_paise: breakdown.net_to_creator_paise,
      final_amount_paise: breakdown.final_amount_paise,
    }]),
  })

  if (!upsertRes.ok) {
    console.error('Purchase record failed:', await upsertRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to start payment. Please try again.' }, 500, {}, [], origin)
  }

  return jsonResponse({
    key_id: RAZORPAY_KEY_ID,
    order_id: order.id,
    amount: orderAmountPaise,
    currency: 'INR',
    post_public_id: post.public_id,
    content_name: String(post.caption || '').slice(0, 120),
    content_type: 'paid',
    content_amount_paise: breakdown.amount_paise,
    platform_fee_percent: PLATFORM_FEE_PERCENT,
    platform_fee_paise: breakdown.platform_fee_paise,
    final_amount_paise: breakdown.final_amount_paise,
  }, 200, {}, [], origin)
}

const hmacSha256Hex = async (secret: string, message: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const razorpayGet = async (path: string) => {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    headers: { Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}` },
  })
  if (!res.ok) {
    console.error(`Razorpay lookup failed (${path}):`, await res.text().catch(() => ''))
    return null
  }
  return res.json().catch(() => null)
}

const recordPaidPurchase = async (
  purchase: Record<string, unknown>,
  post: Record<string, unknown>,
  userId: string,
  paymentId: string,
) => {
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/post_purchases?id=eq.${purchase.id}&status=eq.created`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
    }),
  })
  if (!updateRes.ok) return false
  const updated = await updateRes.json().catch(() => [])
  // Another verification request may have won the race. It has already
  // recorded access and sent the notification, so this call is also success.
  if (!Array.isArray(updated) || !updated.length) {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/post_purchases?id=eq.${purchase.id}&status=eq.paid&select=id&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const rows = checkRes.ok ? await checkRes.json().catch(() => []) : []
    return Array.isArray(rows) && rows.length > 0
  }
  await createNotification({
    user_id: post.creator_id as string,
    actor_id: userId,
    type: 'purchase',
    post_id: post.id as string,
    post_public_id: post.public_id as string,
  })
  notifyCreatorByEmail({
    creatorId: post.creator_id as string,
    actorId: userId,
    kind: 'purchase',
    amount: Number(purchase.amount) || undefined,
    currency: typeof purchase.currency === 'string' ? purchase.currency : 'INR',
    postPublicId: String(post.public_id || ''),
  }).catch(() => {})
  return true
}

const paymentMatchesPurchase = (
  payment: Record<string, unknown>,
  purchase: Record<string, unknown>,
  orderId: string,
) => {
  // The user pays content_amount + 3% platform fee = final_amount_paise.
  // Razorpay's payment.amount must match this final amount.
  const expectedPaise = Number(
    purchase.final_amount_paise
    || purchase.amount_paise
    || Math.round(Number(purchase.amount) * 100),
  )
  return payment.order_id === orderId
    && payment.currency === 'INR'
    && Number(payment.amount) === expectedPaise
}

const paymentMatchesExclusiveSub = (
  payment: Record<string, unknown>,
  sub: Record<string, unknown>,
  orderId: string,
) => {
  const expectedPaise = Number(sub.final_amount_paise || sub.amount_paise || 0)
  return payment.order_id === orderId
    && payment.currency === 'INR'
    && Number(payment.amount) === expectedPaise
    && Number.isFinite(expectedPaise)
    && expectedPaise >= 1000
}

const handleVerifyPostPayment = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const post = await fetchPostByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)

  const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : ''
  const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : ''
  const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : ''
  if (!orderId || !paymentId || !signature) return jsonResponse({ error: 'Missing payment details' }, 400, {}, [], origin)
  if (!RAZORPAY_KEY_SECRET) return jsonResponse({ error: 'Payments are not configured yet' }, 503, {}, [], origin)

  // The pending purchase row must match this user, post, and order
  const purchaseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/post_purchases?post_id=eq.${post.id}&user_id=eq.${user.id}&razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=id,status,amount,amount_paise,creator_id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const purchaseRows = purchaseRes.ok ? await purchaseRes.json().catch(() => []) : []
  const purchase = Array.isArray(purchaseRows) && purchaseRows.length ? purchaseRows[0] : null
  if (!purchase) return jsonResponse({ error: 'No matching payment found' }, 404, {}, [], origin)
  if (purchase.status === 'paid') return jsonResponse({ status: 'paid' }, 200, {}, [], origin)

  const expected = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`)
  if (expected !== signature) return jsonResponse({ error: 'Payment verification failed' }, 400, {}, [], origin)

  // Signature alone proves the callback, not settlement. Verify the payment
  // against Razorpay's server API and the immutable DB amount/order snapshot.
  const payment = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`)
  if (!payment || !paymentMatchesPurchase(payment, purchase, orderId)) {
    return jsonResponse({ error: 'Payment details did not match this purchase' }, 400, {}, [], origin)
  }
  if (payment.status !== 'captured') {
    return jsonResponse({ status: 'processing' }, 202, {}, [], origin)
  }
  if (!await recordPaidPurchase(purchase, post, user.id, paymentId)) {
    return jsonResponse({ error: 'Payment was captured but access recording is pending' }, 503, {}, [], origin)
  }

  return jsonResponse({ status: 'paid' }, 200, {}, [], origin)
}

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || ''

/** Server-to-server capture confirmation when the browser callback is lost. */
const handleRazorpayWebhook = async (req: Request) => {
  const origin = req.headers.get('origin')
  if (!RAZORPAY_WEBHOOK_SECRET) {
    return jsonResponse({ error: 'Webhook not configured' }, 503, {}, [], origin)
  }
  const raw = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''
  const expected = await hmacSha256Hex(RAZORPAY_WEBHOOK_SECRET, raw)
  if (!signature || expected !== signature) {
    return jsonResponse({ error: 'Invalid signature' }, 400, {}, [], origin)
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw)
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, {}, [], origin)
  }

  const event = String(payload.event || '')
  if (event !== 'payment.captured' && event !== 'order.paid') {
    return jsonResponse({ status: 'ignored', event }, 200, {}, [], origin)
  }

  const paymentEntity = (payload.payload as Record<string, unknown>)?.payment as Record<string, unknown> | undefined
  let payment = (paymentEntity?.entity || paymentEntity) as Record<string, unknown> | undefined
  const orderEntity = (payload.payload as Record<string, unknown>)?.order as Record<string, unknown> | undefined
  const order = (orderEntity?.entity || orderEntity) as Record<string, unknown> | undefined

  let paymentId = String(payment?.id || '')
  const orderId = String(payment?.order_id || order?.id || '')
  if (!orderId) {
    return jsonResponse({ status: 'ignored', reason: 'missing order' }, 200, {}, [], origin)
  }
  if (!paymentId) {
    const payments = await razorpayGet(`/orders/${encodeURIComponent(orderId)}/payments`)
    const items = Array.isArray(payments?.items) ? payments.items : []
    const captured = items.find((p: Record<string, unknown>) => p.status === 'captured')
    if (captured?.id) {
      payment = captured
      paymentId = String(captured.id)
    }
  }
  if (!paymentId) {
    return jsonResponse({ status: 'ignored', reason: 'missing payment' }, 200, {}, [], origin)
  }

  const purchaseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/post_purchases?razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=id,status,amount,amount_paise,creator_id,user_id,post_id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const purchaseRows = purchaseRes.ok ? await purchaseRes.json().catch(() => []) : []
  const purchase = Array.isArray(purchaseRows) && purchaseRows.length ? purchaseRows[0] : null
  if (!purchase) {
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const subRows = subRes.ok ? await subRes.json().catch(() => []) : []
    const sub = Array.isArray(subRows) && subRows.length ? subRows[0] : null
    if (!sub) {
      // Try live_stream_bookings
      const bookRes = await fetch(
        `${SUPABASE_URL}/rest/v1/live_stream_bookings?razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
        { headers: { ...authHeaders(true) } },
      )
      const bookRows = bookRes.ok ? await bookRes.json().catch(() => []) : []
      const book = Array.isArray(bookRows) && bookRows.length ? bookRows[0] : null
      if (book) {
        if (book.status === 'paid') return jsonResponse({ status: 'already_paid' }, 200, {}, [], origin)
        if (book.status !== 'created') return jsonResponse({ status: 'ignored', reason: 'booking not pending' }, 200, {}, [], origin)
        let livePayment = payment
        const expectedPaise = Number(book.final_amount_paise || book.amount_paise || 0)
        if (!livePayment || Number(livePayment.amount) !== expectedPaise || livePayment.status !== 'captured') {
          livePayment = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`) || undefined
        }
        if (!livePayment || Number(livePayment.amount) !== expectedPaise || livePayment.status !== 'captured') {
          return jsonResponse({ status: 'ignored', reason: 'booking payment mismatch' }, 200, {}, [], origin)
        }
        const upd = await fetch(`${SUPABASE_URL}/rest/v1/live_stream_bookings?id=eq.${book.id}&status=eq.created`, {
          method: 'PATCH',
          headers: { ...authHeaders(true), Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'paid',
            razorpay_payment_id: paymentId,
            paid_at: new Date().toISOString(),
            verified_at: new Date().toISOString(),
          }),
        })
        if (upd.ok) {
          await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${book.stream_id}`, {
            method: 'PATCH',
            headers: { ...authHeaders(true), Prefer: 'return=minimal' },
            body: JSON.stringify({ total_earnings_paise: Number(book.total_earnings_paise || 0) + expectedPaise }),
          }).catch(() => {})
        }
        return jsonResponse({ status: upd.ok ? 'paid' : 'pending' }, upd.ok ? 200 : 503, {}, [], origin)
      }

      // Try live_stream_gifts
      const giftRes = await fetch(
        `${SUPABASE_URL}/rest/v1/live_stream_gifts?razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
        { headers: { ...authHeaders(true) } },
      )
      const giftRows = giftRes.ok ? await giftRes.json().catch(() => []) : []
      const gift = Array.isArray(giftRows) && giftRows.length ? giftRows[0] : null
      if (gift) {
        if (gift.status === 'paid') return jsonResponse({ status: 'already_paid' }, 200, {}, [], origin)
        if (gift.status !== 'created') return jsonResponse({ status: 'ignored', reason: 'gift not pending' }, 200, {}, [], origin)
        let livePayment = payment
        const expectedPaise = Number(gift.final_amount_paise || gift.amount_paise || 0)
        if (!livePayment || Number(livePayment.amount) !== expectedPaise || livePayment.status !== 'captured') {
          livePayment = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`) || undefined
        }
        if (!livePayment || Number(livePayment.amount) !== expectedPaise || livePayment.status !== 'captured') {
          return jsonResponse({ status: 'ignored', reason: 'gift payment mismatch' }, 200, {}, [], origin)
        }
        const upd = await fetch(`${SUPABASE_URL}/rest/v1/live_stream_gifts?id=eq.${gift.id}&status=eq.created`, {
          method: 'PATCH',
          headers: { ...authHeaders(true), Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'paid',
            razorpay_payment_id: paymentId,
            paid_at: new Date().toISOString(),
            verified_at: new Date().toISOString(),
          }),
        })
        if (upd.ok) {
          const s = await fetchStreamById(String(gift.stream_id))
          if (s) {
            await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${s.id}`, {
              method: 'PATCH',
              headers: { ...authHeaders(true), Prefer: 'return=minimal' },
              body: JSON.stringify({ total_earnings_paise: Number(s.total_earnings_paise || 0) + expectedPaise }),
            }).catch(() => {})
          }
        }
        return jsonResponse({ status: upd.ok ? 'paid' : 'pending' }, upd.ok ? 200 : 503, {}, [], origin)
      }

      return jsonResponse({ status: 'ignored', reason: 'unknown order' }, 200, {}, [], origin)
    }
    if (sub.status === 'paid') return jsonResponse({ status: 'already_paid' }, 200, {}, [], origin)
    if (sub.status !== 'created') return jsonResponse({ status: 'ignored', reason: 'sub not pending' }, 200, {}, [], origin)

    let livePayment = payment
    if (!livePayment || !paymentMatchesExclusiveSub(livePayment, sub, orderId) || livePayment.status !== 'captured') {
      livePayment = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`) || undefined
    }
    if (!livePayment || !paymentMatchesExclusiveSub(livePayment, sub, orderId) || livePayment.status !== 'captured') {
      return jsonResponse({ status: 'ignored', reason: 'exclusive payment mismatch' }, 200, {}, [], origin)
    }
    const recorded = await recordExclusiveSubscriptionPaid(sub, paymentId)
    return jsonResponse({ status: recorded.ok ? 'paid' : 'pending' }, recorded.ok ? 200 : 503, {}, [], origin)
  }
  if (purchase.status === 'paid') return jsonResponse({ status: 'already_paid' }, 200, {}, [], origin)

  if (payment && !paymentMatchesPurchase(payment, purchase, orderId)) {
    // order.paid may lack a full payment entity — fetch from Razorpay API.
    const live = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`)
    if (!live || !paymentMatchesPurchase(live, purchase, orderId) || live.status !== 'captured') {
      return jsonResponse({ status: 'ignored', reason: 'payment mismatch' }, 200, {}, [], origin)
    }
  } else if (payment && payment.status && payment.status !== 'captured') {
    return jsonResponse({ status: 'ignored', reason: 'not captured' }, 200, {}, [], origin)
  }

  const postRes = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?id=eq.${purchase.post_id}&select=id,creator_id,public_id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const postRows = postRes.ok ? await postRes.json().catch(() => []) : []
  const post = Array.isArray(postRows) && postRows.length ? postRows[0] : null
  if (!post) return jsonResponse({ status: 'ignored', reason: 'post missing' }, 200, {}, [], origin)

  const recorded = await recordPaidPurchase(purchase, post, String(purchase.user_id), paymentId)
  return jsonResponse({ status: recorded ? 'paid' : 'pending' }, recorded ? 200 : 503, {}, [], origin)
}

const handlePostPaymentStatus = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const post = await fetchPostByPublicId(url.searchParams.get('public_id') || '')
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)
  if (post.creator_id === user.id || post.is_paid !== true) {
    return jsonResponse({ status: 'paid', has_access: true }, 200, {}, [], origin)
  }

  const orderFilter = url.searchParams.get('order_id')
  const orderClause = orderFilter ? `&razorpay_order_id=eq.${encodeURIComponent(orderFilter)}` : ''
  const purchaseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/post_purchases?post_id=eq.${post.id}&user_id=eq.${user.id}${orderClause}&select=id,status,amount,amount_paise,creator_id,razorpay_order_id,razorpay_payment_id&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = purchaseRes.ok ? await purchaseRes.json().catch(() => []) : []
  const purchase = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!purchase) return jsonResponse({ status: 'unpaid', has_access: false }, 200, {}, [], origin)
  if (purchase.status === 'paid') return jsonResponse({ status: 'paid', has_access: true }, 200, {}, [], origin)
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ status: 'processing', has_access: false }, 200, {}, [], origin)
  }

  // Recovery path if the browser callback was lost after money was debited.
  const payments = await razorpayGet(`/orders/${encodeURIComponent(purchase.razorpay_order_id)}/payments`)
  const items = Array.isArray(payments?.items) ? payments.items : []
  const captured = items.find((payment: Record<string, unknown>) =>
    payment.status === 'captured'
      && paymentMatchesPurchase(payment, purchase, purchase.razorpay_order_id),
  )
  if (captured?.id) {
    const recorded = await recordPaidPurchase(purchase, post, user.id, captured.id)
    if (recorded) return jsonResponse({ status: 'paid', has_access: true }, 200, {}, [], origin)
    return jsonResponse({ status: 'processing', has_access: false }, 202, {}, [], origin)
  }
  const active = items.some((payment: Record<string, unknown>) =>
    ['authorized', 'created'].includes(String(payment.status))
      && paymentMatchesPurchase(payment, purchase, purchase.razorpay_order_id),
  )
  return jsonResponse({
    status: active ? 'processing' : 'unpaid',
    has_access: false,
  }, 200, {}, [], origin)
}

// ---------------------------------------------------------------------------
// Live Streams (schedule / start / end / book / gift / chat / presence)
// ---------------------------------------------------------------------------

const LIVE_STREAM_DURATIONS = [15, 30, 45, 60] as const
const generateStreamPublicId = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const random = new Uint8Array(10)
  crypto.getRandomValues(random)
  return 'ls_' + Array.from(random, (byte) => alphabet[byte % alphabet.length]).join('')
}
const generateJoinToken = () => {
  const random = new Uint8Array(24)
  crypto.getRandomValues(random)
  return Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('')
}

const fetchStreamByPublicId = async (publicId: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/live_streams?public_id=eq.${encodeURIComponent(publicId)}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

const fetchStreamById = async (id: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/live_streams?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

const getProfileUsernameById = async (userId: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=username,avatar_url,full_name&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

const decorateStream = async (stream: Record<string, unknown>, viewerId?: string) => {
  const creator = await getProfileUsernameById(String(stream.creator_id || ''))
  let hasBooking = false
  if (viewerId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/live_stream_bookings?stream_id=eq.${stream.id}&user_id=eq.${viewerId}&status=eq.paid&select=id&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    if (r.ok) {
      const rows = await r.json().catch(() => [])
      hasBooking = Array.isArray(rows) && rows.length > 0
    }
  }
  return {
    id: stream.id,
    public_id: stream.public_id,
    creator_id: stream.creator_id,
    creator_username: creator?.username || '',
    creator_avatar_url: creator?.avatar_url || null,
    creator_full_name: creator?.full_name || null,
    title: stream.title,
    scheduled_start: stream.scheduled_start,
    duration_minutes: stream.duration_minutes,
    is_paid: stream.is_paid === true,
    entry_fee_paise: Number(stream.entry_fee_paise || 0),
    status: stream.status,
    join_token: stream.join_token,
    started_at: stream.started_at,
    ended_at: stream.ended_at,
    active_viewers: Number(stream.active_viewers || 0),
    peak_viewers: Number(stream.peak_viewers || 0),
    total_earnings_paise: Number(stream.total_earnings_paise || 0),
    comments_enabled: stream.comments_enabled !== false,
    created_at: stream.created_at,
    has_booked: hasBooking,
  }
}

const handleLiveStreamCreate = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)

  const body = await parseJson(req)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title || title.length > 120) return jsonResponse({ error: 'Title must be 1–120 chars' }, 400, {}, [], origin)

  const startRaw = typeof body.scheduled_start === 'string' ? body.scheduled_start : ''
  const startDate = new Date(startRaw)
  if (!startDate.getTime() || startDate.getTime() < Date.now() - 60_000) {
    return jsonResponse({ error: 'Select a valid future start time' }, 400, {}, [], origin)
  }

  const durationMinutes = Number(body.duration_minutes)
  if (!LIVE_STREAM_DURATIONS.includes(durationMinutes as 15 | 30 | 45 | 60)) {
    return jsonResponse({ error: 'Duration must be 15, 30, 45 or 60 minutes' }, 400, {}, [], origin)
  }

  const isPaid = body.is_paid === true
  let entryFeePaise = 0
  if (isPaid) {
    const rupees = Number(body.entry_fee)
    if (!Number.isFinite(rupees) || rupees < 10) {
      return jsonResponse({ error: 'Paid streams need an entry fee of at least ₹10' }, 400, {}, [], origin)
    }
    entryFeePaise = Math.round(rupees * 100)
  }

  const publicId = generateStreamPublicId()
  const joinToken = generateJoinToken()
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/live_streams`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify([{
      public_id: publicId,
      creator_id: user.id,
      title,
      scheduled_start: startDate.toISOString(),
      duration_minutes: durationMinutes,
      is_paid: isPaid,
      entry_fee_paise: entryFeePaise,
      status: 'scheduled',
      join_token: joinToken,
      comments_enabled: true,
    }]),
  })
  if (!insertRes.ok) {
    console.error('Live stream create failed:', await insertRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to create stream' }, 500, {}, [], origin)
  }
  const rows = await insertRes.json().catch(() => [])
  const stream = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!stream) return jsonResponse({ error: 'Failed to create stream' }, 500, {}, [], origin)

  return jsonResponse({ stream: await decorateStream(stream, user.id) }, 200, {}, [], origin)
}

const handleLiveStreamListMine = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/live_streams?creator_id=eq.${user.id}&order=created_at.desc&select=*`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const streams = Array.isArray(rows) ? rows : []
  return jsonResponse({ streams: await Promise.all(streams.map((s) => decorateStream(s, user.id))) }, 200, {}, [], origin)
}

const handleLiveStreamGet = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const publicId = (url.searchParams.get('id') || '').trim()
  const stream = await fetchStreamByPublicId(publicId)
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  return jsonResponse({ stream: await decorateStream(stream, user.id) }, 200, {}, [], origin)
}

const handleLiveStreamStart = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const stream = await fetchStreamByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  if (stream.creator_id !== user.id) return jsonResponse({ error: 'Only the creator can start this stream' }, 403, {}, [], origin)
  if (stream.status === 'live') return jsonResponse({ stream: await decorateStream(stream, user.id) }, 200, {}, [], origin)
  if (stream.status === 'ended' || stream.status === 'cancelled') {
    return jsonResponse({ error: 'This stream has already ended' }, 400, {}, [], origin)
  }
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${stream.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'live', started_at: new Date().toISOString() }),
  })
  if (!patchRes.ok) return jsonResponse({ error: 'Failed to start stream' }, 500, {}, [], origin)
  const rows = await patchRes.json().catch(() => [])
  const updated = Array.isArray(rows) && rows.length ? rows[0] : stream
  return jsonResponse({ stream: await decorateStream(updated, user.id) }, 200, {}, [], origin)
}

const handleLiveStreamEnd = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const stream = await fetchStreamByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  if (stream.creator_id !== user.id) return jsonResponse({ error: 'Only the creator can end this stream' }, 403, {}, [], origin)
  if (stream.status !== 'live') return jsonResponse({ error: 'Stream is not live' }, 400, {}, [], origin)
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${stream.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'ended', ended_at: new Date().toISOString(), active_viewers: 0 }),
  })
  if (!patchRes.ok) return jsonResponse({ error: 'Failed to end stream' }, 500, {}, [], origin)
  const rows = await patchRes.json().catch(() => [])
  const updated = Array.isArray(rows) && rows.length ? rows[0] : stream
  return jsonResponse({ stream: await decorateStream(updated, user.id) }, 200, {}, [], origin)
}

const handleLiveStreamUpdateSettings = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const stream = await fetchStreamByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  if (stream.creator_id !== user.id) return jsonResponse({ error: 'Only the creator can update this stream' }, 403, {}, [], origin)
  const patch: Record<string, unknown> = {}
  if (typeof body.comments_enabled === 'boolean') patch.comments_enabled = body.comments_enabled
  if (Object.keys(patch).length === 0) return jsonResponse({ error: 'Nothing to update' }, 400, {}, [], origin)
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${stream.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!patchRes.ok) return jsonResponse({ error: 'Failed to update stream' }, 500, {}, [], origin)
  const rows = await patchRes.json().catch(() => [])
  const updated = Array.isArray(rows) && rows.length ? rows[0] : stream
  return jsonResponse({ stream: await decorateStream(updated, user.id) }, 200, {}, [], origin)
}

// ── Booking (paid entry) ───────────────────────────────────────────────────
const handleLiveStreamBookCheckout = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const stream = await fetchStreamByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  if (!stream.is_paid) return jsonResponse({ error: 'This stream is free — no payment needed' }, 400, {}, [], origin)
  if (stream.creator_id === user.id) return jsonResponse({ already_booked: true }, 200, {}, [], origin)

  // Already paid?
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_bookings?stream_id=eq.${stream.id}&user_id=eq.${user.id}&status=eq.paid&select=id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const existingRows = existingRes.ok ? await existingRes.json().catch(() => []) : []
  if (Array.isArray(existingRows) && existingRows.length) {
    return jsonResponse({ already_booked: true }, 200, {}, [], origin)
  }
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: 'Payments are not configured yet' }, 503, {}, [], origin)
  }

  const breakdown = computePlatformFeeBreakdown(Number(stream.entry_fee_paise))
  const orderAmountPaise = breakdown.final_amount_paise

  // Reuse pending order
  const pendingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_bookings?stream_id=eq.${stream.id}&user_id=eq.${user.id}&status=eq.created&select=*&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const pendingRows = pendingRes.ok ? await pendingRes.json().catch(() => []) : []
  const pending = Array.isArray(pendingRows) && pendingRows.length ? pendingRows[0] : null
  if (pending?.razorpay_order_id) {
    const orderLive = await razorpayGet(`/orders/${encodeURIComponent(pending.razorpay_order_id)}`)
    if (orderLive && Number(orderLive.amount) === orderAmountPaise && orderLive.status !== 'paid') {
      return jsonResponse({
        key_id: RAZORPAY_KEY_ID,
        order_id: pending.razorpay_order_id,
        amount: orderAmountPaise,
        currency: 'INR',
        content_name: String(stream.title || 'Live stream').slice(0, 120),
        content_type: 'live_stream_booking',
        content_amount_paise: breakdown.amount_paise,
        platform_fee_percent: PLATFORM_FEE_PERCENT,
        platform_fee_paise: breakdown.platform_fee_paise,
        final_amount_paise: breakdown.final_amount_paise,
      }, 200, {}, [], origin)
    }
  }

  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: orderAmountPaise,
      currency: 'INR',
      receipt: `lsb_${String(stream.id).slice(0, 8)}_${Date.now()}`.slice(0, 40),
      notes: { stream_id: stream.id, user_id: user.id, type: 'live_stream_booking' },
    }),
  })
  if (!orderRes.ok) {
    console.error('Live stream booking order failed:', await orderRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to create payment order' }, 502, {}, [], origin)
  }
  const order = await orderRes.json().catch(() => null)
  if (!order?.id) return jsonResponse({ error: 'Failed to create payment order' }, 502, {}, [], origin)

  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/live_stream_bookings?on_conflict=stream_id,user_id`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{
      stream_id: stream.id,
      user_id: user.id,
      is_paid: true,
      amount_paise: breakdown.amount_paise,
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      platform_fee_paise: breakdown.platform_fee_paise,
      net_to_creator_paise: breakdown.net_to_creator_paise,
      final_amount_paise: breakdown.final_amount_paise,
      currency: 'INR',
      provider: 'razorpay',
      razorpay_order_id: order.id,
      status: 'created',
    }]),
  })
  if (!upsertRes.ok) {
    console.error('Live stream booking upsert failed:', await upsertRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to start booking payment' }, 500, {}, [], origin)
  }

  return jsonResponse({
    key_id: RAZORPAY_KEY_ID,
    order_id: order.id,
    amount: orderAmountPaise,
    currency: 'INR',
    content_name: String(stream.title || 'Live stream').slice(0, 120),
    content_type: 'live_stream_booking',
    content_amount_paise: breakdown.amount_paise,
    platform_fee_percent: PLATFORM_FEE_PERCENT,
    platform_fee_paise: breakdown.platform_fee_paise,
    final_amount_paise: breakdown.final_amount_paise,
  }, 200, {}, [], origin)
}

const handleLiveStreamBookVerify = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const stream = await fetchStreamByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : ''
  const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : ''
  const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : ''
  if (!orderId || !paymentId || !signature) return jsonResponse({ error: 'Missing payment details' }, 400, {}, [], origin)
  if (!RAZORPAY_KEY_SECRET) return jsonResponse({ error: 'Payments not configured' }, 503, {}, [], origin)

  const expected = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`)
  if (expected !== signature) return jsonResponse({ error: 'Invalid signature' }, 400, {}, [], origin)

  const bookingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_bookings?stream_id=eq.${stream.id}&user_id=eq.${user.id}&razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const bookingRows = bookingRes.ok ? await bookingRes.json().catch(() => []) : []
  const booking = Array.isArray(bookingRows) && bookingRows.length ? bookingRows[0] : null
  if (!booking) return jsonResponse({ error: 'No matching booking found' }, 404, {}, [], origin)
  if (booking.status === 'paid') return jsonResponse({ status: 'paid' }, 200, {}, [], origin)
  if (booking.status !== 'created') return jsonResponse({ error: 'Booking is not awaiting payment' }, 400, {}, [], origin)

  const live = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`)
  const expectedPaise = Number(booking.final_amount_paise || booking.amount_paise || 0)
  if (!live || live.status !== 'captured' || Number(live.amount) !== expectedPaise || live.order_id !== orderId) {
    return jsonResponse({ error: 'Payment details did not match' }, 400, {}, [], origin)
  }

  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/live_stream_bookings?id=eq.${booking.id}&status=eq.created`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
    }),
  })
  if (!updateRes.ok) return jsonResponse({ error: 'Failed to confirm booking' }, 500, {}, [], origin)

  // Increment stream earnings
  await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${stream.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ total_earnings_paise: Number(stream.total_earnings_paise || 0) + expectedPaise }),
  }).catch(() => {})

  return jsonResponse({ status: 'paid' }, 200, {}, [], origin)
}

const handleLiveStreamBookStatus = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const publicId = (url.searchParams.get('id') || '').trim()
  const orderId = (url.searchParams.get('order_id') || '').trim()
  const stream = await fetchStreamByPublicId(publicId)
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  if (!stream.is_paid || stream.creator_id === user.id) {
    return jsonResponse({ status: 'paid', has_access: true }, 200, {}, [], origin)
  }
  const orderClause = orderId ? `&razorpay_order_id=eq.${encodeURIComponent(orderId)}` : ''
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_bookings?stream_id=eq.${stream.id}&user_id=eq.${user.id}${orderClause}&select=id,status,razorpay_order_id&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const booking = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!booking) return jsonResponse({ status: 'unpaid', has_access: false }, 200, {}, [], origin)
  if (booking.status === 'paid') return jsonResponse({ status: 'paid', has_access: true }, 200, {}, [], origin)
  // Recovery path — check Razorpay directly
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && booking.razorpay_order_id) {
    const payments = await razorpayGet(`/orders/${encodeURIComponent(booking.razorpay_order_id)}/payments`)
    const items = Array.isArray(payments?.items) ? payments.items : []
    const captured = items.find((p: Record<string, unknown>) => p.status === 'captured')
    if (captured?.id) {
      await fetch(`${SUPABASE_URL}/rest/v1/live_stream_bookings?id=eq.${booking.id}&status=eq.created`, {
        method: 'PATCH',
        headers: { ...authHeaders(true), Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'paid',
          razorpay_payment_id: String(captured.id),
          paid_at: new Date().toISOString(),
          verified_at: new Date().toISOString(),
        }),
      }).catch(() => {})
      await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${stream.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(true), Prefer: 'return=minimal' },
        body: JSON.stringify({ total_earnings_paise: Number(stream.total_earnings_paise || 0) + Number(captured.amount || 0) }),
      }).catch(() => {})
      return jsonResponse({ status: 'paid', has_access: true }, 200, {}, [], origin)
    }
  }
  return jsonResponse({ status: 'processing', has_access: false }, 200, {}, [], origin)
}

// ── Gifts ──────────────────────────────────────────────────────────────────
const handleLiveStreamGiftCatalog = async (req: Request) => {
  const origin = req.headers.get('origin')
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_gift_catalog?active=eq.true&order=sort_order.asc&select=id,code,name,emoji,amount_paise,sort_order`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  return jsonResponse({ gifts: Array.isArray(rows) ? rows : [] }, 200, {}, [], origin)
}

const handleLiveStreamGiftCheckout = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const stream = await fetchStreamByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  const giftCode = typeof body.gift_code === 'string' ? body.gift_code : ''
  if (!giftCode) return jsonResponse({ error: 'Pick a gift' }, 400, {}, [], origin)

  const giftRes = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_gift_catalog?code=eq.${encodeURIComponent(giftCode)}&active=eq.true&select=id,code,name,amount_paise&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const giftRows = giftRes.ok ? await giftRes.json().catch(() => []) : []
  const gift = Array.isArray(giftRows) && giftRows.length ? giftRows[0] : null
  if (!gift) return jsonResponse({ error: 'Gift not found' }, 404, {}, [], origin)

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: 'Payments are not configured yet' }, 503, {}, [], origin)
  }

  const breakdown = computePlatformFeeBreakdown(Number(gift.amount_paise))
  const orderAmountPaise = breakdown.final_amount_paise

  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: orderAmountPaise,
      currency: 'INR',
      receipt: `lsg_${String(stream.id).slice(0, 6)}_${Date.now()}`.slice(0, 40),
      notes: { stream_id: stream.id, sender_id: user.id, gift_code: gift.code, content_amount_paise: String(breakdown.amount_paise) },
    }),
  })
  if (!orderRes.ok) {
    console.error('Gift order failed:', await orderRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to create gift order' }, 502, {}, [], origin)
  }
  const order = await orderRes.json().catch(() => null)
  if (!order?.id) return jsonResponse({ error: 'Failed to create gift order' }, 502, {}, [], origin)

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/live_stream_gifts`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify([{
      stream_id: stream.id,
      sender_id: user.id,
      creator_id: stream.creator_id,
      gift_code: gift.code,
      gift_name: gift.name,
      amount_paise: breakdown.amount_paise,
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      platform_fee_paise: breakdown.platform_fee_paise,
      net_to_creator_paise: breakdown.net_to_creator_paise,
      razorpay_order_id: order.id,
      status: 'created',
    }]),
  })
  if (!insertRes.ok) {
    console.error('Gift insert failed:', await insertRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to record gift' }, 500, {}, [], origin)
  }

  return jsonResponse({
    key_id: RAZORPAY_KEY_ID,
    order_id: order.id,
    amount: orderAmountPaise,
    currency: 'INR',
    content_name: `${gift.emoji || '🎁'} ${gift.name}`,
    content_type: 'live_stream_gift',
    content_amount_paise: breakdown.amount_paise,
    platform_fee_percent: PLATFORM_FEE_PERCENT,
    platform_fee_paise: breakdown.platform_fee_paise,
    final_amount_paise: breakdown.final_amount_paise,
  }, 200, {}, [], origin)
}

const handleLiveStreamGiftVerify = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : ''
  const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : ''
  const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : ''
  if (!orderId || !paymentId || !signature) return jsonResponse({ error: 'Missing payment details' }, 400, {}, [], origin)
  if (!RAZORPAY_KEY_SECRET) return jsonResponse({ error: 'Payments not configured' }, 503, {}, [], origin)

  const expected = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`)
  if (expected !== signature) return jsonResponse({ error: 'Invalid signature' }, 400, {}, [], origin)

  const giftRes = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_gifts?razorpay_order_id=eq.${encodeURIComponent(orderId)}&sender_id=eq.${user.id}&status=eq.created&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const giftRows = giftRes.ok ? await giftRes.json().catch(() => []) : []
  const gift = Array.isArray(giftRows) && giftRows.length ? giftRows[0] : null
  if (!gift) return jsonResponse({ error: 'Gift order not found' }, 404, {}, [], origin)

  const live = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`)
  const expectedPaise = Number(gift.final_amount_paise || gift.amount_paise || 0)
  if (!live || live.status !== 'captured' || Number(live.amount) !== expectedPaise || live.order_id !== orderId) {
    return jsonResponse({ error: 'Payment details did not match' }, 400, {}, [], origin)
  }

  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/live_stream_gifts?id=eq.${gift.id}&status=eq.created`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
    }),
  })
  if (!updateRes.ok) return jsonResponse({ error: 'Failed to confirm gift' }, 500, {}, [], origin)

  // Increment stream earnings + creator lifetime earnings (post_purchases is not used here;
  // gifts are independent). Withdrawals still go through the wallet using post_purchases.
  // For now, increment stream total_earnings_paise so the More panel reflects it.
  const stream = await fetchStreamById(String(gift.stream_id))
  if (stream) {
    await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${stream.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=minimal' },
      body: JSON.stringify({ total_earnings_paise: Number(stream.total_earnings_paise || 0) + expectedPaise }),
    }).catch(() => {})
  }

  return jsonResponse({ status: 'paid', gift: { code: gift.gift_code, name: gift.gift_name, amount_paise: expectedPaise } }, 200, {}, [], origin)
}

// ── Presence / chat / more panel ───────────────────────────────────────────
const handleLiveStreamHeartbeat = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const stream = await fetchStreamByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  if (stream.status !== 'live') return jsonResponse({ status: 'not_live' }, 200, {}, [], origin)

  // Upsert viewer presence
  await fetch(`${SUPABASE_URL}/rest/v1/live_stream_viewers?on_conflict=stream_id,user_id`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{
      stream_id: stream.id,
      user_id: user.id,
      last_seen_at: new Date().toISOString(),
    }]),
  })

  // Recompute active viewers = viewers with last_seen_at in last 30s
  const cutoff = new Date(Date.now() - 30_000).toISOString()
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_viewers?stream_id=eq.${stream.id}&last_seen_at=gt.${cutoff}&select=id`,
    { headers: { ...authHeaders(true), Prefer: 'count=exact' } },
  )
  const count = Number(countRes.headers.get('content-range')?.split('/')?.[1] || 0)
  const newPeak = Math.max(Number(stream.peak_viewers || 0), count)
  await fetch(`${SUPABASE_URL}/rest/v1/live_streams?id=eq.${stream.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ active_viewers: count, peak_viewers: newPeak }),
  }).catch(() => {})

  return jsonResponse({ active_viewers: count, peak_viewers: newPeak }, 200, {}, [], origin)
}

const handleLiveStreamChatList = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const publicId = (url.searchParams.get('id') || '').trim()
  const stream = await fetchStreamByPublicId(publicId)
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_chat?stream_id=eq.${stream.id}&order=created_at.desc&limit=50&select=id,user_id,body,created_at`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  // Attach sender usernames
  const userIds = Array.from(new Set((Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => r.user_id).filter(Boolean)))
  const userInfos = new Map<string, { username?: string; avatar_url?: string | null }>()
  if (userIds.length) {
    const uRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${userIds.map((id) => `'${id}'`).join(',')})&select=id,username,avatar_url`,
      { headers: { ...authHeaders(true) } },
    )
    if (uRes.ok) {
      const uRows = await uRes.json().catch(() => [])
      for (const r of Array.isArray(uRows) ? uRows : []) {
        userInfos.set(r.id, { username: r.username, avatar_url: r.avatar_url })
      }
    }
  }
  const messages = (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
    id: r.id,
    user_id: r.user_id,
    username: userInfos.get(String(r.user_id))?.username || 'User',
    avatar_url: userInfos.get(String(r.user_id))?.avatar_url || null,
    body: r.body,
    created_at: r.created_at,
  })).reverse()
  return jsonResponse({ messages, comments_enabled: stream.comments_enabled !== false }, 200, {}, [], origin)
}

const handleLiveStreamChatSend = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const stream = await fetchStreamByPublicId(typeof body.public_id === 'string' ? body.public_id : '')
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  if (stream.status !== 'live') return jsonResponse({ error: 'Stream is not live' }, 400, {}, [], origin)
  if (stream.comments_enabled === false) return jsonResponse({ error: 'Comments are turned off' }, 400, {}, [], origin)
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!text || text.length > 500) return jsonResponse({ error: 'Message must be 1–500 chars' }, 400, {}, [], origin)
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/live_stream_chat`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify([{ stream_id: stream.id, user_id: user.id, body: text }]),
  })
  if (!insertRes.ok) return jsonResponse({ error: 'Failed to post comment' }, 500, {}, [], origin)
  const rows = await insertRes.json().catch(() => [])
  const msg = Array.isArray(rows) && rows.length ? rows[0] : null
  const profile = await getProfileUsernameById(user.id)
  return jsonResponse({
    message: msg ? {
      id: msg.id,
      user_id: user.id,
      username: profile?.username || 'User',
      avatar_url: profile?.avatar_url || null,
      body: msg.body,
      created_at: msg.created_at,
    } : null,
  }, 200, {}, [], origin)
}

const handleLiveStreamStats = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const publicId = (url.searchParams.get('id') || '').trim()
  const stream = await fetchStreamByPublicId(publicId)
  if (!stream) return jsonResponse({ error: 'Stream not found' }, 404, {}, [], origin)
  if (stream.creator_id !== user.id) return jsonResponse({ error: 'Only the creator can view stats' }, 403, {}, [], origin)
  // Total gifts sum (paid) for this stream
  const giftRes = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_gifts?stream_id=eq.${stream.id}&status=eq.paid&select=amount_paise,platform_fee_paise,net_to_creator_paise,final_amount_paise`,
    { headers: { ...authHeaders(true), Prefer: 'count=exact' } },
  )
  const giftRows = giftRes.ok ? await giftRes.json().catch(() => []) : []
  const gifts = Array.isArray(giftRows) ? giftRows : []
  const giftsGrossPaise = gifts.reduce((sum, g) => sum + Number(g.amount_paise || 0), 0)
  const giftsFinalPaise = gifts.reduce((sum, g) => sum + Number(g.final_amount_paise || 0), 0)
  const giftsNetPaise = gifts.reduce((sum, g) => sum + Number(g.net_to_creator_paise || 0), 0)
  // Booking revenue (paid)
  const bookRes = await fetch(
    `${SUPABASE_URL}/rest/v1/live_stream_bookings?stream_id=eq.${stream.id}&status=eq.paid&select=final_amount_paise,net_to_creator_paise,amount_paise`,
    { headers: { ...authHeaders(true) } },
  )
  const bookRows = bookRes.ok ? await bookRes.json().catch(() => []) : []
  const books = Array.isArray(bookRows) ? bookRows : []
  const bookingsFinalPaise = books.reduce((sum, b) => sum + Number(b.final_amount_paise || 0), 0)
  const bookingsNetPaise = books.reduce((sum, b) => sum + Number(b.net_to_creator_paise || 0), 0)
  const bookingsCount = books.length

  return jsonResponse({
    active_viewers: Number(stream.active_viewers || 0),
    peak_viewers: Number(stream.peak_viewers || 0),
    total_earnings_paise: Number(stream.total_earnings_paise || 0),
    gifts_gross_paise: giftsGrossPaise,
    gifts_final_paise: giftsFinalPaise,
    gifts_net_to_creator_paise: giftsNetPaise,
    bookings_count: bookingsCount,
    bookings_final_paise: bookingsFinalPaise,
    bookings_net_to_creator_paise: bookingsNetPaise,
    comments_enabled: stream.comments_enabled !== false,
    status: stream.status,
  }, 200, {}, [], origin)
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

const CHAT_MEDIA_BUCKET = 'chat-media'
const MAX_CHAT_MEDIA_SIZE = 100 * 1024 * 1024

const signChatPath = async (path: string, expiresIn = MEDIA_TTL_SECONDS): Promise<string> => {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${CHAT_MEDIA_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ expiresIn }),
  })
  if (!res.ok) return ''
  const body = await res.json().catch(() => ({}))
  return body?.signedURL ? `${SUPABASE_URL}/storage/v1${body.signedURL}` : ''
}

const getConversationForUser = async (conversationId: string, userId: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  const convo = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!convo) return null
  if (convo.user_a !== userId && convo.user_b !== userId) return null
  return convo
}

const conversationPeer = (convo: Record<string, unknown>, userId: string) =>
  convo.user_a === userId ? convo.user_b as string : convo.user_a as string

const clearedAtFor = (convo: Record<string, unknown>, userId: string) =>
  (convo.user_a === userId ? convo.cleared_a : convo.cleared_b) as string | null

const getBlockPair = async (userId: string, otherId: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_blocks?or=(and(blocker_id.eq.${userId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${userId}))&select=blocker_id`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const blockers = new Set((Array.isArray(rows) ? rows : []).map((r: { blocker_id: string }) => r.blocker_id))
  return { blockedByMe: blockers.has(userId), blockedMe: blockers.has(otherId) }
}

const messagePreview = (msg: Record<string, unknown>, isMine: boolean) => {
  if (msg.media_type === 'image') return `${isMine ? 'You: ' : ''}📷 Photo${msg.is_once ? ' (view once)' : ''}`
  if (msg.media_type === 'video') return `${isMine ? 'You: ' : ''}🎬 Video${msg.is_once ? ' (view once)' : ''}`
  const body = typeof msg.body === 'string' ? msg.body : ''
  return `${isMine ? 'You: ' : ''}${body}`
}

const handleGetConversations = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const convoRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?or=(user_a.eq.${user.id},user_b.eq.${user.id})&select=*&order=last_message_at.desc&limit=100`,
    { headers: { ...authHeaders(true) } },
  )
  if (!convoRes.ok) return jsonResponse({ error: 'Failed to load conversations' }, 500, {}, [], origin)
  const convos = await convoRes.json().catch(() => [])
  if (!Array.isArray(convos) || !convos.length) return jsonResponse({ conversations: [] }, 200, {}, [], origin)

  const convoIds = convos.map((c) => c.id).join(',')
  const peerIds = [...new Set(convos.map((c) => conversationPeer(c, user.id)))].join(',')
  const notDeletedForMe = `deleted_for=not.cs.${encodeURIComponent(`{${user.id}}`)}`

  const [profilesRes, accountsRes, messagesRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${peerIds})&select=id,username,full_name,avatar_url`, {
      headers: { ...authHeaders(true) },
    }),
    fetch(`${SUPABASE_URL}/rest/v1/user_accounts?id=in.(${peerIds})&select=id,name`, {
      headers: { ...authHeaders(true) },
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=in.(${convoIds})&deleted_for_all=eq.false&${notDeletedForMe}&select=id,conversation_id,sender_id,body,media_type,is_once,seen_at,created_at&order=created_at.desc&limit=1000`,
      { headers: { ...authHeaders(true) } },
    ),
  ])

  const profiles = profilesRes.ok ? await profilesRes.json().catch(() => []) : []
  const profileMap = new Map((Array.isArray(profiles) ? profiles : []).map((p: { id: string }) => [p.id, p]))
  const accounts = accountsRes.ok ? await accountsRes.json().catch(() => []) : []
  for (const account of Array.isArray(accounts) ? accounts : []) {
    if (!profileMap.has(account.id)) {
      profileMap.set(account.id, {
        id: account.id,
        username: account.name || 'MalluCupid user',
        full_name: account.name || 'MalluCupid user',
        avatar_url: '',
      })
    }
  }
  const allMessages = messagesRes.ok ? await messagesRes.json().catch(() => []) : []

  const items = []
  for (const convo of convos) {
    const peerId = conversationPeer(convo, user.id)
    const peer = profileMap.get(peerId) as { username?: string; full_name?: string; avatar_url?: string } | undefined
    const cleared = clearedAtFor(convo, user.id)
    const visible = (Array.isArray(allMessages) ? allMessages : []).filter((m: Record<string, unknown>) =>
      m.conversation_id === convo.id && (!cleared || String(m.created_at) > cleared))
    const last = visible[0] || null
    // A conversation the user cleared stays hidden until a new message arrives
    if (!last) continue

    const unread = visible.filter((m: Record<string, unknown>) => m.sender_id !== user.id && !m.seen_at).length
    items.push({
      id: convo.id,
      status: convo.status,
      is_request: convo.status === 'pending' && convo.created_by !== user.id,
      other: {
        username: peer?.username || '',
        full_name: peer?.full_name || '',
        avatar_url: peer?.avatar_url || '',
      },
      last_message: {
        preview: messagePreview(last, last.sender_id === user.id),
        created_at: last.created_at,
      },
      unread,
      last_message_at: convo.last_message_at,
    })
  }

  return jsonResponse({ conversations: items }, 200, {}, [], origin)
}

const handleUserSearch = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const q = (url.searchParams.get('q') || '').trim().toLowerCase().replace(/[%_,()]/g, '')
  if (q.length < 2) return jsonResponse({ users: [] }, 200, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?username=ilike.${encodeURIComponent(`${q}%`)}&id=neq.${user.id}&select=username,full_name,avatar_url&limit=5`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  return jsonResponse({ users: Array.isArray(rows) ? rows : [] }, 200, {}, [], origin)
}

const handleCreateConversation = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  if (!username) return jsonResponse({ error: 'Missing username' }, 400, {}, [], origin)

  const targetRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id,username&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const targetRows = targetRes.ok ? await targetRes.json().catch(() => []) : []
  const target = Array.isArray(targetRows) && targetRows.length ? targetRows[0] : null
  if (!target) return jsonResponse({ error: 'User not found' }, 404, {}, [], origin)
  if (target.id === user.id) return jsonResponse({ error: 'You cannot message yourself' }, 400, {}, [], origin)

  const blocks = await getBlockPair(user.id, target.id)
  if (blocks.blockedByMe) return jsonResponse({ error: 'You have blocked this user. Unblock to message.' }, 403, {}, [], origin)
  if (blocks.blockedMe) return jsonResponse({ error: 'Unable to message this user' }, 403, {}, [], origin)

  const [userA, userB] = [user.id, target.id].sort()
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?user_a=eq.${userA}&user_b=eq.${userB}&select=id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const existing = existingRes.ok ? await existingRes.json().catch(() => []) : []
  if (Array.isArray(existing) && existing.length) {
    return jsonResponse({ conversation_id: existing[0].id, existing: true }, 200, {}, [], origin)
  }

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations?on_conflict=user_a,user_b`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify([{ user_a: userA, user_b: userB, created_by: user.id, status: 'pending' }]),
  })
  if (!insertRes.ok) {
    console.error('Conversation create failed:', await insertRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to start conversation' }, 500, {}, [], origin)
  }
  const rows = await insertRes.json().catch(() => [])
  let conversationId = rows[0]?.id
  let created = Boolean(conversationId)
  if (!conversationId) {
    const racedRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?user_a=eq.${userA}&user_b=eq.${userB}&select=id&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const raced = racedRes.ok ? await racedRes.json().catch(() => []) : []
    conversationId = Array.isArray(raced) ? raced[0]?.id : undefined
    created = false
  }
  if (!conversationId) return jsonResponse({ error: 'Failed to start conversation' }, 500, {}, [], origin)
  if (created) {
    await createNotification({
      user_id: target.id,
      actor_id: user.id,
      type: 'request',
      conversation_id: conversationId,
    })
  }
  return jsonResponse({ conversation_id: conversationId, existing: !created }, 200, {}, [], origin)
}

const handleAcceptConversation = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const convo = await getConversationForUser(typeof body.conversation_id === 'string' ? body.conversation_id : '', user.id)
  if (!convo) return jsonResponse({ error: 'Conversation not found' }, 404, {}, [], origin)
  if (convo.created_by === user.id) return jsonResponse({ error: 'Only the recipient can accept a request' }, 403, {}, [], origin)
  if (convo.status === 'accepted') return jsonResponse({ status: 'accepted' }, 200, {}, [], origin)

  await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${convo.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'accepted' }),
  })
  await createNotification({
    user_id: convo.created_by as string,
    actor_id: user.id,
    type: 'accept',
    conversation_id: convo.id as string,
  })
  return jsonResponse({ status: 'accepted' }, 200, {}, [], origin)
}

const decorateMessage = async (msg: Record<string, unknown>, userId: string, signedChat: Record<string, string> = {}) => {
  const isMine = msg.sender_id === userId
  let mediaUrl = ''
  let onceState: string = 'none'
  if (msg.media_type && msg.media_path) {
    if (msg.is_once) {
      onceState = msg.viewed_at ? 'opened' : (isMine ? 'sent' : 'available')
    } else {
      mediaUrl = signedChat[String(msg.media_path)] || await signChatPath(String(msg.media_path), MEDIA_TTL_SECONDS)
    }
  }
  return {
    id: msg.id,
    sender_is_me: isMine,
    body: msg.body,
    media_type: msg.media_type,
    media_url: mediaUrl,
    is_once: msg.is_once,
    once_state: onceState,
    seen_at: msg.seen_at,
    created_at: msg.created_at,
  }
}

const handleGetMessages = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const convo = await getConversationForUser(url.searchParams.get('conversation_id') || '', user.id)
  if (!convo) return jsonResponse({ error: 'Conversation not found' }, 404, {}, [], origin)

  const peerId = conversationPeer(convo, user.id)
  const cleared = clearedAtFor(convo, user.id)
  const notDeletedForMe = `deleted_for=not.cs.${encodeURIComponent(`{${user.id}}`)}`
  const clearedFilter = cleared ? `&created_at=gt.${encodeURIComponent(cleared)}` : ''

  const [messagesRes, peer, blocks] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convo.id}&deleted_for_all=eq.false&${notDeletedForMe}${clearedFilter}&select=*&order=created_at.asc&limit=500`,
      { headers: { ...authHeaders(true) } },
    ),
    fetchProfileBrief(peerId),
    getBlockPair(user.id, peerId),
  ])

  const rows = messagesRes.ok ? await messagesRes.json().catch(() => []) : []
  const list = Array.isArray(rows) ? rows : []
  const chatPaths = [...new Set(
    list
      .filter((m: Record<string, unknown>) => m.media_path && !m.is_once)
      .map((m: Record<string, unknown>) => String(m.media_path)),
  )]
  const signedChat: Record<string, string> = {}
  await Promise.all(chatPaths.map(async (path) => {
    signedChat[path] = await signChatPath(path, MEDIA_TTL_SECONDS)
  }))
  const messages = await Promise.all(list.map((m) => decorateMessage(m, user.id, signedChat)))

  // Viewing the chat marks incoming messages as seen
  await fetch(
    `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convo.id}&sender_id=neq.${user.id}&seen_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=minimal' },
      body: JSON.stringify({ seen_at: new Date().toISOString() }),
    },
  ).catch(() => {})

  return jsonResponse({
    conversation: {
      id: convo.id,
      status: convo.status,
      is_request: convo.status === 'pending' && convo.created_by !== user.id,
      blocked_by_me: blocks.blockedByMe,
      can_send: !blocks.blockedByMe && !blocks.blockedMe,
      other: peer
        ? { username: peer.username, full_name: peer.full_name, avatar_url: peer.avatar_url }
        : { username: '', full_name: '', avatar_url: '' },
    },
    messages,
  }, 200, {}, [], origin)
}

const handleChatUploadUrl = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const convo = await getConversationForUser(typeof body.conversation_id === 'string' ? body.conversation_id : '', user.id)
  if (!convo) return jsonResponse({ error: 'Conversation not found' }, 404, {}, [], origin)

  const contentType = typeof body.content_type === 'string' ? body.content_type : ''
  const size = Number(body.size)
  const isImage = contentType.startsWith('image/')
  const isVideo = contentType.startsWith('video/')
  if (!isImage && !isVideo) return jsonResponse({ error: 'Only photos and videos can be attached' }, 400, {}, [], origin)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_CHAT_MEDIA_SIZE) {
    return jsonResponse({ error: 'Attachment must be 100MB or smaller' }, 400, {}, [], origin)
  }

  const path = `${convo.id}/${crypto.randomUUID()}.${mediaExtension(contentType)}`
  const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${CHAT_MEDIA_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({}),
  })
  if (!signRes.ok) {
    console.error('Chat upload sign failed:', await signRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to prepare upload' }, 500, {}, [], origin)
  }
  const signBody = await signRes.json().catch(() => ({}))
  if (!signBody?.url) return jsonResponse({ error: 'Failed to prepare upload' }, 500, {}, [], origin)

  return jsonResponse({
    path,
    upload_url: `${SUPABASE_URL}/storage/v1${signBody.url}`,
    media_type: isVideo ? 'video' : 'image',
  }, 200, {}, [], origin)
}

const handleSendMessage = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const convo = await getConversationForUser(typeof body.conversation_id === 'string' ? body.conversation_id : '', user.id)
  if (!convo) return jsonResponse({ error: 'Conversation not found' }, 404, {}, [], origin)

  const peerId = conversationPeer(convo, user.id)
  const blocks = await getBlockPair(user.id, peerId)
  if (blocks.blockedByMe) return jsonResponse({ error: 'You have blocked this user. Unblock to message.' }, 403, {}, [], origin)
  if (blocks.blockedMe) return jsonResponse({ error: 'Unable to message this user' }, 403, {}, [], origin)

  // Pending requests: initiator may send only the first message until accepted.
  if (convo.status === 'pending' && convo.created_by === user.id) {
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convo.id}&sender_id=eq.${user.id}&deleted_for_all=eq.false&select=id`,
      { method: 'HEAD', headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' } },
    )
    const total = (countRes.headers.get('content-range') || '').split('/')[1]
    const existing = total && total !== '*' ? Number(total) || 0 : 0
    if (existing >= 1) {
      return jsonResponse({ error: 'Wait until they accept your message request' }, 403, {}, [], origin)
    }
  }

  const text = typeof body.body === 'string' ? body.body.trim() : ''
  const mediaPath = typeof body.media_path === 'string' ? body.media_path : ''
  const mediaType = body.media_type === 'image' || body.media_type === 'video' ? body.media_type : ''
  const isOnce = body.is_once === true && Boolean(mediaPath)

  if (text.length > 2000) return jsonResponse({ error: 'Message must be 2000 characters or fewer' }, 400, {}, [], origin)
  if (!text && !mediaPath) return jsonResponse({ error: 'Message is empty' }, 400, {}, [], origin)
  if (mediaPath && (!mediaType || !mediaPath.startsWith(`${convo.id}/`))) {
    return jsonResponse({ error: 'Invalid attachment' }, 400, {}, [], origin)
  }

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify([{
      conversation_id: convo.id,
      sender_id: user.id,
      body: text,
      media_path: mediaPath,
      media_type: mediaType,
      is_once: isOnce,
    }]),
  })
  if (!insertRes.ok) {
    console.error('Message send failed:', await insertRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to send message' }, 500, {}, [], origin)
  }

  // Replying to a request accepts it; also bump conversation recency
  const patch: Record<string, unknown> = { last_message_at: new Date().toISOString() }
  if (convo.status === 'pending' && convo.created_by !== user.id) patch.status = 'accepted'
  await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${convo.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  }).catch(() => {})
  if (patch.status === 'accepted') {
    // Replying auto-accepts the request; tell the requester
    await createNotification({
      user_id: convo.created_by as string,
      actor_id: user.id,
      type: 'accept',
      conversation_id: convo.id as string,
    })
  }

  const rows = await insertRes.json().catch(() => [])
  const message = rows[0] ? await decorateMessage(rows[0], user.id) : null
  return jsonResponse({ status: 'sent', message }, 200, {}, [], origin)
}

const handleViewOnceMessage = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const messageId = typeof body.message_id === 'string' ? body.message_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return jsonResponse({ error: 'Message not found' }, 404, {}, [], origin)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${messageId}&select=*&limit=1`, {
    headers: { ...authHeaders(true) },
  })
  const rows = res.ok ? await res.json().catch(() => []) : []
  const msg = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!msg) return jsonResponse({ error: 'Message not found' }, 404, {}, [], origin)

  const convo = await getConversationForUser(msg.conversation_id, user.id)
  if (!convo) return jsonResponse({ error: 'Message not found' }, 404, {}, [], origin)
  if (msg.sender_id === user.id) return jsonResponse({ error: 'View once media can only be opened by the recipient' }, 403, {}, [], origin)
  if (!msg.is_once || !msg.media_path) return jsonResponse({ error: 'Not a view once message' }, 400, {}, [], origin)
  if (msg.viewed_at) return jsonResponse({ error: 'This media has already been viewed' }, 410, {}, [], origin)

  // Mark viewed first so a second request can never get another URL
  const markRes = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${messageId}&viewed_at=is.null`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify({ viewed_at: new Date().toISOString() }),
  })
  const marked = markRes.ok ? await markRes.json().catch(() => []) : []
  if (!Array.isArray(marked) || !marked.length) {
    return jsonResponse({ error: 'This media has already been viewed' }, 410, {}, [], origin)
  }

  const url = await signChatPath(msg.media_path, VIEW_ONCE_TTL_SECONDS)
  if (!url) return jsonResponse({ error: 'Failed to load media' }, 500, {}, [], origin)
  return jsonResponse({ media_url: url, media_type: msg.media_type }, 200, {}, [], origin)
}

const handleDeleteMessages = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const convo = await getConversationForUser(typeof body.conversation_id === 'string' ? body.conversation_id : '', user.id)
  if (!convo) return jsonResponse({ error: 'Conversation not found' }, 404, {}, [], origin)

  const mode = body.mode === 'both' ? 'both' : 'me'
  const ids = (Array.isArray(body.message_ids) ? body.message_ids : [])
    .filter((id: unknown) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id as string))
    .slice(0, 100)
  if (!ids.length) return jsonResponse({ error: 'No messages selected' }, 400, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/messages?id=in.(${ids.join(',')})&conversation_id=eq.${convo.id}&select=id,sender_id,media_path,deleted_for`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  if (!Array.isArray(rows) || !rows.length) return jsonResponse({ error: 'Messages not found' }, 404, {}, [], origin)

  if (mode === 'both') {
    if (rows.some((m: { sender_id: string }) => m.sender_id !== user.id)) {
      return jsonResponse({ error: 'You can only delete your own messages for everyone' }, 403, {}, [], origin)
    }
    const mediaPaths = rows.map((m: { media_path: string }) => m.media_path).filter(Boolean)
    if (mediaPaths.length) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/${CHAT_MEDIA_BUCKET}`, {
        method: 'DELETE',
        headers: { ...authHeaders(true) },
        body: JSON.stringify({ prefixes: mediaPaths }),
      }).catch(() => {})
    }
    await fetch(`${SUPABASE_URL}/rest/v1/messages?id=in.(${rows.map((m: { id: string }) => m.id).join(',')})`, {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=minimal' },
      body: JSON.stringify({ deleted_for_all: true, body: '', media_path: '', media_type: '' }),
    })
  } else {
    for (const msg of rows) {
      const deletedFor = Array.isArray(msg.deleted_for) ? msg.deleted_for : []
      if (deletedFor.includes(user.id)) continue
      await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${msg.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(true), Prefer: 'return=minimal' },
        body: JSON.stringify({ deleted_for: [...deletedFor, user.id] }),
      })
    }
  }

  return jsonResponse({ status: 'deleted', count: rows.length }, 200, {}, [], origin)
}

const handleDeleteChat = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const convo = await getConversationForUser(typeof body.conversation_id === 'string' ? body.conversation_id : '', user.id)
  if (!convo) return jsonResponse({ error: 'Conversation not found' }, 404, {}, [], origin)

  if (body.mode === 'both') {
    // Remove all media under this conversation, then the row (messages cascade)
    const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${CHAT_MEDIA_BUCKET}`, {
      method: 'POST',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({ prefix: convo.id, limit: 1000 }),
    })
    const objects = listRes.ok ? await listRes.json().catch(() => []) : []
    const prefixes = (Array.isArray(objects) ? objects : [])
      .map((obj: { name?: string }) => `${convo.id}/${obj?.name}`)
      .filter((p: string) => !p.endsWith('/undefined'))
    if (prefixes.length) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/${CHAT_MEDIA_BUCKET}`, {
        method: 'DELETE',
        headers: { ...authHeaders(true) },
        body: JSON.stringify({ prefixes }),
      }).catch(() => {})
    }
    await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${convo.id}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
    })
  } else {
    const field = convo.user_a === user.id ? 'cleared_a' : 'cleared_b'
    await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${convo.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=minimal' },
      body: JSON.stringify({ [field]: new Date().toISOString() }),
    })
  }

  return jsonResponse({ status: 'chat_deleted' }, 200, {}, [], origin)
}

const handleBlockUser = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const convo = await getConversationForUser(typeof body.conversation_id === 'string' ? body.conversation_id : '', user.id)
  if (!convo) return jsonResponse({ error: 'Conversation not found' }, 404, {}, [], origin)
  const peerId = conversationPeer(convo, user.id)

  if (body.block === false) {
    await fetch(`${SUPABASE_URL}/rest/v1/user_blocks?blocker_id=eq.${user.id}&blocked_id=eq.${peerId}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
    })
    return jsonResponse({ status: 'unblocked' }, 200, {}, [], origin)
  }

  await fetch(`${SUPABASE_URL}/rest/v1/user_blocks?on_conflict=blocker_id,blocked_id`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify([{ blocker_id: user.id, blocked_id: peerId }]),
  })
  return jsonResponse({ status: 'blocked' }, 200, {}, [], origin)
}

const handleReportUser = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const convo = await getConversationForUser(typeof body.conversation_id === 'string' ? body.conversation_id : '', user.id)
  if (!convo) return jsonResponse({ error: 'Conversation not found' }, 404, {}, [], origin)
  const peerId = conversationPeer(convo, user.id)

  const reason = typeof body.reason === 'string' ? body.reason : ''
  const details = typeof body.details === 'string' ? body.details.trim() : ''
  if (!REPORT_REASONS.includes(reason)) return jsonResponse({ error: 'Select a valid reason' }, 400, {}, [], origin)
  if (details.length > 750) return jsonResponse({ error: 'Additional details must be 750 characters or fewer' }, 400, {}, [], origin)

  const [reporter, reported] = await Promise.all([fetchProfileBrief(user.id), fetchProfileBrief(peerId)])
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_reports`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify([{
      reporter_id: user.id,
      reporter_username: reporter?.username || '',
      reported_id: peerId,
      reported_username: reported?.username || '',
      conversation_id: convo.id,
      reason,
      details,
    }]),
  })
  if (!res.ok) {
    console.error('User report failed:', await res.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to submit report' }, 500, {}, [], origin)
  }
  return jsonResponse({ status: 'report_submitted' }, 200, {}, [], origin)
}

const handleForgot = async (req: Request) => {
  const origin = req.headers.get('origin')
  const body = await parseJson(req)
  const email = normalizeEmail(body.email)
  if (!validEmail(email)) return jsonResponse({ error: 'Enter a valid email address' }, 400, {}, [], origin)
  const limited = await enforceRateLimit(`otp:email:${email}`, 8, 15 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)

  const accountRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?email=ilike.${encodeURIComponent(email)}&role=eq.creator&select=id&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const accounts = accountRes.ok ? await accountRes.json().catch(() => []) : []
  if (!Array.isArray(accounts) || !accounts.length) {
    return jsonResponse({ error: "You don't have a creator account" }, 404, {}, [], origin)
  }
  const issued = await issueOtp(email, 'creator_reset', { user_id: accounts[0].id })
  if (!issued.ok) return jsonResponse({ error: issued.error || 'Failed to send reset code' }, 502, {}, [], origin)
  return jsonResponse({ status: 'verification_sent' }, 200, {}, [], origin)
}

const handleReset = async (req: Request) => {
  const origin = req.headers.get('origin')
  const body = await parseJson(req)
  const email = normalizeEmail(body.email)
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!validEmail(email) || !/^\d{6}$/.test(token) || !validPassword(password)) {
    return jsonResponse({ error: 'Valid email, 6-digit code, and 8+ character password are required' }, 400, {}, [], origin)
  }

  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&token=eq.${token}&purpose=eq.creator_reset&used=eq.false&select=*&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = lookup.ok ? await lookup.json().catch(() => []) : []
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!row || new Date(row.expires_at) < new Date()) {
    return jsonResponse({ error: 'Invalid or expired verification code' }, 400, {}, [], origin)
  }
  if ((row.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    return jsonResponse({ error: 'Too many attempts. Request a new reset code.' }, 429, {}, [], origin)
  }
  const userId = row.payload?.user_id
  const account = userId ? await getAccount(userId) : null
  if (!userId || account?.role !== 'creator') return jsonResponse({ error: 'Creator account not found' }, 404, {}, [], origin)

  const update = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ password }),
  })
  if (!update.ok) return jsonResponse({ error: 'Failed to update password' }, 500, {}, [], origin)
  await fetch(`${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ used: true }),
  })
  return jsonResponse({ status: 'password_updated' }, 200, {}, [], origin)
}


const EXCLUSIVE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

const fetchExclusiveRoomById = async (roomId: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(roomId || '')) return null
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_rooms?id=eq.${roomId}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

const hasExclusiveAccess = async (roomId: string, userId: string) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_active_exclusive_access`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ p_room_id: roomId, p_user_id: userId }),
  })
  if (!res.ok) return false
  const val = await res.json().catch(() => false)
  return val === true
}

const publicExclusiveRoom = async (
  row: Record<string, unknown>,
  extras: Record<string, unknown> = {},
) => {
  const thumbPath = String(row.thumbnail_path || '')
  const signed = thumbPath ? await signMediaPaths([thumbPath], 300) : {}
  return {
    id: row.id,
    name: row.name,
    thumbnail_url: signed[thumbPath] || '',
    entry_fee: Number(row.entry_fee_paise || 0) / 100,
    entry_fee_paise: Number(row.entry_fee_paise || 0),
    sort_order: Number(row.sort_order || 0),
    ...extras,
  }
}

const listCreatorExclusiveRooms = async (creatorId: string, viewerId?: string) => {
  // Public viewers cannot see exclusive rooms while the creator badge is inactive.
  if (viewerId !== creatorId && !(await creatorHasVerifiedBadge(creatorId))) {
    return []
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_rooms?creator_id=eq.${creatorId}&select=*&order=sort_order.asc`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const list = Array.isArray(rows) ? rows : []
  const out = []
  for (const row of list) {
    let hasAccess = viewerId ? row.creator_id === viewerId : false
    if (viewerId && !hasAccess) hasAccess = await hasExclusiveAccess(row.id, viewerId)
    out.push(await publicExclusiveRoom(row, { has_access: hasAccess }))
  }
  return out
}

const creatorSlugFor = async (creatorId: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${creatorId}&select=username,public_serial&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const p = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!p?.username) return ''
  return `${p.username}${String(p.public_serial).padStart(5, '0')}`
}

const decorateExclusivePosts = async (posts: Record<string, unknown>[], includeMedia: boolean) => {
  if (!includeMedia) {
    return posts.map((post) => ({
      id: post.id,
      public_id: post.public_id,
      room_id: post.room_id,
      caption: post.caption || '',
      media_type: post.media_type,
      media_url: '',
      media_urls: [],
      media_count: Array.isArray(post.media_paths) ? post.media_paths.length : 0,
      created_at: post.created_at,
    }))
  }
  const allPaths: string[] = []
  for (const post of posts) {
    for (const path of Array.isArray(post.media_paths) ? post.media_paths as string[] : []) {
      if (typeof path === 'string' && path) allPaths.push(path)
    }
  }
  const signed = await signMediaPaths(allPaths)
  return posts.map((post) => {
    const paths = Array.isArray(post.media_paths) ? post.media_paths as string[] : []
    const mediaUrls = paths.map((path) => signed[path] || '').filter(Boolean)
    return {
      id: post.id,
      public_id: post.public_id,
      room_id: post.room_id,
      caption: post.caption || '',
      media_type: post.media_type,
      media_url: mediaUrls[0] || '',
      media_urls: mediaUrls,
      media_count: paths.length,
      created_at: post.created_at,
    }
  })
}

const recordExclusiveSubscriptionPaid = async (
  sub: Record<string, unknown>,
  paymentId: string,
) => {
  const paidAt = new Date()
  const expiresAt = new Date(paidAt.getTime() + EXCLUSIVE_MONTH_MS)
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?id=eq.${sub.id}&status=eq.created`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'paid',
        razorpay_payment_id: paymentId,
        paid_at: paidAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        verified_at: paidAt.toISOString(),
      }),
    },
  )
  if (!updateRes.ok) return { ok: false as const, expires_at: null as string | null }
  const updated = await updateRes.json().catch(() => [])
  if (!Array.isArray(updated) || !updated.length) {
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?id=eq.${sub.id}&status=eq.paid&select=expires_at&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const rows = check.ok ? await check.json().catch(() => []) : []
    const row = Array.isArray(rows) && rows.length ? rows[0] : null
    return { ok: Boolean(row), expires_at: row?.expires_at || null }
  }
  await createNotification({
    user_id: sub.creator_id as string,
    actor_id: sub.user_id as string,
    type: 'purchase',
  }).catch(() => {})
  const room = await fetchExclusiveRoomById(String(sub.room_id || ''))
  notifyCreatorByEmail({
    creatorId: sub.creator_id as string,
    actorId: sub.user_id as string,
    kind: 'exclusive',
    amount: Number(sub.amount_paise || 0) / 100,
    roomName: room?.name || '',
  }).catch(() => {})
  return { ok: true as const, expires_at: expiresAt.toISOString() }
}

const handleListExclusiveRooms = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const rooms = await listCreatorExclusiveRooms(user.id, user.id)
  return jsonResponse({ rooms }, 200, {}, [], origin)
}

const handleCreateExclusiveRoom = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)

  const body = await parseJson(req)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const fee = Number(body.entry_fee)
  if (!name || name.length > 10) {
    return jsonResponse({ error: 'Room name must be 1–10 characters' }, 400, {}, [], origin)
  }
  if (!Number.isFinite(fee) || fee < 10) {
    return jsonResponse({ error: 'Monthly entry fee must be at least ₹10' }, 400, {}, [], origin)
  }
  const feePaise = Math.round(fee * 100)

  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_rooms?creator_id=eq.${user.id}&select=sort_order&order=sort_order.asc`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = existing.ok ? await existing.json().catch(() => []) : []
  const used = new Set((Array.isArray(rows) ? rows : []).map((r: { sort_order: number }) => r.sort_order))
  if (used.size >= 4) return jsonResponse({ error: 'Maximum 4 exclusive rooms' }, 400, {}, [], origin)
  let sortOrder = 0
  while (used.has(sortOrder) && sortOrder < 4) sortOrder++

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/exclusive_rooms`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify([{
      creator_id: user.id,
      name,
      entry_fee_paise: feePaise,
      sort_order: sortOrder,
      thumbnail_path: '',
    }]),
  })
  if (!insert.ok) {
    const errText = await insert.text().catch(() => '')
    console.error('Create exclusive room failed:', errText)
    if (/exclusive_room_limit/i.test(errText)) {
      return jsonResponse({ error: 'Maximum 4 exclusive rooms' }, 400, {}, [], origin)
    }
    return jsonResponse({ error: 'Failed to create room' }, 500, {}, [], origin)
  }
  const created = await insert.json().catch(() => [])
  const row = Array.isArray(created) && created.length ? created[0] : null
  if (!row) return jsonResponse({ error: 'Failed to create room' }, 500, {}, [], origin)
  return jsonResponse({ room: await publicExclusiveRoom(row, { has_access: true }) }, 200, {}, [], origin)
}

const handleUpdateExclusiveRoom = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)
  const body = await parseJson(req)
  const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : ''
  const room = await fetchExclusiveRoomById(roomId)
  if (!room || room.creator_id !== user.id) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name || name.length > 10) return jsonResponse({ error: 'Room name must be 1–10 characters' }, 400, {}, [], origin)
    update.name = name
  }
  if (body.entry_fee != null) {
    const fee = Number(body.entry_fee)
    if (!Number.isFinite(fee) || fee < 10) return jsonResponse({ error: 'Monthly entry fee must be at least ₹10' }, 400, {}, [], origin)
    update.entry_fee_paise = Math.round(fee * 100)
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_rooms?id=eq.${roomId}&creator_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=representation' },
      body: JSON.stringify(update),
    },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to update room' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!row) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)
  return jsonResponse({ room: await publicExclusiveRoom(row, { has_access: true }) }, 200, {}, [], origin)
}

const handleExclusiveThumbnailUpload = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)
  const body = await parseJson(req)
  const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : ''
  const room = await fetchExclusiveRoomById(roomId)
  if (!room || room.creator_id !== user.id) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)
  const contentType = typeof body.content_type === 'string' ? body.content_type : ''
  const size = Number(body.size)
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(contentType)) {
    return jsonResponse({ error: 'Thumbnail must be JPG, PNG, or WEBP' }, 400, {}, [], origin)
  }
  if (!Number.isFinite(size) || size <= 0 || size > 5 * 1024 * 1024) {
    return jsonResponse({ error: 'Thumbnail must be under 5MB' }, 400, {}, [], origin)
  }
  const ext = mediaExtension(contentType)
  const path = `${user.id}/exclusive/${roomId}/thumb.${ext}`
  const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${POST_MEDIA_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({}),
  })
  if (!signRes.ok) return jsonResponse({ error: 'Failed to prepare thumbnail upload' }, 500, {}, [], origin)
  const signed = await signRes.json().catch(() => null)
  if (!signed?.url) return jsonResponse({ error: 'Failed to prepare thumbnail upload' }, 500, {}, [], origin)
  return jsonResponse({ upload_url: `${SUPABASE_URL}/storage/v1${signed.url}`, path }, 200, {}, [], origin)
}

const handleExclusiveThumbnailConfirm = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)
  const body = await parseJson(req)
  const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : ''
  const path = typeof body.path === 'string' ? body.path.trim() : ''
  const room = await fetchExclusiveRoomById(roomId)
  if (!room || room.creator_id !== user.id) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)
  if (!path.startsWith(`${user.id}/exclusive/${roomId}/`)) {
    return jsonResponse({ error: 'Invalid thumbnail path' }, 400, {}, [], origin)
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_rooms?id=eq.${roomId}&creator_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=representation' },
      body: JSON.stringify({ thumbnail_path: path, updated_at: new Date().toISOString() }),
    },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to save thumbnail' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  return jsonResponse({ room: row ? await publicExclusiveRoom(row, { has_access: true }) : null }, 200, {}, [], origin)
}

const handleGetExclusiveRoom = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  const roomId = (url.searchParams.get('id') || '').trim()
  const room = await fetchExclusiveRoomById(roomId)
  if (!room) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)

  const isOwner = Boolean(user?.id && room.creator_id === user.id)
  if (!isOwner && !(await creatorHasVerifiedBadge(room.creator_id))) {
    return contentLockedResponse(origin)
  }
  const hasAccess = user?.id ? (isOwner || await hasExclusiveAccess(roomId, user.id)) : false
  const slug = await creatorSlugFor(room.creator_id)

  let expiresAt: string | null = null
  if (user?.id && hasAccess && !isOwner) {
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?room_id=eq.${roomId}&user_id=eq.${user.id}&status=eq.paid&select=expires_at&order=expires_at.desc&limit=1`,
      { headers: { ...authHeaders(true) } },
    )
    const subs = subRes.ok ? await subRes.json().catch(() => []) : []
    expiresAt = Array.isArray(subs) && subs[0]?.expires_at ? subs[0].expires_at : null
  }

  let posts: unknown[] = []
  let postCount = 0
  if (hasAccess) {
    const postsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_room_posts?room_id=eq.${roomId}&select=*&order=created_at.desc&limit=100`,
      { headers: { ...authHeaders(true) } },
    )
    const postRows = postsRes.ok ? await postsRes.json().catch(() => []) : []
    posts = await decorateExclusivePosts(Array.isArray(postRows) ? postRows : [], true)
    postCount = posts.length
  } else {
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_room_posts?room_id=eq.${roomId}&select=id`,
      { method: 'HEAD', headers: { ...authHeaders(true), Prefer: 'count=exact', Range: '0-0' } },
    )
    const total = (countRes.headers.get('content-range') || '').split('/')[1]
    postCount = total && total !== '*' ? Number(total) || 0 : 0
  }

  return jsonResponse({
    room: await publicExclusiveRoom(room, {
      has_access: hasAccess,
      expires_at: expiresAt,
      creator_slug: slug,
      creator_id: room.creator_id,
      post_count: postCount,
    }),
    posts,
    post_count: postCount,
    has_access: hasAccess,
    is_owner: isOwner,
  }, 200, {}, [], origin)
}

const handleExclusiveRoomUploadUrls = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)
  const body = await parseJson(req)
  const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : ''
  const room = await fetchExclusiveRoomById(roomId)
  if (!room || room.creator_id !== user.id) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)

  const mediaType = body.media_type === 'video' ? 'video' : body.media_type === 'image' ? 'image' : null
  const files = Array.isArray(body.files) ? body.files : []
  if (!mediaType) return jsonResponse({ error: 'media_type must be image or video' }, 400, {}, [], origin)
  if (!files.length) return jsonResponse({ error: 'No files provided' }, 400, {}, [], origin)
  if (mediaType === 'image') {
    if (files.length > MAX_IMAGES_PER_POST) return jsonResponse({ error: `Maximum ${MAX_IMAGES_PER_POST} images` }, 400, {}, [], origin)
    for (const file of files) {
      if (!POST_IMAGE_TYPES.includes(file?.content_type)) return jsonResponse({ error: 'Only JPG or PNG images are allowed' }, 400, {}, [], origin)
      if (typeof file?.size !== 'number' || file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
        return jsonResponse({ error: 'Each image must be 50MB or smaller' }, 400, {}, [], origin)
      }
    }
  } else {
    if (files.length !== 1) return jsonResponse({ error: 'Exactly one video per post' }, 400, {}, [], origin)
    const file = files[0]
    if (typeof file?.content_type !== 'string' || !file.content_type.startsWith('video/')) {
      return jsonResponse({ error: 'Only video files are allowed' }, 400, {}, [], origin)
    }
    if (typeof file?.size !== 'number' || file.size <= 0 || file.size > MAX_VIDEO_SIZE) {
      return jsonResponse({ error: 'Video must be 500MB or smaller' }, 400, {}, [], origin)
    }
  }

  const publicId = generatePostPublicId()
  const uploads: Array<{ path: string; upload_url: string; content_type: string }> = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = mediaExtension(file.content_type)
    const path = `${user.id}/exclusive/${roomId}/${publicId}/${i}.${ext}`
    const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${POST_MEDIA_BUCKET}/${path}`, {
      method: 'POST',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({}),
    })
    if (!signRes.ok) return jsonResponse({ error: 'Failed to prepare upload' }, 500, {}, [], origin)
    const signed = await signRes.json().catch(() => null)
    if (!signed?.url) return jsonResponse({ error: 'Failed to prepare upload' }, 500, {}, [], origin)
    uploads.push({ path, upload_url: `${SUPABASE_URL}/storage/v1${signed.url}`, content_type: file.content_type })
  }
  return jsonResponse({ post_public_id: publicId, uploads }, 200, {}, [], origin)
}

const handleCreateExclusiveRoomPost = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(user.id))) return verificationRequiredResponse(origin)
  const body = await parseJson(req)
  const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : ''
  const room = await fetchExclusiveRoomById(roomId)
  if (!room || room.creator_id !== user.id) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)
  const publicId = typeof body.public_id === 'string' ? body.public_id.trim() : ''
  const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 500) : ''
  const mediaType = body.media_type === 'video' ? 'video' : body.media_type === 'image' ? 'image' : null
  const mediaPaths = Array.isArray(body.media_paths) ? body.media_paths.filter((p: unknown) => typeof p === 'string') : []
  if (!publicId || !mediaType || !mediaPaths.length) {
    return jsonResponse({ error: 'Invalid post payload' }, 400, {}, [], origin)
  }
  const prefix = `${user.id}/exclusive/${roomId}/${publicId}/`
  if (!mediaPaths.every((p: string) => p.startsWith(prefix))) {
    return jsonResponse({ error: 'Invalid media paths' }, 400, {}, [], origin)
  }

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/exclusive_room_posts`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify([{
      room_id: roomId,
      creator_id: user.id,
      public_id: publicId,
      caption,
      media_type: mediaType,
      media_paths: mediaPaths,
    }]),
  })
  if (!insert.ok) {
    console.error('Exclusive post create failed:', await insert.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to create post' }, 500, {}, [], origin)
  }
  const rows = await insert.json().catch(() => [])
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  const decorated = row ? (await decorateExclusivePosts([row], true))[0] : null
  return jsonResponse({ post: decorated }, 200, {}, [], origin)
}

const handleDeleteExclusiveRoomPost = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const publicId = typeof body.public_id === 'string' ? body.public_id.trim() : ''
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_posts?public_id=eq.${encodeURIComponent(publicId)}&creator_id=eq.${user.id}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const post = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)

  const paths = Array.isArray(post.media_paths) ? post.media_paths : []
  if (paths.length) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${POST_MEDIA_BUCKET}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({ prefixes: paths }),
    }).catch(() => {})
  }
  const del = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_posts?id=eq.${post.id}`,
    { method: 'DELETE', headers: { ...authHeaders(true) } },
  )
  if (!del.ok) return jsonResponse({ error: 'Failed to delete post' }, 500, {}, [], origin)
  return jsonResponse({ status: 'deleted' }, 200, {}, [], origin)
}

const handleGetExclusiveRoomPost = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const publicId = (url.searchParams.get('id') || '').trim()
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_posts?public_id=eq.${encodeURIComponent(publicId)}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const post = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!post) return jsonResponse({ error: 'Post not found' }, 404, {}, [], origin)
  const room = await fetchExclusiveRoomById(post.room_id)
  if (!room) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)
  if (room.creator_id !== user.id && !(await creatorHasVerifiedBadge(room.creator_id))) {
    return contentLockedResponse(origin)
  }
  const access = await hasExclusiveAccess(post.room_id, user.id)
  if (!access && room.creator_id !== user.id) return jsonResponse({ error: 'Exclusive access required' }, 403, {}, [], origin)
  const decorated = (await decorateExclusivePosts([post], true))[0]
  return jsonResponse({
    post: { ...decorated, room_name: room?.name || 'Exclusive' },
  }, 200, {}, [], origin)
}

const handleExclusiveRoomCheckout = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : ''
  const room = await fetchExclusiveRoomById(roomId)
  if (!room) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)
  if (!(await creatorHasVerifiedBadge(room.creator_id))) return contentLockedResponse(origin)
  if (room.creator_id === user.id) return jsonResponse({ already_unlocked: true }, 200, {}, [], origin)
  if (await hasExclusiveAccess(roomId, user.id)) return jsonResponse({ already_unlocked: true }, 200, {}, [], origin)
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: 'Payments are not configured yet' }, 503, {}, [], origin)
  }

  const amountPaise = Number(room.entry_fee_paise)
  const breakdown = computePlatformFeeBreakdown(amountPaise)
  const orderAmountPaise = breakdown.final_amount_paise
  const pendingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?room_id=eq.${roomId}&user_id=eq.${user.id}&status=eq.created&select=*&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const pendingRows = pendingRes.ok ? await pendingRes.json().catch(() => []) : []
  let pending = Array.isArray(pendingRows) && pendingRows.length ? pendingRows[0] : null

  if (pending?.razorpay_order_id) {
    const payments = await razorpayGet(`/orders/${encodeURIComponent(pending.razorpay_order_id)}/payments`)
    const items = Array.isArray(payments?.items) ? payments.items : []
    const captured = items.find((p: Record<string, unknown>) =>
      p.status === 'captured' && paymentMatchesExclusiveSub(p, pending, pending.razorpay_order_id),
    )
    if (captured?.id) {
      const recorded = await recordExclusiveSubscriptionPaid(pending, String(captured.id))
      if (recorded.ok) return jsonResponse({ already_unlocked: true }, 200, {}, [], origin)
    }

    // Reuse only when pending amount still matches current room fee.
    if (Number(pending.amount_paise) === amountPaise) {
      const orderLive = await razorpayGet(`/orders/${encodeURIComponent(pending.razorpay_order_id)}`)
      if (orderLive && Number(orderLive.amount) === orderAmountPaise) {
        return jsonResponse({
          order_id: pending.razorpay_order_id,
          key_id: RAZORPAY_KEY_ID,
          amount: orderAmountPaise,
          currency: 'INR',
          content_name: String(room.name || 'Exclusive Room').slice(0, 120),
          content_type: 'exclusive',
          content_amount_paise: breakdown.amount_paise,
          platform_fee_percent: PLATFORM_FEE_PERCENT,
          platform_fee_paise: breakdown.platform_fee_paise,
          final_amount_paise: breakdown.final_amount_paise,
        }, 200, {}, [], origin)
      }
    }

    // Fee changed or stale order — cancel pending and create a fresh order.
    await fetch(
      `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?id=eq.${pending.id}&status=eq.created`,
      {
        method: 'PATCH',
        headers: { ...authHeaders(true), Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'cancelled' }),
      },
    ).catch(() => {})
    pending = null
  }

  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: orderAmountPaise,
      currency: 'INR',
      receipt: `exr_${roomId.slice(0, 8)}_${Date.now()}`.slice(0, 40),
      notes: { type: 'exclusive_room', room_id: roomId, user_id: user.id, content_amount_paise: String(amountPaise), platform_fee_paise: String(breakdown.platform_fee_paise) },
    }),
  })
  if (!orderRes.ok) {
    console.error('Exclusive Razorpay order failed:', await orderRes.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to create payment order' }, 500, {}, [], origin)
  }
  const order = await orderRes.json().catch(() => null)
  if (!order?.id) return jsonResponse({ error: 'Failed to create payment order' }, 500, {}, [], origin)

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions`, {
    method: 'POST',
    headers: { ...authHeaders(true), Prefer: 'return=representation' },
    body: JSON.stringify([{
      room_id: roomId,
      user_id: user.id,
      creator_id: room.creator_id,
      amount_paise: amountPaise,
      razorpay_order_id: order.id,
      status: 'created',
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      platform_fee_paise: breakdown.platform_fee_paise,
      net_to_creator_paise: breakdown.net_to_creator_paise,
      final_amount_paise: breakdown.final_amount_paise,
    }]),
  })
  if (!insert.ok) {
    const errText = await insert.text().catch(() => '')
    console.error('Exclusive sub insert failed:', errText)
    // Race: another request created pending — reuse if amount matches.
    if (/duplicate|unique|idx_exclusive_subs_one_pending/i.test(errText)) {
      const again = await fetch(
        `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?room_id=eq.${roomId}&user_id=eq.${user.id}&status=eq.created&select=*&limit=1`,
        { headers: { ...authHeaders(true) } },
      )
      const rows = again.ok ? await again.json().catch(() => []) : []
      const row = Array.isArray(rows) && rows.length ? rows[0] : null
      if (row?.razorpay_order_id && Number(row.amount_paise) === amountPaise) {
        return jsonResponse({
          order_id: row.razorpay_order_id,
          key_id: RAZORPAY_KEY_ID,
          amount: orderAmountPaise,
          currency: 'INR',
          content_name: String(room.name || 'Exclusive Room').slice(0, 120),
          content_type: 'exclusive',
          content_amount_paise: breakdown.amount_paise,
          platform_fee_percent: PLATFORM_FEE_PERCENT,
          platform_fee_paise: breakdown.platform_fee_paise,
          final_amount_paise: breakdown.final_amount_paise,
        }, 200, {}, [], origin)
      }
    }
    return jsonResponse({ error: 'Failed to start checkout' }, 500, {}, [], origin)
  }

  return jsonResponse({
    order_id: order.id,
    key_id: RAZORPAY_KEY_ID,
    amount: orderAmountPaise,
    currency: 'INR',
    content_name: String(room.name || 'Exclusive Room').slice(0, 120),
    content_type: 'exclusive',
    content_amount_paise: breakdown.amount_paise,
    platform_fee_percent: PLATFORM_FEE_PERCENT,
    platform_fee_paise: breakdown.platform_fee_paise,
    final_amount_paise: breakdown.final_amount_paise,
  }, 200, {}, [], origin)
}

const handleExclusiveRoomVerifyPayment = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : ''
  const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id.trim() : ''
  const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id.trim() : ''
  const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature.trim() : ''
  if (!roomId || !orderId || !paymentId || !signature) {
    return jsonResponse({ error: 'Missing payment fields' }, 400, {}, [], origin)
  }
  if (!RAZORPAY_KEY_SECRET) return jsonResponse({ error: 'Payments not configured' }, 503, {}, [], origin)

  const expected = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`)
  if (expected !== signature) return jsonResponse({ error: 'Invalid payment signature' }, 400, {}, [], origin)

  const subRes = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?razorpay_order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${user.id}&room_id=eq.${roomId}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const subs = subRes.ok ? await subRes.json().catch(() => []) : []
  const sub = Array.isArray(subs) && subs.length ? subs[0] : null
  if (!sub) return jsonResponse({ error: 'Subscription order not found' }, 404, {}, [], origin)
  if (sub.status === 'paid') {
    return jsonResponse({ status: 'paid', expires_at: sub.expires_at }, 200, {}, [], origin)
  }
  if (sub.status !== 'created') {
    return jsonResponse({ error: 'Subscription is not awaiting payment' }, 400, {}, [], origin)
  }

  const live = await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`)
  if (!live || live.status !== 'captured' || !paymentMatchesExclusiveSub(live, sub, orderId)) {
    return jsonResponse({ error: 'Payment details did not match this subscription' }, 400, {}, [], origin)
  }

  const recorded = await recordExclusiveSubscriptionPaid(sub, paymentId)
  if (!recorded.ok) return jsonResponse({ error: 'Failed to activate access' }, 500, {}, [], origin)
  return jsonResponse({ status: 'paid', expires_at: recorded.expires_at }, 200, {}, [], origin)
}

const handleExclusiveRoomPaymentStatus = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const user = await requireUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const roomId = (url.searchParams.get('room_id') || '').trim()
  const room = await fetchExclusiveRoomById(roomId)
  if (!room) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)
  if (room.creator_id === user.id || await hasExclusiveAccess(roomId, user.id)) {
    return jsonResponse({ status: 'paid', has_access: true }, 200, {}, [], origin)
  }

  const orderFilter = url.searchParams.get('order_id')
  const orderClause = orderFilter ? `&razorpay_order_id=eq.${encodeURIComponent(orderFilter)}` : ''
  const subRes = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_subscriptions?room_id=eq.${roomId}&user_id=eq.${user.id}${orderClause}&select=*&order=created_at.desc&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = subRes.ok ? await subRes.json().catch(() => []) : []
  const sub = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!sub) return jsonResponse({ status: 'unpaid', has_access: false }, 200, {}, [], origin)
  if (sub.status === 'paid' && sub.expires_at && new Date(sub.expires_at) > new Date()) {
    return jsonResponse({ status: 'paid', has_access: true, expires_at: sub.expires_at }, 200, {}, [], origin)
  }
  if (sub.status !== 'created' || !sub.razorpay_order_id) {
    return jsonResponse({ status: 'unpaid', has_access: false }, 200, {}, [], origin)
  }
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ status: 'processing', has_access: false }, 200, {}, [], origin)
  }

  const payments = await razorpayGet(`/orders/${encodeURIComponent(sub.razorpay_order_id)}/payments`)
  const items = Array.isArray(payments?.items) ? payments.items : []
  const captured = items.find((payment: Record<string, unknown>) =>
    payment.status === 'captured' && paymentMatchesExclusiveSub(payment, sub, sub.razorpay_order_id),
  )
  if (captured?.id) {
    const recorded = await recordExclusiveSubscriptionPaid(sub, String(captured.id))
    if (recorded.ok) {
      return jsonResponse({ status: 'paid', has_access: true, expires_at: recorded.expires_at }, 200, {}, [], origin)
    }
    return jsonResponse({ status: 'processing', has_access: false }, 202, {}, [], origin)
  }
  const active = items.some((payment: Record<string, unknown>) =>
    ['authorized', 'created'].includes(String(payment.status))
      && paymentMatchesExclusiveSub(payment, sub, sub.razorpay_order_id),
  )
  return jsonResponse({
    status: active ? 'processing' : 'unpaid',
    has_access: false,
  }, 200, {}, [], origin)
}

const handleDeleteExclusiveRoom = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const body = await parseJson(req)
  const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : ''
  const room = await fetchExclusiveRoomById(roomId)
  if (!room || room.creator_id !== user.id) return jsonResponse({ error: 'Room not found' }, 404, {}, [], origin)

  const postsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_room_posts?room_id=eq.${roomId}&select=media_paths`,
    { headers: { ...authHeaders(true) } },
  )
  const postRows = postsRes.ok ? await postsRes.json().catch(() => []) : []
  const paths: string[] = []
  if (room.thumbnail_path) paths.push(String(room.thumbnail_path))
  for (const post of Array.isArray(postRows) ? postRows : []) {
    for (const p of Array.isArray(post.media_paths) ? post.media_paths : []) {
      if (typeof p === 'string' && p) paths.push(p)
    }
  }
  if (paths.length) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${POST_MEDIA_BUCKET}`, {
      method: 'DELETE',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({ prefixes: paths }),
    }).catch(() => {})
  }

  const del = await fetch(
    `${SUPABASE_URL}/rest/v1/exclusive_rooms?id=eq.${roomId}&creator_id=eq.${user.id}`,
    { method: 'DELETE', headers: { ...authHeaders(true) } },
  )
  if (!del.ok) return jsonResponse({ error: 'Failed to delete room' }, 500, {}, [], origin)
  return jsonResponse({ status: 'deleted' }, 200, {}, [], origin)
}

const handleGetCreatorVerification = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const [profileRes, verRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=is_verified,verification_public_id,verification_status&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/creator_verifications?user_id=eq.${user.id}&select=*&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
  ])
  const profiles = profileRes.ok ? await profileRes.json().catch(() => []) : []
  const rows = verRes.ok ? await verRes.json().catch(() => []) : []
  const profile = Array.isArray(profiles) && profiles.length ? profiles[0] : null
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  return jsonResponse({ verification: mapVerificationStatus(row, profile) }, 200, {}, [], origin)
}

const handleCreatorVerificationUploadUrls = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const limited = await enforceRateLimit(`verification-upload:${user.id}`, 20, 60 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)

  // Block uploads when already verified or waiting on admin preview.
  const profileGate = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=is_verified,verification_status&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const profileGateRows = profileGate.ok ? await profileGate.json().catch(() => []) : []
  const profileGateRow = Array.isArray(profileGateRows) && profileGateRows.length ? profileGateRows[0] : null
  if (profileGateRow?.is_verified === true && profileGateRow?.verification_status === 'verified') {
    return jsonResponse({ error: 'You are already verified' }, 400, {}, [], origin)
  }
  if (profileGateRow?.verification_status === 'pending') {
    return jsonResponse({
      error: 'Your badge request is on preview. Please wait for admin approval.',
      code: 'verification_pending',
    }, 400, {}, [], origin)
  }

  const body = await parseJson(req)
  const files = Array.isArray(body.files) ? body.files : []
  if (files.length !== 2) {
    return jsonResponse({ error: 'Both ID front and back uploads are required' }, 400, {}, [], origin)
  }

  const sides = new Set<string>()
  const uploads: Array<{ side: string; path: string; upload_url: string; content_type: string }> = []

  for (const file of files) {
    const side = file?.side === 'back' ? 'back' : file?.side === 'front' ? 'front' : ''
    if (!side) return jsonResponse({ error: 'Each file must specify side front or back' }, 400, {}, [], origin)
    if (sides.has(side)) return jsonResponse({ error: 'Duplicate ID side upload' }, 400, {}, [], origin)
    sides.add(side)
    const contentType = typeof file?.content_type === 'string' ? file.content_type : ''
    const size = Number(file?.size)
    if (!VERIFICATION_ID_TYPES.includes(contentType)) {
      return jsonResponse({ error: 'ID images must be JPG, PNG, or WebP' }, 400, {}, [], origin)
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_VERIFICATION_ID_SIZE) {
      return jsonResponse({ error: 'Each ID image must be 10MB or smaller' }, 400, {}, [], origin)
    }
    const ext = mediaExtension(contentType)
    const path = `${user.id}/${side}.${ext}`
    const signRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/upload/sign/${VERIFICATION_DOCS_BUCKET}/${path}`,
      {
        method: 'POST',
        headers: { ...authHeaders(true) },
        body: JSON.stringify({}),
      },
    )
    if (!signRes.ok) {
      console.error('Verification upload sign failed:', await signRes.text().catch(() => ''))
      return jsonResponse({ error: 'Failed to prepare ID upload' }, 500, {}, [], origin)
    }
    const signBody = await signRes.json().catch(() => ({}))
    if (!signBody?.url) return jsonResponse({ error: 'Failed to prepare ID upload' }, 500, {}, [], origin)
    uploads.push({
      side,
      path,
      upload_url: `${SUPABASE_URL}/storage/v1${signBody.url}`,
      content_type: contentType,
    })
  }

  if (!sides.has('front') || !sides.has('back')) {
    return jsonResponse({ error: 'Both ID front and back uploads are required' }, 400, {}, [], origin)
  }

  return jsonResponse({ uploads }, 200, {}, [], origin)
}

const handleSubmitCreatorVerification = async (req: Request) => {
  const origin = req.headers.get('origin')
  const user = await requireRole(req, 'creator')
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const limited = await enforceRateLimit(`verification-submit:${user.id}`, 8, 60 * 60 * 1000)
  if (!limited.ok) return jsonResponse({ error: limited.error }, 429, {}, [], origin)

  const body = await parseJson(req)
  const legalName = typeof body.legal_full_name === 'string' ? body.legal_full_name.trim() : ''
  const dob = typeof body.date_of_birth === 'string' ? body.date_of_birth.trim() : ''
  const frontPath = typeof body.id_front_path === 'string' ? body.id_front_path.trim() : ''
  const backPath = typeof body.id_back_path === 'string' ? body.id_back_path.trim() : ''
  const termsAccepted = body.terms_accepted === true

  if (legalName.length < 2 || legalName.length > 120) {
    return jsonResponse({ error: 'Enter your full legal name as on your government ID' }, 400, {}, [], origin)
  }
  if (!(await assertDobAtLeast18(dob))) {
    return jsonResponse({ error: 'You must be at least 18 years old to get a verification badge' }, 400, {}, [], origin)
  }
  if (!termsAccepted) {
    return jsonResponse({ error: 'You must accept the Terms of Service and Privacy Policy' }, 400, {}, [], origin)
  }
  if (!frontPath.startsWith(`${user.id}/front.`) || !backPath.startsWith(`${user.id}/back.`)) {
    return jsonResponse({ error: 'Invalid ID document paths' }, 400, {}, [], origin)
  }
  if (!/^[^/]+\/front\.[a-z0-9]+$/i.test(frontPath) || !/^[^/]+\/back\.[a-z0-9]+$/i.test(backPath)) {
    return jsonResponse({ error: 'Invalid ID document paths' }, 400, {}, [], origin)
  }

  const [existingProfileRes, existingVerRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=is_verified,verification_status,verification_public_id&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/creator_verifications?user_id=eq.${user.id}&select=*&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
  ])
  const existingRows = existingProfileRes.ok ? await existingProfileRes.json().catch(() => []) : []
  const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null
  if (existing?.is_verified === true && existing?.verification_status === 'verified') {
    return jsonResponse({ error: 'You are already verified' }, 400, {}, [], origin)
  }

  const existingVerRows = existingVerRes.ok ? await existingVerRes.json().catch(() => []) : []
  const prior = Array.isArray(existingVerRows) && existingVerRows.length ? existingVerRows[0] : null
  const priorStatus = String(prior?.status || '')

  // While waiting for admin on the 4th+ resubmit, do not allow another submit.
  if (priorStatus === 'pending') {
    return jsonResponse({
      error: 'Your badge request is on preview. Please wait for admin approval.',
      code: 'verification_pending',
    }, 400, {}, [], origin)
  }

  // Confirm both files exist in storage
  const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${VERIFICATION_DOCS_BUCKET}`, {
    method: 'POST',
    headers: { ...authHeaders(true) },
    body: JSON.stringify({ prefix: `${user.id}/`, limit: 50 }),
  })
  if (!listRes.ok) return jsonResponse({ error: 'Failed to verify ID uploads' }, 500, {}, [], origin)
  const objects = await listRes.json().catch(() => [])
  const names = new Set(
    (Array.isArray(objects) ? objects : []).map((obj: { name?: string }) => `${user.id}/${obj?.name || ''}`),
  )
  if (!names.has(frontPath) || !names.has(backPath)) {
    return jsonResponse({ error: 'ID front and back must be uploaded before submit' }, 400, {}, [], origin)
  }

  const publicId = prior?.public_id && /^[A-Za-z0-9]{12}$/.test(String(prior.public_id))
    ? String(prior.public_id)
    : generatePostPublicId()
  const now = new Date().toISOString()
  let autoCount = Number(prior?.auto_reverify_count || 0) || 0
  let nextStatus: 'verified' | 'pending' = 'verified'

  // First-time submit → immediate badge.
  // After suspend/reject: first 3 resubmits auto-verify; 4th+ stays pending for admin.
  const isResubmitAfterPenalty = priorStatus === 'suspended' || priorStatus === 'rejected'
  if (isResubmitAfterPenalty) {
    autoCount += 1
    nextStatus = autoCount <= MAX_AUTO_REVERIFIES ? 'verified' : 'pending'
  } else if (!prior) {
    nextStatus = 'verified'
    autoCount = 0
  } else {
    // Unverified edge / unknown prior without penalty → treat as first grant
    nextStatus = 'verified'
  }

  const badgeActive = nextStatus === 'verified'
  const payload = {
    user_id: user.id,
    public_id: publicId,
    legal_full_name: legalName,
    date_of_birth: dob,
    id_front_path: frontPath,
    id_back_path: backPath,
    terms_accepted_at: now,
    status: nextStatus,
    auto_reverify_count: autoCount,
    admin_note: nextStatus === 'pending' ? 'Awaiting admin approval (4th+ resubmit after suspension)' : '',
    reviewed_at: null,
    reviewed_by: null,
    submitted_at: now,
    updated_at: now,
  }

  let saved: Record<string, unknown> | null = null
  if (prior?.id) {
    const upd = await fetch(
      `${SUPABASE_URL}/rest/v1/creator_verifications?id=eq.${prior.id}`,
      {
        method: 'PATCH',
        headers: { ...authHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      },
    )
    if (!upd.ok) {
      console.error('Update verification failed:', await upd.text().catch(() => ''))
      return jsonResponse({ error: 'Failed to save verification' }, 500, {}, [], origin)
    }
    const rows = await upd.json().catch(() => [])
    saved = Array.isArray(rows) && rows.length ? rows[0] : null
  } else {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/creator_verifications`, {
      method: 'POST',
      headers: { ...authHeaders(true), Prefer: 'return=representation' },
      body: JSON.stringify([payload]),
    })
    if (!ins.ok) {
      console.error('Insert verification failed:', await ins.text().catch(() => ''))
      return jsonResponse({ error: 'Failed to save verification' }, 500, {}, [], origin)
    }
    const rows = await ins.json().catch(() => [])
    saved = Array.isArray(rows) && rows.length ? rows[0] : null
  }
  if (!saved) return jsonResponse({ error: 'Failed to save verification' }, 500, {}, [], origin)

  const profileUpd = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({
        is_verified: badgeActive,
        verification_public_id: publicId,
        verification_status: nextStatus,
        updated_at: now,
      }),
    },
  )
  if (!profileUpd.ok) {
    console.error('Profile verification flag failed:', await profileUpd.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to update verification status' }, 500, {}, [], origin)
  }

  return jsonResponse({
    verification: mapVerificationStatus(saved, {
      is_verified: badgeActive,
      verification_status: nextStatus,
      verification_public_id: publicId,
    }),
  }, 200, {}, [], origin)
}

const decorateAdminVerification = async (row: Record<string, unknown>, withDocs = false) => {
  const userId = String(row.user_id || '')
  const [profileRes, accountRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username,avatar_url,is_verified,verification_status&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${userId}&select=email,name&limit=1`,
      { headers: { ...authHeaders(true) } },
    ),
  ])
  const profiles = profileRes.ok ? await profileRes.json().catch(() => []) : []
  const accounts = accountRes.ok ? await accountRes.json().catch(() => []) : []
  const profile = Array.isArray(profiles) && profiles.length ? profiles[0] : {}
  const account = Array.isArray(accounts) && accounts.length ? accounts[0] : {}
  const status = String(row.status || 'verified')
  const autoCount = Number(row.auto_reverify_count || 0) || 0
  const base = {
    id: row.id,
    user_id: userId,
    public_id: row.public_id,
    legal_full_name: row.legal_full_name,
    date_of_birth: row.date_of_birth,
    status,
    badge_active: status === 'verified' && profile.is_verified === true && profile.verification_status === 'verified',
    username: profile.username || '',
    email: account.email || '',
    avatar_url: profile.avatar_url || '',
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at || null,
    admin_note: row.admin_note || '',
    auto_reverify_count: autoCount,
    auto_reverifies_remaining: Math.max(0, MAX_AUTO_REVERIFIES - autoCount),
    needs_admin_approval: status === 'pending',
  }
  if (!withDocs) return base
  const signed = await signVerificationPaths(
    [String(row.id_front_path || ''), String(row.id_back_path || '')],
    600,
  )
  return {
    ...base,
    id_front_url: signed[String(row.id_front_path || '')] || '',
    id_back_url: signed[String(row.id_back_path || '')] || '',
  }
}

const handleAdminVerifications = async (req: Request) => {
  const origin = req.headers.get('origin')
  const admin = await requireAdmin(req)
  if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/creator_verifications?select=*&order=submitted_at.desc&limit=200`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load verifications' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const list = Array.isArray(rows) ? rows : []
  const verifications = await Promise.all(list.map((row) => decorateAdminVerification(row, false)))
  return jsonResponse({ verifications }, 200, {}, [], origin)
}

const handleAdminVerificationDetail = async (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  const admin = await requireAdmin(req)
  if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)
  const id = (url.searchParams.get('id') || '').trim()
  if (!id) return jsonResponse({ error: 'Missing id' }, 400, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/creator_verifications?id=eq.${id}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  if (!res.ok) return jsonResponse({ error: 'Failed to load verification' }, 500, {}, [], origin)
  const rows = await res.json().catch(() => [])
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!row) return jsonResponse({ error: 'Not found' }, 404, {}, [], origin)
  return jsonResponse({ verification: await decorateAdminVerification(row, true) }, 200, {}, [], origin)
}

const handleAdminUpdateVerification = async (req: Request) => {
  const origin = req.headers.get('origin')
  const admin = await requireAdmin(req)
  if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401, {}, [], origin)

  const body = await parseJson(req)
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const action = ['approve', 'suspend', 'restore', 'reject'].includes(body.action) ? body.action : ''
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
  if (!id || !action) return jsonResponse({ error: 'id and action are required' }, 400, {}, [], origin)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/creator_verifications?id=eq.${id}&select=*&limit=1`,
    { headers: { ...authHeaders(true) } },
  )
  const rows = res.ok ? await res.json().catch(() => []) : []
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!row) return jsonResponse({ error: 'Not found' }, 404, {}, [], origin)

  const now = new Date().toISOString()
  let nextStatus = String(row.status)
  if (action === 'approve' || action === 'restore') nextStatus = 'verified'
  else if (action === 'suspend') nextStatus = 'suspended'
  else if (action === 'reject') nextStatus = 'rejected'
  const badgeActive = nextStatus === 'verified'

  const upd = await fetch(
    `${SUPABASE_URL}/rest/v1/creator_verifications?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true), Prefer: 'return=representation' },
      body: JSON.stringify({
        status: nextStatus,
        admin_note: note,
        reviewed_at: now,
        reviewed_by: admin.id,
        updated_at: now,
      }),
    },
  )
  if (!upd.ok) return jsonResponse({ error: 'Failed to update verification' }, 500, {}, [], origin)
  const updatedRows = await upd.json().catch(() => [])
  const updated = Array.isArray(updatedRows) && updatedRows.length ? updatedRows[0] : null

  const profileUpd = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${row.user_id}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(true) },
      body: JSON.stringify({
        is_verified: badgeActive,
        verification_status: nextStatus,
        verification_public_id: row.public_id,
        updated_at: now,
      }),
    },
  )
  if (!profileUpd.ok) {
    console.error('Admin profile verification update failed:', await profileUpd.text().catch(() => ''))
    return jsonResponse({ error: 'Failed to update badge status' }, 500, {}, [], origin)
  }

  return jsonResponse({
    verification: await decorateAdminVerification(updated || { ...row, status: nextStatus, admin_note: note, reviewed_at: now }, true),
  }, 200, {}, [], origin)
}

serve(async (req) => {
  const response = await routeRequest(req)
  return attachAuthCookies(req, response)
})

const routeRequest = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req.headers.get('origin')) })
  }

  const url = new URL(req.url, `https://${req.headers.get('host') ?? 'localhost'}`)
  const path = url.pathname.replace(/\/+$|$/, '')
  const isRoute = (name: string) => path.endsWith(`/auth/${name}`) || path.endsWith(`/${name}`)

  if (isRoute('admin-login') && req.method === 'POST') return handleAdminLogin(req)
  if (isRoute('admin/stats') && req.method === 'GET') return handleAdminStats(req)
  if (isRoute('admin/users') && req.method === 'GET') return handleAdminUsers(req)
  if (isRoute('admin/user') && req.method === 'GET') return handleAdminUserDetail(req, url)
  if (isRoute('admin/posts') && req.method === 'GET') return handleAdminPosts(req)
  if (isRoute('admin/post') && req.method === 'GET') return handleAdminViewPost(req, url)
  if (isRoute('admin/posts/delete') && req.method === 'POST') return handleAdminDeletePost(req)
  if (isRoute('admin/support-tickets') && req.method === 'GET') return handleAdminSupportTickets(req)
  if (isRoute('admin/support-tickets/update') && req.method === 'POST') return handleAdminUpdateSupportTicket(req)
  if (isRoute('admin/reports/posts') && req.method === 'GET') return handleAdminPostReports(req)
  if (isRoute('admin/reports/users') && req.method === 'GET') return handleAdminUserReports(req)
  if (isRoute('admin/withdrawals') && req.method === 'GET') return handleAdminWithdrawals(req)
  if (isRoute('admin/withdrawals/complete') && req.method === 'POST') return handleAdminCompleteWithdrawal(req)
  if (isRoute('admin/payments') && req.method === 'GET') return handleAdminPayments(req)
  if (isRoute('admin/settlements') && req.method === 'GET') return handleAdminSettlements(req)
  if (isRoute('admin/verifications') && req.method === 'GET') return handleAdminVerifications(req)
  if (isRoute('admin/verification') && req.method === 'GET') return handleAdminVerificationDetail(req, url)
  if (isRoute('admin/verifications/update') && req.method === 'POST') return handleAdminUpdateVerification(req)
  if (isRoute('creator-verification') && req.method === 'GET') return handleGetCreatorVerification(req)
  if (isRoute('creator-verification/upload-urls') && req.method === 'POST') return handleCreatorVerificationUploadUrls(req)
  if (isRoute('creator-verification/submit') && req.method === 'POST') return handleSubmitCreatorVerification(req)
  if (isRoute('login') && req.method === 'POST') return handleLogin(req)
  if (isRoute('user-login') && req.method === 'POST') return handleUserLogin(req)
  if (isRoute('user-signup') && req.method === 'POST') return handleUserSignup(req)
  if (isRoute('user-verify') && req.method === 'POST') return handleUserVerify(req)
  if (isRoute('user-resend') && req.method === 'POST') return handleUserResend(req)
  if (isRoute('user-forgot') && req.method === 'POST') return handleUserForgot(req)
  if (isRoute('user-reset') && req.method === 'POST') return handleUserReset(req)
  if (isRoute('logout') && req.method === 'POST') return handleLogout(req)
  if (isRoute('session') && req.method === 'GET') return handleSession(req)
  if (isRoute('signup') && req.method === 'POST') return handleSignup(req)
  if (isRoute('username-check') && req.method === 'GET') return handleUsernameCheck(req, url)
  if (isRoute('resend') && req.method === 'POST') return handleResend(req)
  if (isRoute('verify') && req.method === 'POST') return handleVerify(req)
  if (isRoute('forgot') && req.method === 'POST') return handleForgot(req)
  if (isRoute('reset') && req.method === 'POST') return handleReset(req)
  if (isRoute('profile') && req.method === 'GET') return handleGetProfile(req)
  if (isRoute('profile') && req.method === 'POST') return handleProfile(req)
  if (isRoute('post-upload-urls') && req.method === 'POST') return handlePostUploadUrls(req)
  if (isRoute('posts') && req.method === 'POST') return handleCreatePost(req)
  if (isRoute('exclusive-rooms/update') && req.method === 'POST') return handleUpdateExclusiveRoom(req)
  if (isRoute('exclusive-rooms/thumbnail-upload') && req.method === 'POST') return handleExclusiveThumbnailUpload(req)
  if (isRoute('exclusive-rooms/thumbnail-confirm') && req.method === 'POST') return handleExclusiveThumbnailConfirm(req)
  if (isRoute('exclusive-rooms') && req.method === 'GET') return handleListExclusiveRooms(req)
  if (isRoute('exclusive-rooms') && req.method === 'POST') return handleCreateExclusiveRoom(req)
  if (isRoute('exclusive-room') && req.method === 'GET') return handleGetExclusiveRoom(req, url)
  if (isRoute('exclusive-room-upload-urls') && req.method === 'POST') return handleExclusiveRoomUploadUrls(req)
  if (isRoute('exclusive-room-posts/delete') && req.method === 'POST') return handleDeleteExclusiveRoomPost(req)
  if (isRoute('exclusive-room-posts') && req.method === 'POST') return handleCreateExclusiveRoomPost(req)
  if (isRoute('exclusive-room-post') && req.method === 'GET') return handleGetExclusiveRoomPost(req, url)
  if (isRoute('exclusive-room-checkout') && req.method === 'POST') return handleExclusiveRoomCheckout(req)
  if (isRoute('exclusive-room-verify-payment') && req.method === 'POST') return handleExclusiveRoomVerifyPayment(req)
  if (isRoute('exclusive-room-payment-status') && req.method === 'GET') return handleExclusiveRoomPaymentStatus(req, url)
  if (isRoute('exclusive-rooms/delete') && req.method === 'POST') return handleDeleteExclusiveRoom(req)
  if (isRoute('payout-account') && req.method === 'GET') return handleGetPayoutAccount(req)
  if (isRoute('payout-account') && req.method === 'POST') return handleSavePayoutAccount(req)
  if (isRoute('wallet') && req.method === 'GET') return handleGetWallet(req)
  if (isRoute('wallet-withdraw') && req.method === 'POST') return handleWalletWithdraw(req)
  if (isRoute('admin-wallet-withdraw') && req.method === 'POST') return handleAdminWalletWithdraw(req)
  if (isRoute('support-tickets') && req.method === 'GET') return handleGetSupportTickets(req)
  if (isRoute('support-tickets') && req.method === 'POST') return handleCreateSupportTicket(req)
  if (isRoute('post') && req.method === 'GET') return handleGetPost(req, url)
  if (isRoute('secure-media') && req.method === 'GET') return handleSecureMedia(req, url)
  if (isRoute('post-like') && req.method === 'POST') return handleTogglePostLike(req)
  if (isRoute('post-update') && req.method === 'POST') return handleUpdatePost(req)
  if (isRoute('post-delete') && req.method === 'POST') return handleDeletePost(req)
  if (isRoute('post-report') && req.method === 'POST') return handleReportPost(req)
  if (isRoute('post-checkout') && req.method === 'POST') return handlePostCheckout(req)
  if (isRoute('post-verify-payment') && req.method === 'POST') return handleVerifyPostPayment(req)
  if (isRoute('post-payment-status') && req.method === 'GET') return handlePostPaymentStatus(req, url)
  if (isRoute('razorpay-webhook') && req.method === 'POST') return handleRazorpayWebhook(req)
  if (isRoute('live-streams') && req.method === 'POST') return handleLiveStreamCreate(req)
  if (isRoute('live-streams/mine') && req.method === 'GET') return handleLiveStreamListMine(req)
  if (isRoute('live-stream') && req.method === 'GET') return handleLiveStreamGet(req, url)
  if (isRoute('live-stream/start') && req.method === 'POST') return handleLiveStreamStart(req)
  if (isRoute('live-stream/end') && req.method === 'POST') return handleLiveStreamEnd(req)
  if (isRoute('live-stream/settings') && req.method === 'POST') return handleLiveStreamUpdateSettings(req)
  if (isRoute('live-stream/book-checkout') && req.method === 'POST') return handleLiveStreamBookCheckout(req)
  if (isRoute('live-stream/book-verify') && req.method === 'POST') return handleLiveStreamBookVerify(req)
  if (isRoute('live-stream/book-status') && req.method === 'GET') return handleLiveStreamBookStatus(req, url)
  if (isRoute('live-stream/gift-catalog') && req.method === 'GET') return handleLiveStreamGiftCatalog(req)
  if (isRoute('live-stream/gift-checkout') && req.method === 'POST') return handleLiveStreamGiftCheckout(req)
  if (isRoute('live-stream/gift-verify') && req.method === 'POST') return handleLiveStreamGiftVerify(req)
  if (isRoute('live-stream/heartbeat') && req.method === 'POST') return handleLiveStreamHeartbeat(req)
  if (isRoute('live-stream/chat') && req.method === 'GET') return handleLiveStreamChatList(req, url)
  if (isRoute('live-stream/chat') && req.method === 'POST') return handleLiveStreamChatSend(req)
  if (isRoute('live-stream/stats') && req.method === 'GET') return handleLiveStreamStats(req, url)
  if (isRoute('public-profile') && req.method === 'GET') return handlePublicProfile(req, url)
  if (isRoute('public-follow') && req.method === 'POST') return handlePublicFollow(req)
  if (isRoute('notifications') && req.method === 'GET') return handleGetNotifications(req)
  if (isRoute('notifications-read') && req.method === 'POST') return handleMarkNotificationsRead(req)
  if (isRoute('conversations') && req.method === 'GET') return handleGetConversations(req)
  if (isRoute('conversations') && req.method === 'POST') return handleCreateConversation(req)
  if (isRoute('conversation-accept') && req.method === 'POST') return handleAcceptConversation(req)
  if (isRoute('user-search') && req.method === 'GET') return handleUserSearch(req, url)
  if (isRoute('messages') && req.method === 'GET') return handleGetMessages(req, url)
  if (isRoute('messages') && req.method === 'POST') return handleSendMessage(req)
  if (isRoute('chat-upload-url') && req.method === 'POST') return handleChatUploadUrl(req)
  if (isRoute('message-view-once') && req.method === 'POST') return handleViewOnceMessage(req)
  if (isRoute('message-delete') && req.method === 'POST') return handleDeleteMessages(req)
  if (isRoute('chat-delete') && req.method === 'POST') return handleDeleteChat(req)
  if (isRoute('chat-block') && req.method === 'POST') return handleBlockUser(req)
  if (isRoute('chat-report') && req.method === 'POST') return handleReportUser(req)

  return jsonResponse({ error: 'Not Found' }, 404, {}, [], req.headers.get('origin'))
}
