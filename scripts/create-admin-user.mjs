/**
 * One-time admin bootstrap. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 * Usage: node scripts/create-admin-user.mjs
 */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.AUTH_SUPABASE_URL || 'https://rytulzgsuzgicmpvrrxn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AUTH_SERVICE_ROLE_KEY;

const EMAIL = 'agtrenzecommerce@gmail.com';
const PASSWORD = 'Gizudio4.3@mfs';
const NAME = 'AKHIL P';

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (or AUTH_SERVICE_ROLE_KEY) in the environment.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const listUsers = async () => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers });
  if (!res.ok) throw new Error(`List users failed: ${await res.text()}`);
  const body = await res.json();
  return Array.isArray(body.users) ? body.users : [];
};

const createAuthUser = async () => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME, role: 'admin' },
    }),
  });
  if (!res.ok) throw new Error(`Create user failed: ${await res.text()}`);
  return res.json();
};

const upsertAccount = async (userId) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{
      id: userId,
      role: 'admin',
      name: NAME,
      email: EMAIL,
    }]),
  });
  if (!res.ok) throw new Error(`Upsert user_accounts failed: ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
};

const main = async () => {
  const existing = (await listUsers()).find((u) => String(u.email || '').toLowerCase() === EMAIL);
  let userId = existing?.id;
  if (!userId) {
    const created = await createAuthUser();
    userId = created.id || created.user?.id;
    console.log('Created auth user:', userId);
  } else {
    const update = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password: PASSWORD, email_confirm: true, user_metadata: { name: NAME, role: 'admin' } }),
    });
    if (!update.ok) throw new Error(`Update user failed: ${await update.text()}`);
    console.log('Updated existing auth user:', userId);
  }
  if (!userId) throw new Error('User id missing');
  await upsertAccount(userId);
  console.log('Admin ready.');
  console.log('Login URL: https://www.mallucupid.com/adminlogin');
  console.log(`Dashboard URL: https://www.mallucupid.com/admin${userId}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
