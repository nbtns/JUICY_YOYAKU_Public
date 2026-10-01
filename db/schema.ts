import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
};

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role", { enum: ["member", "guardian", "admin"] }).notNull(),
  status: text("status", { enum: ["invited", "active", "locked", "disabled"] }).notNull().default("invited"),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  ...timestamps,
}, (table) => [uniqueIndex("accounts_email_unique").on(table.email)]);

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id),
  name: text("name").notNull(),
  birthDate: text("birth_date").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  experience: text("experience"),
  instrument: text("instrument"),
  desiredSongs: text("desired_songs"),
  notes: text("notes"),
  ...timestamps,
}, (table) => [index("students_account_idx").on(table.accountId), index("students_identity_idx").on(table.name, table.birthDate, table.phone)]);

export const guardians = sqliteTable("guardians", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  ...timestamps,
});

export const guardianStudents = sqliteTable("guardian_students", {
  guardianId: text("guardian_id").notNull().references(() => guardians.id),
  studentId: text("student_id").notNull().references(() => students.id),
}, (table) => [primaryKey({ columns: [table.guardianId, table.studentId] })]);

export const trialBookings = sqliteTable("trial_bookings", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull(),
  studentName: text("student_name").notNull(),
  birthDate: text("birth_date").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  experience: text("experience"),
  instrument: text("instrument"),
  desiredSong: text("desired_song"),
  notes: text("notes"),
  guardianName: text("guardian_name"),
  guardianContact: text("guardian_contact"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", { enum: ["confirmed", "completed", "cancelled", "no_show", "converted", "enrolled", "declined", "considering"] }).notNull().default("confirmed"),
  duplicateCandidate: integer("duplicate_candidate", { mode: "boolean" }).notNull().default(false),
  privacyConsentAt: integer("privacy_consent_at", { mode: "timestamp_ms" }).notNull(),
  cancellationConsentAt: integer("cancellation_consent_at", { mode: "timestamp_ms" }).notNull(),
  manageTokenHash: text("manage_token_hash"),
  ...timestamps,
}, (table) => [uniqueIndex("trial_reference_unique").on(table.reference), index("trial_starts_at_idx").on(table.startsAt), index("trial_identity_idx").on(table.studentName, table.birthDate, table.phone)]);

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  representativeStudentId: text("representative_student_id").notNull().references(() => students.id),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  ...timestamps,
});

export const groupMembers = sqliteTable("group_members", {
  groupId: text("group_id").notNull().references(() => groups.id),
  studentId: text("student_id").notNull().references(() => students.id),
  joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [primaryKey({ columns: [table.groupId, table.studentId] })]);

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  lessonType: text("lesson_type", { enum: ["individual", "group"] }).notNull(),
  groupId: text("group_id").references(() => groups.id),
  course: text("course", { enum: ["flex", "monthly3", "monthly4", "monthly8"] }).notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  status: text("status", { enum: ["pending", "active", "paused", "ended"] }).notNull().default("pending"),
  ...timestamps,
}, (table) => [index("contracts_student_idx").on(table.studentId), index("contracts_status_idx").on(table.status)]);

export const monthlyCredits = sqliteTable("monthly_credits", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull().references(() => contracts.id),
  month: text("month").notNull(),
  granted: integer("granted").notNull(),
  reserved: integer("reserved").notNull().default(0),
  completed: integer("completed").notNull().default(0),
  forfeited: integer("forfeited").notNull().default(0),
  expired: integer("expired").notNull().default(0),
  provisional: integer("provisional", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (table) => [uniqueIndex("monthly_credits_contract_month_unique").on(table.contractId, table.month)]);

export const makeupCredits = sqliteTable("makeup_credits", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  sourceBookingId: text("source_booking_id").notNull(),
  expiresOn: text("expires_on").notNull(),
  usedBookingId: text("used_booking_id"),
  status: text("status", { enum: ["available", "reserved", "used", "expired"] }).notNull().default("available"),
  ...timestamps,
});

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  studentId: text("student_id").references(() => students.id),
  groupId: text("group_id").references(() => groups.id),
  representativeStudentId: text("representative_student_id").references(() => students.id),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", { enum: ["confirmed", "completed", "cancelled_on_time", "cancelled_late", "no_show", "teacher_cancelled"] }).notNull().default("confirmed"),
  cancellationReason: text("cancellation_reason"),
  ...timestamps,
}, (table) => [index("bookings_starts_idx").on(table.startsAt), index("bookings_student_idx").on(table.studentId), index("bookings_group_idx").on(table.groupId)]);

export const reservationSlots = sqliteTable("reservation_slots", {
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).primaryKey(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  ownerType: text("owner_type", { enum: ["trial", "booking"] }).notNull(),
  ownerId: text("owner_id").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("reservation_slots_owner_idx").on(table.ownerType, table.ownerId)]);

