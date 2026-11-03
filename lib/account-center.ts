
import { supabase } from '@/lib/supabase';
import { normalizeSocialLink, type SocialPlatform } from './social-links';

const listeners = new Set<() => void>();

export function subscribeAccountChanges(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function notifyAccountChanges() {
  for (const listener of listeners) {
    listener();
  }
}

export type Account = {
  user_id: string;
  email: string;
  is_private: boolean;
  show_social_links: boolean;
  deactivated: boolean;
  deleting: boolean;
};

// Get the currently logged-in user's account
export async function getAccount(): Promise<Account | null> {
  const { data, error } = await supabase.rpc('rollin_my_account');

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0] ?? null;
}

// Update profile privacy and social link visibility
export async function updatePrivacy(
  isPrivate: boolean,
  showSocial: boolean,
  expectedUserId: string
) {
  const { error } = await supabase.rpc('rollin_update_privacy', {
    private_profile: isPrivate,
    visible_social: showSocial,
    expected_user_id: expectedUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  notifyAccountChanges();
}

// Deactivate or reactivate the account
export async function setDeactivated(
  deactivate: boolean,
  expectedUserId: string
) {
  const { error } = await supabase.rpc('rollin_set_deactivated', {
    deactivate,
    expected_user_id: expectedUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  notifyAccountChanges();
}

// Load social links
export async function loadSocialLinks(userId: string) {
  const { data, error } = await supabase
    .from('profile_social_links')
    .select('platform,url')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as {
    platform: SocialPlatform;
    url: string;
  }[];
}

// Add or update a social link
export async function saveSocialLink(
  userId: string,
  platform: SocialPlatform,
  value: string
) {
  const url = normalizeSocialLink(platform, value);

  const { error } = await supabase
    .from('profile_social_links')
    .upsert(
      {
        user_id: userId,
        platform,
        url,
      },
      {
        onConflict: 'user_id,platform',
      }
    );

  if (error) {
    throw new Error(error.message);
  }

  notifyAccountChanges();
}

// Remove a social link
export async function removeSocialLink(
  userId: string,
  platform: SocialPlatform
) {
  const { error } = await supabase
    .from('profile_social_links')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform);

  if (error) {
    throw new Error(error.message);
  }

  notifyAccountChanges();
}

// Delete the user's account
export async function deleteMyAccount(
  password: string,
  confirmation: string,
  expectedUserId: string
) {
  const { data, error } = await supabase.functions.invoke(
    'account-actions',
    {
      body: {
        action: 'delete',
        password,
        confirmation,
        expected_user_id: expectedUserId,
      },
    }
  );

  if (error) {
    let message =
      'Unable to delete account. Check your connection and retry.';

    try {
      const result = await error.context?.json();

      if (typeof result?.error === 'string') {
        message = result.error;
      }
    } catch {
      // Keep the default message when error details are unavailable.
    }

    throw new Error(message);
  }

  if (data?.deleted !== true) {
    throw new Error(
      data?.error ?? 'Account deletion did not finish.'
    );
  }

  // Account deletion succeeded. Clear the local session.
  await supabase.auth.signOut({ scope: 'local' });

  notifyAccountChanges();
}
