export const SOCIAL_PLATFORMS = ['instagram','linkedin','facebook'] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];
const paths: Record<SocialPlatform, RegExp> = {
  instagram: /^\/[A-Za-z0-9_.-]+\/?$/,
  linkedin: /^\/(in|company)\/[A-Za-z0-9_%.-]+\/?$/,
  facebook: /^\/[A-Za-z0-9_.-]+\/?$/,
};
export function normalizeSocialLink(platform: SocialPlatform, value: string): string {
  const input = value.trim();
  if (input.length > 512) throw new Error('Keep the link under 512 characters.');
  const url = new URL(input.startsWith('https://') ? input : `https://${input}`);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
    || ![`${platform}.com`,`www.${platform}.com`].includes(url.hostname.toLowerCase()) || !paths[platform].test(url.pathname))
    throw new Error(`Use a ${platform}.com profile URL without extra parameters.`);
  return `https://${url.hostname.toLowerCase()}${url.pathname}`;
}
