import type { Account, Learner, RoleAssignment } from '@prisma/client';

declare global {
  namespace App {
    interface Locals {
      account: (Account & { roles: RoleAssignment[]; learner: Learner | null }) | null;
    }
  }
}

export {};
