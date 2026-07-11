import {
  doublePrecision,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", ["bkash", "nagad", "rocket"]);
export type Provider = (typeof providerEnum.enumValues)[number];
export const userRoleEnum = pgEnum("user_role", ["agent", "ops"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "cash_in",
  "cash_out",
  "send_money",
  "payment",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "success",
  "failed",
  "pending",
]);
export const daysOfInterestScopeEnum = pgEnum("days_of_interest_scope", ["global", "block"]);
export const alertTypeEnum = pgEnum("alert_type", ["liquidity", "anomaly"]);
export type AlertType = (typeof alertTypeEnum.enumValues)[number];
export const alertSeverityEnum = pgEnum("alert_severity", ["low", "medium", "high", "critical"]);
export type AlertSeverity = (typeof alertSeverityEnum.enumValues)[number];
export const alertStatusEnum = pgEnum("alert_status", [
  "open",
  "acknowledged",
  "escalated",
  "resolved",
]);
export const anomalyCategoryEnum = pgEnum("anomaly_category", [
  "velocity",
  "near_identical_amounts",
  "structuring",
  "circular",
  "balance_inconsistency",
  "other",
]);
export type AnomalyCategory = (typeof anomalyCategoryEnum.enumValues)[number];
export const caseEventTypeEnum = pgEnum("case_event_type", [
  "created",
  "assigned",
  "acknowledged",
  "note",
  "escalated",
  "resolved",
]);

export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  blockId: uuid("block_id")
    .notNull()
    .references(() => blocks.id),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  cashBalance: numeric("cash_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentProviderBalances = pgTable(
  "agent_provider_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    provider: providerEnum("provider").notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (table) => [uniqueIndex("agent_provider_unique").on(table.agentId, table.provider)],
);

export const parties = pgTable("parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  blockId: uuid("block_id").references(() => blocks.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  provider: providerEnum("provider").notNull(),
  partyId: uuid("party_id").references(() => parties.id),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  status: transactionStatusEnum("status").notNull().default("success"),
  cashBalanceAfter: numeric("cash_balance_after", { precision: 14, scale: 2 }).notNull(),
  providerBalanceAfter: numeric("provider_balance_after", { precision: 14, scale: 2 }).notNull(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  scenarioTag: text("scenario_tag"),
});

export const daysOfInterest = pgTable("days_of_interest", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: daysOfInterestScopeEnum("scope").notNull(),
  blockId: uuid("block_id").references(() => blocks.id),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  expectedMultiplier: numeric("expected_multiplier", { precision: 5, scale: 2 })
    .notNull()
    .default("1"),
  note: text("note"),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: alertTypeEnum("type").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  provider: providerEnum("provider"),
  blockId: uuid("block_id")
    .notNull()
    .references(() => blocks.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  banglishSummary: text("banglish_summary"),
  evidence: jsonb("evidence").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
  status: alertStatusEnum("status").notNull().default("open"),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  predictedShortageAt: timestamp("predicted_shortage_at"),
  category: anomalyCategoryEnum("category"),
  votes: jsonb("votes"),
  // Which simulation scenario (if any) tagged the transactions behind this alert's window —
  // lets the validation-metrics endpoint tell "flagged a deliberately-triggered scenario" apart
  // from "flagged ambient random-walk noise" without any manual labeling.
  scenarioTag: text("scenario_tag"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const caseEvents = pgTable("case_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id")
    .notNull()
    .references(() => alerts.id),
  type: caseEventTypeEnum("type").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Block = typeof blocks.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentProviderBalance = typeof agentProviderBalances.$inferSelect;
export type Party = typeof parties.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type DayOfInterest = typeof daysOfInterest.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type CaseEvent = typeof caseEvents.$inferSelect;
