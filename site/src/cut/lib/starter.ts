// New accounts no longer get an auto-seeded starter project (see
// signup-grants.ts), but this id format still resolves the one an account
// seeded before that change already has — derived from the owner, so
// onboarding/page.tsx can address it straight from the session, no lookup.
export const starterProjectId = (userId: string) => `starter-${userId}`;
