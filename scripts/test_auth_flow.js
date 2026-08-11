(async function(){
  const path = await import('path');
  const { createClient } = await import('@supabase/supabase-js');
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const handler = null
  console.error('Test harness currently only supports Supabase function HTTP calls, not Amplify auth handler.')
  process.exit(1)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
    process.exit(1);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const email = `test+${Date.now()}@example.com`;
  const username = `testuser${Date.now()}`.slice(0,20);
  const password = 'Password123!';

  console.log('Signup:', email, username);

  // Call signup handler
  const signupEvent = { httpMethod: 'POST', headers: {}, body: JSON.stringify({ email, password, username }), rawPath: '/auth/signup' };
  const signupRes = await handler(signupEvent);
  console.log('signup handler response:', signupRes.statusCode, signupRes.body);

  // Wait and fetch verification row
  await new Promise(r=>setTimeout(r,2000));
  const { data: rows, error } = await admin.from('email_verifications').select('*').eq('email', email).eq('purpose','signup').order('created_at',{ascending:false}).limit(1);
  if (error) { console.error('Failed to query email_verifications', error); process.exit(1); }
  const row = rows && rows[0];
  if (!row) { console.error('No verification row found for', email); process.exit(1); }
  console.log('Found token:', row.token);

  // Call verify handler
  const verifyEvent = { httpMethod: 'POST', headers: {}, body: JSON.stringify({ token: row.token }), rawPath: '/auth/verify' };
  const verifyRes = await handler(verifyEvent);
  console.log('verify handler response:', verifyRes.statusCode, verifyRes.body);

  // Check profiles
  await new Promise(r=>setTimeout(r,1500));
  const { data: profs, error: pErr } = await admin.from('profiles').select('*').eq('username', username).limit(1);
  if (pErr) { console.error('Failed to query profiles', pErr); process.exit(1); }
  console.log('profiles found:', profs && profs.length ? profs[0] : null);

  process.exit(0);
})();
