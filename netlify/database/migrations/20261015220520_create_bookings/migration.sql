CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"service_id" text NOT NULL,
	"service_name" text NOT NULL,
	"service_price" integer NOT NULL,
	"service_duration" integer NOT NULL,
	"booking_date" date NOT NULL,
	"booking_time" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"google_event_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bookings_date_idx" ON "bookings" ("booking_date");