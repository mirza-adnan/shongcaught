ALTER TYPE "public"."alert_type" ADD VALUE 'trend';--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "agent_id" DROP NOT NULL;