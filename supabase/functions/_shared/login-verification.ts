// Invoke with the caller's client (never the service-role client).
export async function requireVerifiedLogin(client: { rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }> }) {
  const { data, error } = await client.rpc('login_email_verified');
  return !error && data === true;
}