export const bookingStudents = sqliteTable("booking_students", {
  bookingId: text("booking_id").notNull().references(() => bookings.id),
  studentId: text("student_id").notNull().references(() => students.id),
  monthlyCreditId: text("monthly_credit_id").references(() => monthlyCredits.id),
  makeupCreditId: text("makeup_credit_id").references(() => makeupCredits.id),
  attendanceStatus: text("attendance_status", { enum: ["reserved", "attended", "cancelled_on_time", "cancelled_late", "no_show"] }).notNull().default("reserved"),
}, (table) => [primaryKey({ columns: [table.bookingId, table.studentId] })]);

export const calendarBlocks = sqliteTable("calendar_blocks", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["holiday", "single", "recurring"] }).notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  recurrenceRule: text("recurrence_rule"),
  reason: text("reason").notNull(),
  ...timestamps,
}, (table) => [index("calendar_blocks_time_idx").on(table.startsAt, table.endsAt)]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull().references(() => contracts.id),
  month: text("month").notNull(),
  amount: integer("amount").notNull(),
  status: text("status", { enum: ["not_announced", "initial_pending", "active", "failed", "review_required", "paused", "cancelled"] }).notNull(),
  squareCustomerId: text("square_customer_id"),
  squareSubscriptionId: text("square_subscription_id"),
  squareInvoiceId: text("square_invoice_id"),
  failedAt: integer("failed_at", { mode: "timestamp_ms" }),
  graceEndsAt: integer("grace_ends_at", { mode: "timestamp_ms" }),
  ...timestamps,
}, (table) => [index("payments_contract_month_idx").on(table.contractId, table.month), index("payments_status_idx").on(table.status)]);

export const cashPayments = sqliteTable("cash_payments", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  kind: text("kind", { enum: ["enrollment", "flex"] }).notNull(),
  method: text("method", { enum: ["cash", "code"] }).notNull(),
  amount: integer("amount").notNull(),
  paidOn: text("paid_on").notNull(),
  handledByAccountId: text("handled_by_account_id").notNull().references(() => accounts.id),
  ...timestamps,
});

export const creditEvents = sqliteTable("credit_events", {
  id: text("id").primaryKey(),
  monthlyCreditId: text("monthly_credit_id").references(() => monthlyCredits.id),
  studentId: text("student_id").notNull().references(() => students.id),
  bookingId: text("booking_id").references(() => bookings.id),
  eventType: text("event_type", { enum: ["grant", "reserve", "release", "complete", "forfeit", "expire", "adjust"] }).notNull(),
  deltaReserved: integer("delta_reserved").notNull().default(0),
  deltaCompleted: integer("delta_completed").notNull().default(0),
  deltaForfeited: integer("delta_forfeited").notNull().default(0),
  deltaExpired: integer("delta_expired").notNull().default(0),
  reason: text("reason").notNull(),
  actorAccountId: text("actor_account_id").references(() => accounts.id),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("credit_events_idempotency_unique").on(table.idempotencyKey), index("credit_events_booking_idx").on(table.bookingId)]);

export const bookingEvents = sqliteTable("booking_events", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  bookingType: text("booking_type", { enum: ["trial", "member"] }).notNull(),
  eventType: text("event_type", { enum: ["created", "rescheduled", "cancelled_by_member", "completed", "no_show", "cancelled_by_teacher", "participant_cancelled", "restored"] }).notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  reason: text("reason"),
  actorAccountId: text("actor_account_id").references(() => accounts.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("booking_events_booking_idx").on(table.bookingType, table.bookingId)]);

export const idempotencyRequests = sqliteTable("idempotency_requests", {
  actorKey: text("actor_key").notNull(),
  scope: text("scope").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  entityId: text("entity_id"),
  responseJson: text("response_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [primaryKey({ columns: [table.actorKey, table.scope, table.idempotencyKey] })]);

export const rateLimitEvents = sqliteTable("rate_limit_events", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  clientHash: text("client_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("rate_limit_lookup_idx").on(table.action, table.clientHash, table.createdAt)]);

export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull().references(() => contracts.id),
  type: text("type", { enum: ["course_change", "pause", "withdrawal"] }).notNull(),
  requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
  effectiveMonth: text("effective_month").notNull(),
  details: text("details"),
  status: text("status", { enum: ["pending", "approved", "rejected", "completed"] }).notNull().default("pending"),
  squareCompletedAt: integer("square_completed_at", { mode: "timestamp_ms" }),
  ...timestamps,
});

export const notificationLogs = sqliteTable("notification_logs", {
  id: text("id").primaryKey(),
  channel: text("channel", { enum: ["email", "line"] }).notNull(),
  type: text("type").notNull(),
  recipient: text("recipient"),
  subject: text("subject"),
  status: text("status", { enum: ["scheduled", "sent", "failed", "manual_confirmed"] }).notNull(),
  providerId: text("provider_id"),
  error: text("error"),
  scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  ...timestamps,
}, (table) => [index("notification_status_idx").on(table.status, table.scheduledFor)]);

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  eventType: text("event_type").notNull(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  payloadHash: text("payload_hash").notNull(),
}, (table) => [uniqueIndex("webhook_provider_event_unique").on(table.provider, table.id)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorAccountId: text("actor_account_id").references(() => accounts.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  reason: text("reason"),
  ipHash: text("ip_hash"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)]);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedByAccountId: text("updated_by_account_id").references(() => accounts.id),
});
