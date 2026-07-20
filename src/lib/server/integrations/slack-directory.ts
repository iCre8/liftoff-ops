type FetchPort = typeof fetch;

export interface SlackDirectoryMatch {
  memberId: string;
  normalizedEmail: string;
}

export class SlackDirectory {
  constructor(
    private readonly botToken: string,
    private readonly http: FetchPort = fetch,
  ) {}

  async lookupByEmail(email: string): Promise<SlackDirectoryMatch> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('A normalized learner email is required');
    }

    const response = await this.http('https://slack.com/api/users.lookupByEmail', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.botToken}`,
        'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: new URLSearchParams({ email: normalizedEmail }),
    });
    if (!response.ok)
      throw new Error(`Slack directory request failed with HTTP ${response.status}`);

    const result = (await response.json()) as {
      ok?: boolean;
      error?: string;
      user?: {
        id?: string;
        deleted?: boolean;
        is_bot?: boolean;
        profile?: { email?: string };
      };
    };
    if (!result.ok || !result.user?.id) {
      throw new Error(
        `Slack directory lookup failed: ${(result.error ?? 'invalid_response').slice(0, 100)}`,
      );
    }
    if (result.user.deleted || result.user.is_bot) {
      throw new Error('Slack directory lookup returned an inactive or bot account');
    }
    if (result.user.profile?.email?.trim().toLowerCase() !== normalizedEmail) {
      throw new Error('Slack directory lookup returned a mismatched email');
    }

    return { memberId: result.user.id, normalizedEmail };
  }
}
