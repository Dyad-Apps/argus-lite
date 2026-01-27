CREATE TYPE "public"."activity_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."base_type" AS ENUM('Asset', 'Device', 'Person', 'Activity', 'Space');--> statement-breakpoint
CREATE TYPE "public"."connectivity_status" AS ENUM('online', 'offline', 'degraded');--> statement-breakpoint
CREATE TYPE "public"."identity_provider_type" AS ENUM('oidc', 'saml', 'google', 'microsoft', 'github', 'okta');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_status" AS ENUM('commissioning', 'active', 'maintenance', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."login_background_type" AS ENUM('default', 'solid', 'image', 'particles');--> statement-breakpoint
CREATE TYPE "public"."organization_plan" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('CONTAINED_IN', 'CHILD_OF', 'ADJACENT_TO', 'MONITORED_BY', 'CONTROLLED_BY', 'FED_BY', 'POWERED_BY', 'OWNED_BY', 'ASSIGNED_TO', 'RESPONSIBLE_FOR', 'DEPENDS_ON', 'BACKUP_FOR', 'PART_OF');--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('super_admin', 'support', 'billing');--> statement-breakpoint
CREATE TYPE "public"."telemetry_quality" AS ENUM('good', 'uncertain', 'bad');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_category" AS ENUM('authentication', 'authorization', 'user_management', 'organization_management', 'data_access', 'data_modification', 'system');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"avatar_url" varchar(500),
	"root_organization_id" uuid NOT NULL,
	"primary_organization_id" uuid NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"family_id" uuid NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"user_agent" varchar(500),
	"ip_address" varchar(45),
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "organization_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"logo_url" text,
	"logo_dark_url" text,
	"favicon_url" text,
	"primary_color" varchar(7),
	"accent_color" varchar(7),
	"login_background_type" "login_background_type" DEFAULT 'default' NOT NULL,
	"login_background_url" text,
	"login_background_color" varchar(7),
	"login_welcome_text" varchar(100),
	"login_subtitle" varchar(200),
	"custom_css" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_branding_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"org_code" varchar(50) NOT NULL,
	"parent_organization_id" uuid,
	"root_organization_id" uuid,
	"is_root" boolean DEFAULT false NOT NULL,
	"path" text,
	"depth" integer DEFAULT 0 NOT NULL,
	"can_have_children" boolean DEFAULT false NOT NULL,
	"subdomain" varchar(63),
	"plan" "organization_plan" DEFAULT 'free' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_organizations" (
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "organization_role" DEFAULT 'member' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invited_by" uuid,
	CONSTRAINT "user_organizations_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "organization_role" DEFAULT 'member' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "role_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role_name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"default_permission_level" varchar(50) DEFAULT 'view' NOT NULL,
	"default_permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"allowed_asset_types" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_role_def_tenant_name" UNIQUE("tenant_id","role_name")
);
--> statement-breakpoint
CREATE TABLE "type_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"inherits_from" "base_type" NOT NULL,
	"property_mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"semantic_tags" text[] DEFAULT '{}',
	"industry_vertical" varchar(100),
	"default_icon" varchar(50),
	"default_color" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_type_def_tenant_name" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type_definition_id" uuid,
	"base_type" "base_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"serial_number" varchar(100),
	"lifecycle_status" "lifecycle_status",
	"health_score" integer,
	"location_ref" uuid,
	"mac_address" varchar(50),
	"connectivity_status" "connectivity_status",
	"firmware_version" varchar(50),
	"last_seen" timestamp with time zone,
	"identity_id" varchar(255),
	"work_role" varchar(100),
	"proximity_ref" uuid,
	"shift_status" varchar(50),
	"activity_type" varchar(100),
	"start_timestamp" timestamp with time zone,
	"end_timestamp" timestamp with time zone,
	"owner_id" uuid,
	"target_entity_id" uuid,
	"activity_status" "activity_status",
	"cost" double precision,
	"parent_id" uuid,
	"space_type" varchar(50),
	"boundary_coordinates" jsonb,
	"environment_state" jsonb,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "entity_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"source_entity_type" "base_type" NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"target_entity_type" "base_type" NOT NULL,
	"relationship_type" "relationship_type" NOT NULL,
	"metadata" jsonb,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" "base_type" NOT NULL,
	"metric_key" varchar(100) NOT NULL,
	"value" double precision NOT NULL,
	"quality" "telemetry_quality" DEFAULT 'good',
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"permission_level" varchar(50) NOT NULL,
	"granted" boolean NOT NULL,
	"denial_reason" varchar(500),
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"entity_type" "base_type",
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_result" jsonb,
	"correlation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"category" "audit_category" NOT NULL,
	"action" varchar(100) NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255),
	"organization_id" uuid,
	"resource_type" varchar(100),
	"resource_id" varchar(255),
	"details" jsonb,
	"outcome" varchar(20) DEFAULT 'success' NOT NULL,
	"request_id" varchar(36),
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"type" "identity_provider_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(255),
	"config" jsonb NOT NULL,
	"allowed_domains" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"auto_create_users" boolean DEFAULT false NOT NULL,
	"auto_link_users" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_identity_providers_org_name" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"profile" jsonb,
	"access_token" varchar(2000),
	"refresh_token" varchar(2000),
	"token_expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_identities_provider_external" UNIQUE("provider_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "platform_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logo_url" text,
	"logo_dark_url" text,
	"favicon_url" text,
	"primary_color" varchar(7) DEFAULT '#1890FF',
	"accent_color" varchar(7),
	"login_background_type" varchar(20) DEFAULT 'particles' NOT NULL,
	"login_background_url" text,
	"login_welcome_text" varchar(100) DEFAULT 'Welcome',
	"login_subtitle" varchar(200) DEFAULT 'Sign in to your account',
	"terms_of_service_url" text,
	"privacy_policy_url" text,
	"support_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "system_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "system_role" DEFAULT 'support' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "system_admins_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_root_organization_id_organizations_id_fk" FOREIGN KEY ("root_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_primary_organization_id_organizations_id_fk" FOREIGN KEY ("primary_organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_branding" ADD CONSTRAINT "organization_branding_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_root_organization_id_organizations_id_fk" FOREIGN KEY ("root_organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_definitions" ADD CONSTRAINT "role_definitions_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_definitions" ADD CONSTRAINT "type_definitions_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_definitions" ADD CONSTRAINT "type_definitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_type_definition_id_type_definitions_id_fk" FOREIGN KEY ("type_definition_id") REFERENCES "public"."type_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_edges" ADD CONSTRAINT "entity_edges_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_edges" ADD CONSTRAINT "entity_edges_source_entity_id_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_edges" ADD CONSTRAINT "entity_edges_target_entity_id_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_history" ADD CONSTRAINT "telemetry_history_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_providers" ADD CONSTRAINT "identity_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_provider_id_identity_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."identity_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_branding" ADD CONSTRAINT "platform_branding_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_admins" ADD CONSTRAINT "system_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_admins" ADD CONSTRAINT "system_admins_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_root" ON "users" USING btree ("email","root_organization_id");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_users_root_org" ON "users" USING btree ("root_organization_id");--> statement-breakpoint
CREATE INDEX "idx_users_primary_org" ON "users" USING btree ("primary_organization_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_family_id" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token_hash" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_organizations_subdomain" ON "organizations" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "idx_organizations_parent" ON "organizations" USING btree ("parent_organization_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_root" ON "organizations" USING btree ("root_organization_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_org_code" ON "organizations" USING btree ("org_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_organizations_org_code_root" ON "organizations" USING btree ("org_code","root_organization_id");--> statement-breakpoint
CREATE INDEX "idx_projects_org" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_user_organizations_user_id" ON "user_organizations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_organizations_org_id" ON "user_organizations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_user_organizations_role" ON "user_organizations" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_org_invitations_org_id" ON "organization_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_invitations_email" ON "organization_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_org_invitations_token" ON "organization_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_org_invitations_status" ON "organization_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_type_def_tenant" ON "type_definitions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_type_def_base" ON "type_definitions" USING btree ("inherits_from");--> statement-breakpoint
CREATE INDEX "idx_entities_tenant" ON "entities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_entities_type" ON "entities" USING btree ("type_definition_id");--> statement-breakpoint
CREATE INDEX "idx_entities_base" ON "entities" USING btree ("base_type");--> statement-breakpoint
CREATE INDEX "idx_entities_health" ON "entities" USING btree ("health_score");--> statement-breakpoint
CREATE INDEX "idx_entities_location" ON "entities" USING btree ("location_ref");--> statement-breakpoint
CREATE INDEX "idx_entities_parent" ON "entities" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_edges_tenant" ON "entity_edges" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_edges_source" ON "entity_edges" USING btree ("source_entity_id");--> statement-breakpoint
CREATE INDEX "idx_edges_target" ON "entity_edges" USING btree ("target_entity_id");--> statement-breakpoint
CREATE INDEX "idx_edges_type" ON "entity_edges" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "idx_edges_source_type" ON "entity_edges" USING btree ("source_entity_id","relationship_type");--> statement-breakpoint
CREATE INDEX "idx_edges_target_type" ON "entity_edges" USING btree ("target_entity_id","relationship_type");--> statement-breakpoint
CREATE INDEX "idx_telemetry_entity_time" ON "telemetry_history" USING btree ("entity_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_telemetry_metric_time" ON "telemetry_history" USING btree ("metric_key","timestamp");--> statement-breakpoint
CREATE INDEX "idx_telemetry_composite" ON "telemetry_history" USING btree ("entity_id","metric_key","timestamp");--> statement-breakpoint
CREATE INDEX "idx_telemetry_tenant" ON "telemetry_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_permission_audit_person" ON "permission_audit_log" USING btree ("person_id","checked_at");--> statement-breakpoint
CREATE INDEX "idx_permission_audit_entity" ON "permission_audit_log" USING btree ("entity_id","checked_at");--> statement-breakpoint
CREATE INDEX "idx_permission_audit_tenant" ON "permission_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_events_unprocessed" ON "system_events" USING btree ("processed","created_at");--> statement-breakpoint
CREATE INDEX "idx_events_entity" ON "system_events" USING btree ("entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_events_type" ON "system_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_events_tenant" ON "system_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_events_correlation" ON "system_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_category" ON "audit_logs" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_identity_providers_org" ON "identity_providers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_identity_providers_type" ON "identity_providers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_user_identities_user" ON "user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_identities_provider" ON "user_identities" USING btree ("provider_id");