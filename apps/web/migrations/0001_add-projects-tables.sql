ALTER TABLE "users" ADD COLUMN "airtable_cutter_id" text;

CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"assigned_user_id" text,
	"thumbnail" text,
	"duration" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "project_media" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"media_duration" integer,
	"fps" integer,
	"gcs_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_media" ENABLE ROW LEVEL SECURITY;
