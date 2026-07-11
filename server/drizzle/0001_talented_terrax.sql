CREATE TYPE "public"."alert_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'escalated', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('liquidity', 'anomaly');--> statement-breakpoint
CREATE TYPE "public"."anomaly_category" AS ENUM('velocity', 'near_identical_amounts', 'structuring', 'circular', 'balance_inconsistency', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_event_type" AS ENUM('created', 'assigned', 'acknowledged', 'note', 'escalated', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."days_of_interest_scope" AS ENUM('global', 'block');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('bkash', 'nagad', 'rocket');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('success', 'failed', 'pending');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('cash_in', 'cash_out', 'send_money', 'payment');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('agent', 'ops');--> statement-breakpoint
CREATE TABLE "agent_provider_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"provider" "provider" NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"block_id" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"cash_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "alert_type" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"agent_id" uuid NOT NULL,
	"provider" "provider",
	"block_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"owner_user_id" uuid,
	"predicted_shortage_at" timestamp,
	"category" "anomaly_category",
	"votes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"type" "case_event_type" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "days_of_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "days_of_interest_scope" NOT NULL,
	"block_id" uuid,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"expected_multiplier" numeric(5, 2) DEFAULT '1' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parties_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"provider" "provider" NOT NULL,
	"party_id" uuid,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status" "transaction_status" DEFAULT 'success' NOT NULL,
	"cash_balance_after" numeric(14, 2) NOT NULL,
	"provider_balance_after" numeric(14, 2) NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"scenario_tag" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "block_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_provider_balances" ADD CONSTRAINT "agent_provider_balances_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days_of_interest" ADD CONSTRAINT "days_of_interest_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_provider_unique" ON "agent_provider_balances" USING btree ("agent_id","provider");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;