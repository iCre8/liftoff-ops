import type {
  LearnerMessagePort,
  MessageRequest,
  MessageResult,
  TeamFollowUpPort,
} from './contracts';

export class FakeProviderError extends Error {
  constructor(
    readonly code: string,
    readonly permanent: boolean,
  ) {
    super(code);
  }
}

export class SanitizedFakeLearnerMessages implements LearnerMessagePort {
  readonly requests: MessageRequest[] = [];
  private readonly results = new Map<string, MessageResult>();

  constructor(private readonly failures = new Map<string, FakeProviderError>()) {}

  async send(request: MessageRequest): Promise<MessageResult> {
    const existing = this.results.get(request.idempotencyKey);
    if (existing) return existing;
    const failure = this.failures.get(request.idempotencyKey);
    if (failure) throw failure;
    this.requests.push(structuredClone(request));
    const result = {
      providerMessageId: `fake-message-${this.results.size + 1}`,
      acceptedAt: new Date(0).toISOString(),
    };
    this.results.set(request.idempotencyKey, result);
    return result;
  }
}

export class SanitizedFakeTeamFollowUp implements TeamFollowUpPort {
  readonly requests: Array<{
    idempotencyKey: string;
    learnerExternalId: string;
    incidentExternalId: string;
  }> = [];
  private readonly results = new Map<string, { providerTaskId: string }>();

  async createCallTask(request: {
    idempotencyKey: string;
    learnerExternalId: string;
    incidentExternalId: string;
  }): Promise<{ providerTaskId: string }> {
    const existing = this.results.get(request.idempotencyKey);
    if (existing) return existing;
    this.requests.push(structuredClone(request));
    const result = { providerTaskId: `fake-task-${this.results.size + 1}` };
    this.results.set(request.idempotencyKey, result);
    return result;
  }
}
