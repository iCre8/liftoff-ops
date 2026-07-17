export interface AttendanceSheetRecord {
  learnerExternalId: string;
  sessionExternalId: string;
  sourceRow: number;
  checkInAt: string | null;
  exitTicketAt: string | null;
  excused: boolean;
  outcome: string | null;
  sourceVersion: string;
}

export interface AttendanceSheetWrite {
  learnerExternalId: string;
  sessionExternalId: string;
  expectedSourceVersion: string;
  outcome: string;
  note?: string;
}

export interface AttendanceSheetPort {
  readSession(sessionExternalId: string): Promise<readonly AttendanceSheetRecord[]>;
  writeOutcome(write: AttendanceSheetWrite): Promise<{ sourceVersion: string; changed: boolean }>;
}

export interface LearnerContext {
  learnerExternalId: string;
  missingAssignments: readonly string[];
  upcomingAssignments: readonly string[];
  upcomingPaymentSummary?: string;
}

export interface LearnerContextPort {
  getLearnerContext(learnerExternalId: string): Promise<LearnerContext>;
}

export interface MessageRequest {
  idempotencyKey: string;
  recipientExternalId: string;
  templateKey: string;
  templateVersion: number;
  approvedFields: Readonly<Record<string, string | number>>;
  renderedContent: string;
  subject?: string;
}

export interface MessageResult {
  providerMessageId: string;
  acceptedAt: string;
}

export interface LearnerMessagePort {
  send(request: MessageRequest): Promise<MessageResult>;
}

export interface TeamFollowUpPort {
  createCallTask(request: {
    idempotencyKey: string;
    learnerExternalId: string;
    incidentExternalId: string;
  }): Promise<{ providerTaskId: string }>;
}
