--
-- PostgreSQL database dump
--

\restrict jifbCbfDADsbKPM4Z8wYYhaBbOnPMK9vNLkJm88ELmMEWkiMmH6RnLUduM9nGPX

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: argus
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO argus;

--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: activity_status; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.activity_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.activity_status OWNER TO argus;

--
-- Name: audit_category; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.audit_category AS ENUM (
    'authentication',
    'authorization',
    'user_management',
    'organization_management',
    'data_access',
    'data_modification',
    'system'
);


ALTER TYPE public.audit_category OWNER TO argus;

--
-- Name: base_type; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.base_type AS ENUM (
    'Asset',
    'Device',
    'Person',
    'Activity',
    'Space'
);


ALTER TYPE public.base_type OWNER TO argus;

--
-- Name: connectivity_status; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.connectivity_status AS ENUM (
    'online',
    'offline',
    'degraded'
);


ALTER TYPE public.connectivity_status OWNER TO argus;

--
-- Name: identity_provider_type; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.identity_provider_type AS ENUM (
    'oidc',
    'saml',
    'google',
    'microsoft',
    'github',
    'okta'
);


ALTER TYPE public.identity_provider_type OWNER TO argus;

--
-- Name: impersonation_status; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.impersonation_status AS ENUM (
    'active',
    'ended',
    'expired',
    'revoked'
);


ALTER TYPE public.impersonation_status OWNER TO argus;

--
-- Name: invitation_status; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.invitation_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired',
    'cancelled'
);


ALTER TYPE public.invitation_status OWNER TO argus;

--
-- Name: lifecycle_status; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.lifecycle_status AS ENUM (
    'commissioning',
    'active',
    'maintenance',
    'decommissioned'
);


ALTER TYPE public.lifecycle_status OWNER TO argus;

--
-- Name: login_background_type; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.login_background_type AS ENUM (
    'default',
    'solid',
    'image',
    'particles'
);


ALTER TYPE public.login_background_type OWNER TO argus;

--
-- Name: organization_plan; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.organization_plan AS ENUM (
    'free',
    'starter',
    'professional',
    'enterprise'
);


ALTER TYPE public.organization_plan OWNER TO argus;

--
-- Name: organization_role; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.organization_role AS ENUM (
    'owner',
    'admin',
    'member',
    'viewer'
);


ALTER TYPE public.organization_role OWNER TO argus;

--
-- Name: profile_type; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.profile_type AS ENUM (
    'root',
    'child',
    'universal'
);


ALTER TYPE public.profile_type OWNER TO argus;

--
-- Name: relationship_type; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.relationship_type AS ENUM (
    'CONTAINED_IN',
    'CHILD_OF',
    'ADJACENT_TO',
    'MONITORED_BY',
    'CONTROLLED_BY',
    'FED_BY',
    'POWERED_BY',
    'OWNED_BY',
    'ASSIGNED_TO',
    'RESPONSIBLE_FOR',
    'DEPENDS_ON',
    'BACKUP_FOR',
    'PART_OF'
);


ALTER TYPE public.relationship_type OWNER TO argus;

--
-- Name: role_scope; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.role_scope AS ENUM (
    'organization',
    'children',
    'tree'
);


ALTER TYPE public.role_scope OWNER TO argus;

--
-- Name: role_source; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.role_source AS ENUM (
    'direct',
    'group',
    'sso',
    'inherited'
);


ALTER TYPE public.role_source OWNER TO argus;

--
-- Name: system_role; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.system_role AS ENUM (
    'super_admin',
    'support',
    'billing',
    'org_admin'
);


ALTER TYPE public.system_role OWNER TO argus;

--
-- Name: telemetry_quality; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.telemetry_quality AS ENUM (
    'good',
    'uncertain',
    'bad'
);


ALTER TYPE public.telemetry_quality OWNER TO argus;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: argus
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'inactive',
    'suspended',
    'deleted'
);


ALTER TYPE public.user_status OWNER TO argus;

--
-- Name: current_org_id(); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.current_org_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$;


ALTER FUNCTION public.current_org_id() OWNER TO argus;

--
-- Name: current_root_org_id(); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.current_root_org_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.current_root_org_id', true), '')::uuid;
$$;


ALTER FUNCTION public.current_root_org_id() OWNER TO argus;

--
-- Name: current_user_id(); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;


ALTER FUNCTION public.current_user_id() OWNER TO argus;

--
-- Name: ensure_single_primary_org(); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.ensure_single_primary_org() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE user_organizations
    SET is_primary = false
    WHERE user_id = NEW.user_id
    AND organization_id != NEW.organization_id
    AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_single_primary_org() OWNER TO argus;

--
-- Name: get_ancestor_org_ids(uuid); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.get_ancestor_org_ids(org_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM organizations
  WHERE (SELECT path FROM organizations WHERE id = org_id) <@ path;
$$;


ALTER FUNCTION public.get_ancestor_org_ids(org_id uuid) OWNER TO argus;

--
-- Name: get_descendant_org_ids(uuid); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.get_descendant_org_ids(org_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM organizations
  WHERE path <@ (SELECT path FROM organizations WHERE id = org_id);
$$;


ALTER FUNCTION public.get_descendant_org_ids(org_id uuid) OWNER TO argus;

--
-- Name: is_org_admin(uuid); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.is_org_admin(org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = current_user_id()
    AND organization_id = org_id
    AND role IN ('owner', 'admin')
  );
$$;


ALTER FUNCTION public.is_org_admin(org_id uuid) OWNER TO argus;

--
-- Name: is_org_member(uuid); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.is_org_member(org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations uo
    JOIN organizations o ON o.id = uo.organization_id
    WHERE uo.user_id = current_user_id()
    AND o.root_organization_id = (SELECT root_organization_id FROM organizations WHERE id = org_id)
    AND (
      uo.organization_id = org_id
      OR (SELECT path FROM organizations WHERE id = org_id) <@ o.path
    )
    AND (uo.expires_at IS NULL OR uo.expires_at > NOW())
  );
$$;


ALTER FUNCTION public.is_org_member(org_id uuid) OWNER TO argus;

--
-- Name: is_same_root_org(uuid); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.is_same_root_org(check_root_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT check_root_org_id = current_root_org_id();
$$;


ALTER FUNCTION public.is_same_root_org(check_root_org_id uuid) OWNER TO argus;

--
-- Name: update_organization_path(); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.update_organization_path() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  parent_path LTREE;
BEGIN
  IF NEW.is_root THEN
    NEW.path := NEW.slug::ltree;
    NEW.depth := 0;
    NEW.root_organization_id := NEW.id;
  ELSE
    SELECT path INTO parent_path FROM organizations WHERE id = NEW.parent_organization_id;
    NEW.path := parent_path || NEW.slug::ltree;
    NEW.depth := nlevel(NEW.path);

    -- Inherit root_organization_id from parent
    SELECT root_organization_id INTO NEW.root_organization_id
    FROM organizations WHERE id = NEW.parent_organization_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_organization_path() OWNER TO argus;

--
-- Name: user_can_access_org(uuid); Type: FUNCTION; Schema: public; Owner: argus
--

CREATE FUNCTION public.user_can_access_org(check_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations uo
    JOIN organizations o ON o.id = uo.organization_id
    WHERE uo.user_id = current_user_id()
    AND (
      -- Direct access to the org
      uo.organization_id = check_org_id
      -- Or org is descendant of user's accessible orgs
      OR (SELECT path FROM organizations WHERE id = check_org_id) <@ o.path
    )
    AND (uo.expires_at IS NULL OR uo.expires_at > NOW())
  );
$$;


ALTER FUNCTION public.user_can_access_org(check_org_id uuid) OWNER TO argus;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: argus
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO argus;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: argus
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO argus;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: argus
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    category public.audit_category NOT NULL,
    action character varying(100) NOT NULL,
    user_id uuid,
    user_email character varying(255),
    organization_id uuid,
    resource_type character varying(100),
    resource_id character varying(255),
    details jsonb,
    outcome character varying(20) DEFAULT 'success'::character varying NOT NULL,
    request_id character varying(36),
    ip_address character varying(45),
    user_agent character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO argus;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: argus
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO argus;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: argus
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: entities; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    type_definition_id uuid,
    base_type public.base_type NOT NULL,
    name character varying(255) NOT NULL,
    display_name character varying(255),
    serial_number character varying(100),
    lifecycle_status public.lifecycle_status,
    health_score integer,
    location_ref uuid,
    mac_address character varying(50),
    connectivity_status public.connectivity_status,
    firmware_version character varying(50),
    last_seen timestamp with time zone,
    identity_id character varying(255),
    work_role character varying(100),
    proximity_ref uuid,
    shift_status character varying(50),
    activity_type character varying(100),
    start_timestamp timestamp with time zone,
    end_timestamp timestamp with time zone,
    owner_id uuid,
    target_entity_id uuid,
    activity_status public.activity_status,
    cost double precision,
    parent_id uuid,
    space_type character varying(50),
    boundary_coordinates jsonb,
    environment_state jsonb,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.entities OWNER TO argus;

--
-- Name: entity_edges; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.entity_edges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_entity_id uuid NOT NULL,
    source_entity_type public.base_type NOT NULL,
    target_entity_id uuid NOT NULL,
    target_entity_type public.base_type NOT NULL,
    relationship_type public.relationship_type NOT NULL,
    metadata jsonb,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.entity_edges OWNER TO argus;

--
-- Name: group_role_assignments; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.group_role_assignments (
    group_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope public.role_scope,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid
);


ALTER TABLE public.group_role_assignments OWNER TO argus;

--
-- Name: TABLE group_role_assignments; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON TABLE public.group_role_assignments IS 'Role assignments to groups (inherited by group members)';


--
-- Name: identity_providers; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.identity_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    type public.identity_provider_type NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(255),
    config jsonb NOT NULL,
    allowed_domains jsonb,
    enabled boolean DEFAULT true NOT NULL,
    auto_create_users boolean DEFAULT false NOT NULL,
    auto_link_users boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.identity_providers OWNER TO argus;

--
-- Name: impersonation_sessions; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.impersonation_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    impersonator_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    organization_id uuid,
    reason text NOT NULL,
    status public.impersonation_status DEFAULT 'active'::public.impersonation_status NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    ip_address character varying(45),
    user_agent character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.impersonation_sessions OWNER TO argus;

--
-- Name: TABLE impersonation_sessions; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON TABLE public.impersonation_sessions IS 'Tracks admin/support user impersonation sessions for audit and security';


--
-- Name: organization_branding; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.organization_branding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    logo_url text,
    logo_dark_url text,
    favicon_url text,
    primary_color character varying(7),
    accent_color character varying(7),
    login_background_type public.login_background_type DEFAULT 'default'::public.login_background_type NOT NULL,
    login_background_url text,
    login_background_color character varying(7),
    login_welcome_text character varying(100),
    login_subtitle character varying(200),
    custom_css text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_branding OWNER TO argus;

--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.organization_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    role public.organization_role DEFAULT 'member'::public.organization_role NOT NULL,
    status public.invitation_status DEFAULT 'pending'::public.invitation_status NOT NULL,
    token_hash character varying(64) NOT NULL,
    invited_by uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_invitations OWNER TO argus;

--
-- Name: organization_profiles; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.organization_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    type public.profile_type DEFAULT 'universal'::public.profile_type NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    capabilities jsonb DEFAULT '{}'::jsonb,
    limits jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_profiles OWNER TO argus;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_code character varying(50) NOT NULL,
    parent_organization_id uuid,
    root_organization_id uuid,
    is_root boolean DEFAULT false NOT NULL,
    path public.ltree,
    depth integer DEFAULT 0 NOT NULL,
    can_have_children boolean DEFAULT false NOT NULL,
    subdomain character varying(63),
    plan public.organization_plan DEFAULT 'free'::public.organization_plan NOT NULL,
    settings jsonb,
    description character varying(1000),
    profile_id uuid,
    quota_overrides jsonb
);


ALTER TABLE public.organizations OWNER TO argus;

--
-- Name: COLUMN organizations.org_code; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.organizations.org_code IS 'Human-readable code for tenant switching UI (e.g., WALMART, REGION-NE). NOT used for login.';


--
-- Name: COLUMN organizations.root_organization_id; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.organizations.root_organization_id IS 'Reference to root organization. All data isolation uses this field.';


--
-- Name: COLUMN organizations.is_root; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.organizations.is_root IS 'True for top-level root organizations. Root orgs have subdomains and isolate all data.';


--
-- Name: COLUMN organizations.path; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.organizations.path IS 'LTREE path for efficient tree queries. Format: root.child.grandchild';


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO argus;

--
-- Name: permission_audit_log; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.permission_audit_log (
    id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    person_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    permission_level character varying(50) NOT NULL,
    granted boolean NOT NULL,
    denial_reason character varying(500),
    checked_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permission_audit_log OWNER TO argus;

--
-- Name: permission_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: argus
--

CREATE SEQUENCE public.permission_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permission_audit_log_id_seq OWNER TO argus;

--
-- Name: permission_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: argus
--

ALTER SEQUENCE public.permission_audit_log_id_seq OWNED BY public.permission_audit_log.id;


--
-- Name: platform_branding; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.platform_branding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logo_url text,
    logo_dark_url text,
    favicon_url text,
    primary_color character varying(7) DEFAULT '#1890FF'::character varying,
    accent_color character varying(7),
    login_background_type character varying(20) DEFAULT 'particles'::character varying NOT NULL,
    login_background_url text,
    login_welcome_text character varying(100) DEFAULT 'Welcome'::character varying,
    login_subtitle character varying(200) DEFAULT 'Sign in to your account'::character varying,
    terms_of_service_url text,
    privacy_policy_url text,
    support_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


ALTER TABLE public.platform_branding OWNER TO argus;

--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.platform_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    description text,
    is_secret boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.platform_settings OWNER TO argus;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(1000),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.projects OWNER TO argus;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    family_id uuid NOT NULL,
    is_revoked boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    user_agent character varying(500),
    ip_address character varying(45)
);


ALTER TABLE public.refresh_tokens OWNER TO argus;

--
-- Name: role_definitions; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.role_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    role_name character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    default_permission_level character varying(50) DEFAULT 'view'::character varying NOT NULL,
    default_permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    allowed_asset_types uuid[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_definitions OWNER TO argus;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    organization_id uuid,
    is_system boolean DEFAULT false NOT NULL,
    default_scope public.role_scope DEFAULT 'organization'::public.role_scope NOT NULL,
    permissions jsonb DEFAULT '{"resources": [], "menuAccess": []}'::jsonb,
    priority character varying(10) DEFAULT '0'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO argus;

--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON TABLE public.roles IS 'Role definitions including system roles and custom organization roles';


--
-- Name: COLUMN roles.organization_id; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.roles.organization_id IS 'NULL for system roles, organization ID for custom roles';


--
-- Name: COLUMN roles.is_system; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.roles.is_system IS 'System roles cannot be modified or deleted';


--
-- Name: COLUMN roles.default_scope; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.roles.default_scope IS 'Default scope for role assignments';


--
-- Name: system_admins; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.system_admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.system_role DEFAULT 'support'::public.system_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.system_admins OWNER TO argus;

--
-- Name: system_events; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.system_events (
    id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    event_type character varying(100) NOT NULL,
    entity_id uuid,
    entity_type public.base_type,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    processed_at timestamp with time zone,
    processing_result jsonb,
    correlation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_events OWNER TO argus;

--
-- Name: system_events_id_seq; Type: SEQUENCE; Schema: public; Owner: argus
--

CREATE SEQUENCE public.system_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_events_id_seq OWNER TO argus;

--
-- Name: system_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: argus
--

ALTER SEQUENCE public.system_events_id_seq OWNED BY public.system_events.id;


--
-- Name: telemetry_history; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.telemetry_history (
    id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    entity_type public.base_type NOT NULL,
    metric_key character varying(100) NOT NULL,
    value double precision NOT NULL,
    quality public.telemetry_quality DEFAULT 'good'::public.telemetry_quality,
    "timestamp" timestamp with time zone NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.telemetry_history OWNER TO argus;

--
-- Name: telemetry_history_id_seq; Type: SEQUENCE; Schema: public; Owner: argus
--

CREATE SEQUENCE public.telemetry_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.telemetry_history_id_seq OWNER TO argus;

--
-- Name: telemetry_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: argus
--

ALTER SEQUENCE public.telemetry_history_id_seq OWNED BY public.telemetry_history.id;


--
-- Name: type_definitions; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.type_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    name character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    inherits_from public.base_type NOT NULL,
    property_mappings jsonb DEFAULT '[]'::jsonb NOT NULL,
    semantic_tags text[] DEFAULT '{}'::text[],
    industry_vertical character varying(100),
    default_icon character varying(50),
    default_color character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.type_definitions OWNER TO argus;

--
-- Name: user_group_memberships; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.user_group_memberships (
    user_id uuid NOT NULL,
    group_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by uuid
);


ALTER TABLE public.user_group_memberships OWNER TO argus;

--
-- Name: TABLE user_group_memberships; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON TABLE public.user_group_memberships IS 'Junction table linking users to groups';


--
-- Name: user_groups; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.user_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.user_groups OWNER TO argus;

--
-- Name: TABLE user_groups; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON TABLE public.user_groups IS 'User groups for organizing users within organizations';


--
-- Name: user_identities; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.user_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    external_id character varying(255) NOT NULL,
    email character varying(255),
    profile jsonb,
    access_token character varying(2000),
    refresh_token character varying(2000),
    token_expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_identities OWNER TO argus;

--
-- Name: user_organizations; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.user_organizations (
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role public.organization_role DEFAULT 'member'::public.organization_role NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    invited_by uuid,
    is_primary boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone
);


ALTER TABLE public.user_organizations OWNER TO argus;

--
-- Name: COLUMN user_organizations.is_primary; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.user_organizations.is_primary IS 'True if this is the users default organization after login.';


--
-- Name: COLUMN user_organizations.expires_at; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.user_organizations.expires_at IS 'Optional expiration for time-limited access (e.g., contractor access).';


--
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.user_role_assignments (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    scope public.role_scope,
    source public.role_source DEFAULT 'direct'::public.role_source NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    expires_at timestamp with time zone
);


ALTER TABLE public.user_role_assignments OWNER TO argus;

--
-- Name: TABLE user_role_assignments; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON TABLE public.user_role_assignments IS 'Direct role assignments to users';


--
-- Name: COLUMN user_role_assignments.source; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.user_role_assignments.source IS 'How the role was assigned (direct, group, sso, inherited)';


--
-- Name: users; Type: TABLE; Schema: public; Owner: argus
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    first_name character varying(100),
    last_name character varying(100),
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    email_verified_at timestamp with time zone,
    last_login_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    root_organization_id uuid NOT NULL,
    primary_organization_id uuid NOT NULL,
    avatar_url character varying(500),
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_secret character varying(255)
);


ALTER TABLE public.users OWNER TO argus;

--
-- Name: COLUMN users.root_organization_id; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.users.root_organization_id IS 'The root organization this user belongs to. Same email can exist across different roots.';


--
-- Name: COLUMN users.primary_organization_id; Type: COMMENT; Schema: public; Owner: argus
--

COMMENT ON COLUMN public.users.primary_organization_id IS 'Default organization after login. Must be within root org hierarchy.';


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: argus
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: permission_audit_log id; Type: DEFAULT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.permission_audit_log ALTER COLUMN id SET DEFAULT nextval('public.permission_audit_log_id_seq'::regclass);


--
-- Name: system_events id; Type: DEFAULT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.system_events ALTER COLUMN id SET DEFAULT nextval('public.system_events_id_seq'::regclass);


--
-- Name: telemetry_history id; Type: DEFAULT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.telemetry_history ALTER COLUMN id SET DEFAULT nextval('public.telemetry_history_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: argus
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.audit_logs (id, category, action, user_id, user_email, organization_id, resource_type, resource_id, details, outcome, request_id, ip_address, user_agent, created_at) FROM stdin;
1	organization_management	create_root_organization	\N	\N	\N	organization	63d9b4b1-75ee-411a-b39f-8a60e6014f8f	{"name": "Argus", "orgCode": "ARGUS", "profileId": "f9982790-86c8-4bfe-9750-461aa58ee561", "subdomain": "argus", "adminEmail": "admin@argus.io", "domainType": "platform", "allowImpersonation": true, "allowWhiteLabeling": true}	success	\N	\N	\N	2026-01-25 03:07:33.449525+00
5	organization_management	create_root_organization	\N	\N	\N	organization	958a61d2-56bf-42c1-9b96-f32f68f8e68e	{"name": "Argus", "orgCode": "ARGUS", "profileId": "f9982790-86c8-4bfe-9750-461aa58ee561", "subdomain": "argus", "adminEmail": "addmin@argus.io", "domainType": "platform", "allowImpersonation": true, "allowWhiteLabeling": true}	success	\N	\N	\N	2026-01-25 03:16:23.599005+00
7	organization_management	create_root_organization	\N	\N	21c9d312-93cb-444d-b036-c92760f3ce91	organization	21c9d312-93cb-444d-b036-c92760f3ce91	{"name": "Argus", "orgCode": "ARGUS", "profileId": "f9982790-86c8-4bfe-9750-461aa58ee561", "subdomain": "argus", "adminEmail": "admin@argus.io", "domainType": "platform", "allowImpersonation": true, "allowWhiteLabeling": true}	success	\N	\N	\N	2026-01-25 03:56:48.885169+00
8	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Testing to see if the feature is working", "expiresAt": "2026-01-25T19:41:28.608Z", "sessionId": "d5e95350-c9fa-44d6-b295-039534426fb3", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-25 18:41:27.31675+00
9	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 554227, "sessionId": "d5e95350-c9fa-44d6-b295-039534426fb3"}	success	\N	\N	\N	2026-01-25 18:50:40.220353+00
10	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Testing impersonate", "expiresAt": "2026-01-25T19:21:08.407Z", "sessionId": "a67f73b3-94ea-4e99-86f7-6444839a618d", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-25 18:51:07.037045+00
11	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 232923, "sessionId": "a67f73b3-94ea-4e99-86f7-6444839a618d"}	success	\N	\N	\N	2026-01-25 18:54:59.559344+00
12	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Testing Impersonation", "expiresAt": "2026-01-25T20:04:57.743Z", "sessionId": "ceb5c161-3928-4082-8295-32871f5cbdb7", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-25 19:04:56.538617+00
13	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 19364, "sessionId": "ceb5c161-3928-4082-8295-32871f5cbdb7"}	success	\N	\N	\N	2026-01-25 19:05:16.398961+00
14	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Testing Organization access", "expiresAt": "2026-01-26T04:00:55.156Z", "sessionId": "26f7f08e-a5f5-40cf-926c-2da388850ae5", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-26 03:00:54.451088+00
15	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 384072, "sessionId": "26f7f08e-a5f5-40cf-926c-2da388850ae5"}	success	\N	\N	\N	2026-01-26 03:07:17.92905+00
16	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Testing White Labeling with impersonate", "expiresAt": "2026-01-26T04:19:04.255Z", "sessionId": "53f13edb-51db-4cf2-a616-88bde6fb0d71", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-26 03:19:03.291183+00
17	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 49577, "sessionId": "53f13edb-51db-4cf2-a616-88bde6fb0d71"}	success	\N	\N	\N	2026-01-26 03:19:51.281038+00
18	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "testing Imipersoante after changes", "expiresAt": "2026-01-26T17:21:01.239Z", "sessionId": "182e933e-726e-4bc0-b46f-54eb690a4461", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-26 17:06:00.253082+00
19	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 40219, "sessionId": "182e933e-726e-4bc0-b46f-54eb690a4461"}	success	\N	\N	\N	2026-01-26 17:06:40.222691+00
20	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Testing impersonation after home page changes", "expiresAt": "2026-01-26T23:38:35.051Z", "sessionId": "9573bc61-cb09-49ad-81fe-c2f77ac0a46e", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-26 22:38:33.573808+00
21	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	\N	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 44445, "sessionId": "9573bc61-cb09-49ad-81fe-c2f77ac0a46e"}	success	\N	\N	\N	2026-01-26 22:39:17.959578+00
22	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	21c9d312-93cb-444d-b036-c92760f3ce91	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Testing form Org tab", "expiresAt": "2026-01-26T23:41:05.664Z", "sessionId": "3407b73a-f7c4-4504-b530-5f89f6bf9fc2", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-26 23:26:06.29624+00
23	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	21c9d312-93cb-444d-b036-c92760f3ce91	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 14999390, "sessionId": "3407b73a-f7c4-4504-b530-5f89f6bf9fc2"}	success	\N	\N	\N	2026-01-27 03:36:04.636838+00
24	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	21c9d312-93cb-444d-b036-c92760f3ce91	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Testing Impersonate from Org", "expiresAt": "2026-01-27T04:37:57.629Z", "sessionId": "499957eb-f793-438e-ae5b-660ea62bec3c", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-27 03:37:56.875317+00
25	authentication	impersonation_ended	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	21c9d312-93cb-444d-b036-c92760f3ce91	user	4c575637-828b-4968-83a9-a26a883cf964	{"duration": 48226746, "sessionId": "499957eb-f793-438e-ae5b-660ea62bec3c"}	success	\N	\N	\N	2026-01-27 17:01:44.226325+00
26	organization_management	create_child_organization	\N	\N	79a14046-4b18-4dc1-8200-860b045f6498	organization	79a14046-4b18-4dc1-8200-860b045f6498	{"name": "Sub1Org1_L1", "orgCode": "S1O1L1", "parentId": "21c9d312-93cb-444d-b036-c92760f3ce91", "parentName": "MyArgus"}	success	\N	\N	\N	2026-01-27 17:16:19.301199+00
27	organization_management	create_child_organization	\N	\N	35d4f606-0dfd-4a77-967c-609ada19ff91	organization	35d4f606-0dfd-4a77-967c-609ada19ff91	{"name": "Sub2Org2_L1", "orgCode": "S2O2_L1", "parentId": "21c9d312-93cb-444d-b036-c92760f3ce91", "parentName": "MyArgus"}	success	\N	\N	\N	2026-01-27 17:35:17.921654+00
28	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	21c9d312-93cb-444d-b036-c92760f3ce91	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Impersonate child org", "expiresAt": "2026-01-27T19:22:05.087Z", "sessionId": "c1361915-2561-4667-b380-b87f3717f9f5", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-27 18:22:05.575003+00
29	authentication	impersonation_started	7ab806d5-b245-403e-bdb2-de6ee6987ae0	\N	21c9d312-93cb-444d-b036-c92760f3ce91	user	4c575637-828b-4968-83a9-a26a883cf964	{"reason": "Test impersonate overall", "expiresAt": "2026-01-27T19:58:55.987Z", "sessionId": "3b296b9e-2620-45ca-8f37-b5068872319c", "targetEmail": "admin@argus.io", "targetUserId": "4c575637-828b-4968-83a9-a26a883cf964"}	success	\N	\N	\N	2026-01-27 18:58:56.135407+00
30	organization_management	create_child_organization	\N	\N	e5b4b80a-29cb-4d38-b152-828bf0ed680b	organization	e5b4b80a-29cb-4d38-b152-828bf0ed680b	{"name": "Sub1Org1_L2", "orgCode": "S1O1L2", "parentId": "79a14046-4b18-4dc1-8200-860b045f6498", "parentName": "Sub1Org1_L1"}	success	\N	\N	\N	2026-01-27 19:08:46.418765+00
\.


--
-- Data for Name: entities; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.entities (id, tenant_id, type_definition_id, base_type, name, display_name, serial_number, lifecycle_status, health_score, location_ref, mac_address, connectivity_status, firmware_version, last_seen, identity_id, work_role, proximity_ref, shift_status, activity_type, start_timestamp, end_timestamp, owner_id, target_entity_id, activity_status, cost, parent_id, space_type, boundary_coordinates, environment_state, properties, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: entity_edges; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.entity_edges (id, tenant_id, source_entity_id, source_entity_type, target_entity_id, target_entity_type, relationship_type, metadata, valid_from, valid_until, created_at) FROM stdin;
\.


--
-- Data for Name: group_role_assignments; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.group_role_assignments (group_id, role_id, scope, assigned_at, assigned_by) FROM stdin;
\.


--
-- Data for Name: identity_providers; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.identity_providers (id, organization_id, type, name, display_name, config, allowed_domains, enabled, auto_create_users, auto_link_users, created_at, updated_at) FROM stdin;
2b770d54-ba73-4fa0-9881-4d2cff48d3dc	945d5c28-3f47-42fa-81e6-b6aff4b90882	google	google	Google	"{\\"type\\":\\"google\\",\\"clientId\\":\\"your-google-client-id\\",\\"clientSecret\\":\\"your-google-client-secret\\",\\"scopes\\":[\\"openid\\",\\"email\\",\\"profile\\"]}"	\N	t	t	t	2026-01-24 04:31:28.61244+00	2026-01-24 04:31:28.61244+00
b3e9a5f0-6f3c-4a9c-9ec4-27c20d41784e	945d5c28-3f47-42fa-81e6-b6aff4b90882	github	github	GitHub	"{\\"type\\":\\"github\\",\\"clientId\\":\\"your-github-client-id\\",\\"clientSecret\\":\\"your-github-client-secret\\",\\"scopes\\":[\\"user:email\\",\\"read:user\\"]}"	\N	t	t	t	2026-01-24 04:31:28.617691+00	2026-01-24 04:31:28.617691+00
\.


--
-- Data for Name: impersonation_sessions; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.impersonation_sessions (id, impersonator_id, target_user_id, organization_id, reason, status, started_at, ended_at, expires_at, ip_address, user_agent, created_at, updated_at) FROM stdin;
d5e95350-c9fa-44d6-b295-039534426fb3	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	\N	Testing to see if the feature is working	ended	2026-01-25 18:41:27.309144+00	2026-01-25 18:50:41.53+00	2026-01-25 19:41:28.608+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-25 18:41:27.309144+00	2026-01-25 18:50:41.53+00
a67f73b3-94ea-4e99-86f7-6444839a618d	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	\N	Testing impersonate	ended	2026-01-25 18:51:07.030597+00	2026-01-25 18:54:59.946+00	2026-01-25 19:21:08.407+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-25 18:51:07.030597+00	2026-01-25 18:54:59.946+00
ceb5c161-3928-4082-8295-32871f5cbdb7	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	\N	Testing Impersonation	ended	2026-01-25 19:04:56.53161+00	2026-01-25 19:05:15.891+00	2026-01-25 20:04:57.743+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-25 19:04:56.53161+00	2026-01-25 19:05:15.891+00
26f7f08e-a5f5-40cf-926c-2da388850ae5	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	\N	Testing Organization access	ended	2026-01-26 03:00:54.443869+00	2026-01-26 03:07:18.508+00	2026-01-26 04:00:55.156+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-26 03:00:54.443869+00	2026-01-26 03:07:18.508+00
53f13edb-51db-4cf2-a616-88bde6fb0d71	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	\N	Testing White Labeling with impersonate	ended	2026-01-26 03:19:03.281171+00	2026-01-26 03:19:52.853+00	2026-01-26 04:19:04.255+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-26 03:19:03.281171+00	2026-01-26 03:19:52.853+00
182e933e-726e-4bc0-b46f-54eb690a4461	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	\N	testing Imipersoante after changes	ended	2026-01-26 17:06:00.241196+00	2026-01-26 17:06:40.453+00	2026-01-26 17:21:01.239+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-26 17:06:00.241196+00	2026-01-26 17:06:40.453+00
9573bc61-cb09-49ad-81fe-c2f77ac0a46e	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	\N	Testing impersonation after home page changes	ended	2026-01-26 22:38:33.561242+00	2026-01-26 22:39:18+00	2026-01-26 23:38:35.051+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-26 22:38:33.561242+00	2026-01-26 22:39:18+00
3407b73a-f7c4-4504-b530-5f89f6bf9fc2	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	21c9d312-93cb-444d-b036-c92760f3ce91	Testing form Org tab	ended	2026-01-26 23:26:06.287282+00	2026-01-27 03:36:05.672+00	2026-01-26 23:41:05.664+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-26 23:26:06.287282+00	2026-01-27 03:36:05.672+00
499957eb-f793-438e-ae5b-660ea62bec3c	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	21c9d312-93cb-444d-b036-c92760f3ce91	Testing Impersonate from Org	ended	2026-01-27 03:37:56.866327+00	2026-01-27 17:01:43.605+00	2026-01-27 04:37:57.629+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-27 03:37:56.866327+00	2026-01-27 17:01:43.605+00
c1361915-2561-4667-b380-b87f3717f9f5	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	21c9d312-93cb-444d-b036-c92760f3ce91	Impersonate child org	ended	2026-01-27 18:22:05.564686+00	2026-01-27 18:58:23.027331+00	2026-01-27 19:22:05.087+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-27 18:22:05.564686+00	2026-01-27 18:22:05.564686+00
3b296b9e-2620-45ca-8f37-b5068872319c	7ab806d5-b245-403e-bdb2-de6ee6987ae0	4c575637-828b-4968-83a9-a26a883cf964	21c9d312-93cb-444d-b036-c92760f3ce91	Test impersonate overall	active	2026-01-27 18:58:56.118065+00	\N	2026-01-27 19:58:55.987+00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-27 18:58:56.118065+00	2026-01-27 18:58:56.118065+00
\.


--
-- Data for Name: organization_branding; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.organization_branding (id, organization_id, logo_url, logo_dark_url, favicon_url, primary_color, accent_color, login_background_type, login_background_url, login_background_color, login_welcome_text, login_subtitle, custom_css, created_at, updated_at) FROM stdin;
47b0a7c6-c0f1-4498-8e2f-beb5014a212c	21c9d312-93cb-444d-b036-c92760f3ce91	\N	\N	\N	#1ae4ff	\N	default	\N	\N	\N	\N	\N	2026-01-26 03:19:26.002973+00	2026-01-26 03:19:26.002973+00
\.


--
-- Data for Name: organization_invitations; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.organization_invitations (id, organization_id, email, role, status, token_hash, invited_by, expires_at, accepted_at, accepted_by, created_at) FROM stdin;
\.


--
-- Data for Name: organization_profiles; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.organization_profiles (id, name, description, type, is_system, capabilities, limits, is_active, created_at, updated_at) FROM stdin;
f9982790-86c8-4bfe-9750-461aa58ee561	Enterprise	Full-featured plan for large organizations	root	t	{"sso": true, "impersonation": true, "whiteLabeling": true}	{"maxUsers": -1, "maxOrganizations": -1}	t	2026-01-25 02:46:34.765542+00	2026-01-25 02:46:34.765542+00
da4a9a68-7ac8-4911-827b-40450a0cae0b	Standard	Standard plan for growing teams	root	t	{"sso": true, "impersonation": false, "whiteLabeling": false}	{"maxUsers": 100, "maxOrganizations": 5}	t	2026-01-25 02:46:34.771365+00	2026-01-25 02:46:34.771365+00
d8a2d8dc-5364-4d94-b37b-6a3afc85f1d2	Starter	Basic plan for small teams	root	t	{"sso": false, "impersonation": false, "whiteLabeling": false}	{"maxUsers": 10, "maxOrganizations": 1}	t	2026-01-25 02:46:34.774379+00	2026-01-25 02:46:34.774379+00
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.organizations (id, name, slug, is_active, created_at, updated_at, org_code, parent_organization_id, root_organization_id, is_root, path, depth, can_have_children, subdomain, plan, settings, description, profile_id, quota_overrides) FROM stdin;
945d5c28-3f47-42fa-81e6-b6aff4b90882	Viaanix	viaanix	t	2026-01-24 04:31:28.54002+00	2026-01-24 04:31:28.54002+00	VIAANIX	\N	945d5c28-3f47-42fa-81e6-b6aff4b90882	t	viaanix	0	t	viaanix	enterprise	\N	\N	\N	\N
21c9d312-93cb-444d-b036-c92760f3ce91	MyArgus	argus	t	2026-01-25 03:56:48.805393+00	2026-01-25 15:38:06.337+00	ARGUS	\N	21c9d312-93cb-444d-b036-c92760f3ce91	t	argus	0	t	argus	free	{"features": {"allowImpersonation": true, "allowWhiteLabeling": true}}	\N	f9982790-86c8-4bfe-9750-461aa58ee561	\N
79a14046-4b18-4dc1-8200-860b045f6498	Sub1Org1_L1	s1o1l1	t	2026-01-27 17:16:19.292786+00	2026-01-27 17:16:19.292786+00	S1O1L1	21c9d312-93cb-444d-b036-c92760f3ce91	21c9d312-93cb-444d-b036-c92760f3ce91	f	argus.s1o1l1	2	t	\N	free	\N	\N	f9982790-86c8-4bfe-9750-461aa58ee561	\N
35d4f606-0dfd-4a77-967c-609ada19ff91	Sub2Org2_L1	s2o2-l1	t	2026-01-27 17:35:17.91212+00	2026-01-27 17:35:17.91212+00	S2O2_L1	21c9d312-93cb-444d-b036-c92760f3ce91	21c9d312-93cb-444d-b036-c92760f3ce91	f	argus.s2o2-l1	2	f	\N	free	\N	\N	da4a9a68-7ac8-4911-827b-40450a0cae0b	\N
e5b4b80a-29cb-4d38-b152-828bf0ed680b	Sub1Org1_L2	s1o1l2	t	2026-01-27 19:08:46.402989+00	2026-01-27 19:08:46.402989+00	S1O1L2	79a14046-4b18-4dc1-8200-860b045f6498	21c9d312-93cb-444d-b036-c92760f3ce91	f	argus.s1o1l1.s1o1l2	3	t	\N	free	\N	\N	da4a9a68-7ac8-4911-827b-40450a0cae0b	\N
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: permission_audit_log; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.permission_audit_log (id, tenant_id, person_id, entity_id, action, permission_level, granted, denial_reason, checked_at) FROM stdin;
\.


--
-- Data for Name: platform_branding; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.platform_branding (id, logo_url, logo_dark_url, favicon_url, primary_color, accent_color, login_background_type, login_background_url, login_welcome_text, login_subtitle, terms_of_service_url, privacy_policy_url, support_url, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.platform_settings (id, key, value, description, is_secret, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.projects (id, organization_id, name, description, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.refresh_tokens (id, user_id, token_hash, family_id, is_revoked, expires_at, created_at, last_used_at, revoked_at, user_agent, ip_address) FROM stdin;
8a872bd1-b024-484f-965c-b179265088ed	7ab806d5-b245-403e-bdb2-de6ee6987ae0	bd0af19d692ad9f988bb2b788629ee19702b1c35f15b4025ffb2fcb5f8ff93a0	ddcb1ec5-b668-44c9-a1bf-2fe0b77259f3	f	2026-01-31 04:51:15.087+00	2026-01-24 04:51:15.085267+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
0e258250-3c2c-473d-9d1f-370a32e20041	7ab806d5-b245-403e-bdb2-de6ee6987ae0	bc522ccc983cadebc2bbea2e543db5060773b77c380c3eb3375f6ea9561e09a6	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 13:38:24.376+00	2026-01-24 13:38:24.631466+00	2026-01-24 15:50:22.399+00	2026-01-24 15:50:22.399+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
bf6a698e-8f9c-4f42-9c43-9fbc84984222	7ab806d5-b245-403e-bdb2-de6ee6987ae0	488e6d4cb40276e26769bcc2b3bc190a098116618bed26f933191fad7267885d	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 15:50:22.412+00	2026-01-24 15:50:22.303407+00	2026-01-24 16:05:23.418+00	2026-01-24 16:05:23.418+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
88b7b3f9-347d-4046-a59c-93750441b875	7ab806d5-b245-403e-bdb2-de6ee6987ae0	1a47c28f2ed85282c0062bbb5011c8dfe0329efe602078cc78d6db00b6c52809	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 16:05:23.425+00	2026-01-24 16:05:23.584031+00	2026-01-24 16:20:23.407+00	2026-01-24 16:20:23.407+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
8b7e6d33-f860-4107-9d51-fc4ecfa07483	7ab806d5-b245-403e-bdb2-de6ee6987ae0	1a90472b3a57e8a74fb01e2d23ea1361b724df24e2e72eacbab0b82989c4a327	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 16:20:23.413+00	2026-01-24 16:20:23.891969+00	2026-01-24 16:35:23.412+00	2026-01-24 16:35:23.412+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
4ed7f445-5893-4621-bf97-4dea9101ca0b	7ab806d5-b245-403e-bdb2-de6ee6987ae0	79535befae53d61614544f223748a088e19b0421a843f66ca60088d7e2008096	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 16:35:23.418+00	2026-01-24 16:35:24.175761+00	2026-01-24 16:50:23.406+00	2026-01-24 16:50:23.406+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
2b847599-764b-4339-a24f-741f10ba6561	7ab806d5-b245-403e-bdb2-de6ee6987ae0	7ccf8a7566012513729d16eacae3a5888a1334c1d376be9948ee85fd6ba83360	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 16:50:23.413+00	2026-01-24 16:50:22.500135+00	2026-01-24 18:00:18.817+00	2026-01-24 18:00:18.817+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
fd252398-2cc0-400c-b234-07a834a12212	7ab806d5-b245-403e-bdb2-de6ee6987ae0	94969c5b626bb2907c7f981673c5d2f9ccff3b1b18ef047a1b45fb81d98877c1	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 18:00:18.824+00	2026-01-24 18:00:19.31315+00	2026-01-24 19:11:52.288+00	2026-01-24 19:11:52.288+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
cbe3503f-b307-42c8-94fe-1d20731a03bc	7ab806d5-b245-403e-bdb2-de6ee6987ae0	923a8f9c9e1e411844f65ee7f638628c943597eb7e8e4a4fd317a37bec638b28	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 19:11:52.295+00	2026-01-24 19:11:52.931788+00	2026-01-24 22:26:42.232+00	2026-01-24 22:26:42.232+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
714495f5-202e-426f-9264-b0584f62f955	7ab806d5-b245-403e-bdb2-de6ee6987ae0	0f6555c4aa091159c5dce4d015faec939f8320b4514ebbb1ff27d2e53c738928	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 22:26:42.24+00	2026-01-24 22:26:41.973135+00	2026-01-24 22:42:05.439+00	2026-01-24 22:42:05.439+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
c6bed3c1-b8c9-4e84-8daa-ba4efac27863	7ab806d5-b245-403e-bdb2-de6ee6987ae0	726f2ccf4202761f18fe37d0256616303032e79db11b2b2511522524bb3b6a42	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 22:42:05.444+00	2026-01-24 22:42:04.679352+00	2026-01-24 23:05:56.038+00	2026-01-24 23:05:56.038+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
8076cb38-a0a5-478c-9755-f7006fc1c9a0	7ab806d5-b245-403e-bdb2-de6ee6987ae0	5dac920d9d07448bb96da0899f4b220b3512c8cc7ae03e514132bbd8166cbba8	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 23:05:56.044+00	2026-01-24 23:05:56.400037+00	2026-01-24 23:30:50.063+00	2026-01-24 23:30:50.063+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
6ab4643c-3115-4941-8353-2f075ceb317f	7ab806d5-b245-403e-bdb2-de6ee6987ae0	255d40555bcc0a8e5c6f7d471821f4ebcab45fe9918178edd08850f7a8b0951c	a1d3bece-63a6-454e-9862-07e4d7237b86	t	2026-01-31 23:30:50.068+00	2026-01-24 23:30:49.696427+00	2026-01-25 01:20:14.379+00	2026-01-25 01:20:14.379+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
8d467a96-ec0e-40a7-ae69-1f366da2da42	7ab806d5-b245-403e-bdb2-de6ee6987ae0	96123a735cfa0ceef2e3aba290282425f80d2b76e9474323b3bc81cab0f7e393	a1d3bece-63a6-454e-9862-07e4d7237b86	f	2026-02-01 01:20:14.387+00	2026-01-25 01:20:12.667851+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
9c29b588-be76-4d0c-bc98-522856254e1c	7ab806d5-b245-403e-bdb2-de6ee6987ae0	1cd7bab2725d38ba3be2d66fa353c13e4aaf15c361ae8b88ea8ad039a1abd36f	981e775d-8cc7-4280-b94f-ab239416139e	t	2026-02-01 01:43:26.883+00	2026-01-25 01:43:25.201153+00	2026-01-25 02:37:39.941+00	2026-01-25 02:37:39.941+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
36858188-d27e-4631-b477-0e4d64860ad4	7ab806d5-b245-403e-bdb2-de6ee6987ae0	68eee22831261d9ac4e88265d865ed9d085cedfc189706a99654ac14a9cb823f	981e775d-8cc7-4280-b94f-ab239416139e	f	2026-02-01 02:37:39.949+00	2026-01-25 02:37:38.760995+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
f18ec233-7690-49dd-908a-bea5209c4154	7ab806d5-b245-403e-bdb2-de6ee6987ae0	5efef6fc008fb07f4ad4aaea2abd721ec2e91e807216b81ee31f3cf078d0a905	f7adebfa-286d-4063-89d9-e308f1c1bcd5	t	2026-02-01 02:38:49.569+00	2026-01-25 02:38:49.877462+00	2026-01-25 02:56:22.143+00	2026-01-25 02:56:22.143+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
af684bd7-6126-4d44-93c2-ee08a3262114	7ab806d5-b245-403e-bdb2-de6ee6987ae0	dc8ef3aa40c01600036be778d9326d488d69aa3110360bbd7e09596b5e0372ed	f7adebfa-286d-4063-89d9-e308f1c1bcd5	t	2026-02-01 02:56:22.148+00	2026-01-25 02:56:21.276273+00	2026-01-25 03:12:16.146+00	2026-01-25 03:12:16.146+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
73d8c5cc-03ab-4b26-81a6-31d4bc749757	7ab806d5-b245-403e-bdb2-de6ee6987ae0	0e77be63ebb197706b22b3174566689979eed1f307db639bfa32d1cdbd49ffc5	f7adebfa-286d-4063-89d9-e308f1c1bcd5	t	2026-02-01 03:12:16.154+00	2026-01-25 03:12:15.161556+00	2026-01-25 03:35:16.486+00	2026-01-25 03:35:16.486+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
2ef0cc66-24ba-4ddb-a2e6-9c8ee8db3ea1	7ab806d5-b245-403e-bdb2-de6ee6987ae0	42527d16d6a5fd0b16a2a5aaf44c95f5dec5aaddfa6b10eb2581053db49d0217	f7adebfa-286d-4063-89d9-e308f1c1bcd5	t	2026-02-01 03:35:16.493+00	2026-01-25 03:35:14.320205+00	2026-01-25 03:54:53.594+00	2026-01-25 03:54:53.594+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
4b84d18e-37d2-48c0-a6dc-28db83d641e9	7ab806d5-b245-403e-bdb2-de6ee6987ae0	e0260e7baa09a03191b8197e9b62f0b5214ec271e42144e1f7ddd23a09aafa18	f7adebfa-286d-4063-89d9-e308f1c1bcd5	t	2026-02-01 03:54:53.6+00	2026-01-25 03:54:51.737392+00	2026-01-25 04:22:17.78+00	2026-01-25 04:22:17.78+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
5ed253fc-2bf1-4721-8ec2-c38b14e07018	7ab806d5-b245-403e-bdb2-de6ee6987ae0	87848a3bf90592fc4b8ace9a6e074afc5c8716b606d2fe3f27f8840903f76f9a	f7adebfa-286d-4063-89d9-e308f1c1bcd5	f	2026-02-01 04:22:17.787+00	2026-01-25 04:22:18.667382+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
24428520-97b2-4f24-92bd-211db6fd5d2e	7ab806d5-b245-403e-bdb2-de6ee6987ae0	f4a669f390ef3c05e6f71a174809d71e8950165a25ab442b69b0f3cfb5f9fd18	07aa4aa4-a1c6-4b88-ba06-2d390f9b37f7	t	2026-02-01 04:23:11.201+00	2026-01-25 04:23:11.93969+00	2026-01-25 04:38:45.673+00	2026-01-25 04:38:45.673+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
d428b9c6-057c-4917-ada1-07041d5645ec	7ab806d5-b245-403e-bdb2-de6ee6987ae0	01f5be75868a8620bb4236dce0efee9613de64eb96974c81b8e6c89967b19d73	07aa4aa4-a1c6-4b88-ba06-2d390f9b37f7	t	2026-02-01 04:38:45.679+00	2026-01-25 04:38:45.684639+00	2026-01-25 13:11:08.497+00	2026-01-25 13:11:08.497+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
eeaf9839-9ac2-4508-8139-bd515aab4cbf	7ab806d5-b245-403e-bdb2-de6ee6987ae0	ef698646a407d89bff8431161e391eae1e8ce7695733f349960fe0dfd9fe3820	07aa4aa4-a1c6-4b88-ba06-2d390f9b37f7	t	2026-02-01 13:11:08.504+00	2026-01-25 13:11:07.963431+00	2026-01-25 13:31:00.797+00	2026-01-25 13:31:00.797+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
d5d26551-3f94-4672-8aee-9d163c72a3cf	7ab806d5-b245-403e-bdb2-de6ee6987ae0	0b101b3aaa490045cbf31f9bc961e7a28554998e037780a74be1daa219ac418c	07aa4aa4-a1c6-4b88-ba06-2d390f9b37f7	t	2026-02-01 13:31:00.801+00	2026-01-25 13:31:00.286287+00	2026-01-25 13:51:29.561+00	2026-01-25 13:51:29.561+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
1e158931-c330-4b58-a92c-6584164fcb7e	7ab806d5-b245-403e-bdb2-de6ee6987ae0	e7adc2e6a5036422fbc37c4f9da7a4291d548d20e88d7456d602518debd2f82a	07aa4aa4-a1c6-4b88-ba06-2d390f9b37f7	t	2026-02-01 13:51:29.567+00	2026-01-25 13:51:29.691577+00	2026-01-25 14:06:40.051+00	2026-01-25 14:06:40.051+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
607e1967-473f-4f6a-bd7f-7027526d412e	7ab806d5-b245-403e-bdb2-de6ee6987ae0	c2048822a606d77c361dc11747b504328870817ae775b9375d09455fa3c121c9	07aa4aa4-a1c6-4b88-ba06-2d390f9b37f7	t	2026-02-01 14:06:40.057+00	2026-01-25 14:06:40.534375+00	2026-01-25 14:53:23.603+00	2026-01-25 14:53:23.603+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
88bd0077-575d-4483-b45d-300cb0e30565	7ab806d5-b245-403e-bdb2-de6ee6987ae0	48761d321d5a2357cde8a69f3c7c9705b021528c7801f4d4790c2a89a2f9741c	07aa4aa4-a1c6-4b88-ba06-2d390f9b37f7	f	2026-02-01 14:53:23.61+00	2026-01-25 14:53:22.799966+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
f165b8be-423f-4344-b7b2-27bafa8501a1	7ab806d5-b245-403e-bdb2-de6ee6987ae0	b6ac801e539f698338d6a629261e72afa6b404ee7f8d70c143b44a28b24a3a05	8f5a0e6e-4f4c-4f10-836d-268cf0512341	t	2026-02-01 15:09:08.397+00	2026-01-25 15:09:08.568296+00	2026-01-25 15:26:12.202+00	2026-01-25 15:26:12.202+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
f105d647-9981-4380-b525-08d6be23b9ea	7ab806d5-b245-403e-bdb2-de6ee6987ae0	ac231d2ba11d0dd13b1497a07907d87e2684618e2db9b6f612ad866301dbae16	8f5a0e6e-4f4c-4f10-836d-268cf0512341	t	2026-02-01 15:26:12.207+00	2026-01-25 15:26:11.184823+00	2026-01-25 15:41:30.413+00	2026-01-25 15:41:30.413+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
ad8c17bb-834d-409a-bbdf-8bc2215ecab6	7ab806d5-b245-403e-bdb2-de6ee6987ae0	f436b639836637561173217773be32ff79f11f42889928265fafb4de92677754	8f5a0e6e-4f4c-4f10-836d-268cf0512341	f	2026-02-01 15:41:30.418+00	2026-01-25 15:41:30.656897+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
dca0b078-6600-4d04-aadd-4de994fa35b9	7ab806d5-b245-403e-bdb2-de6ee6987ae0	5a68e00602e54e46216f1780f29cb1d89aef08f0f6ff75baf7ba68806772632b	1038e414-26b6-4963-ad00-db97826c46ee	t	2026-02-01 16:42:26.87+00	2026-01-25 16:42:25.673971+00	2026-01-25 18:35:39.125+00	2026-01-25 18:35:39.125+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
69657be5-f5e4-45fd-9f65-4b92be72dfb1	7ab806d5-b245-403e-bdb2-de6ee6987ae0	07060e1ddb3114c196ba7635b284f58c7c1e7418b19d160fe638c9ec42bad5b3	1038e414-26b6-4963-ad00-db97826c46ee	f	2026-02-01 18:35:39.132+00	2026-01-25 18:35:38.504015+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
b9c3aaa1-8702-4d88-9d9e-a1be0c5ec4fb	7ab806d5-b245-403e-bdb2-de6ee6987ae0	b440b2ff077e9fc4d999576e55efd58d96eafa33c737effc704026edee089730	09cdffb4-5942-4e21-844b-6517ae9d6055	t	2026-02-01 18:50:33.568+00	2026-01-25 18:50:33.975357+00	2026-01-25 19:12:46.506+00	2026-01-25 19:12:46.506+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
1fba5a99-63ec-44be-88ac-480f5bdf8d99	7ab806d5-b245-403e-bdb2-de6ee6987ae0	e2def2ed7fe1ca8ad34a18d23c8939472c3970e0a4b938964a60e2819d7a619b	09cdffb4-5942-4e21-844b-6517ae9d6055	t	2026-02-01 19:12:46.512+00	2026-01-25 19:12:45.249702+00	2026-01-26 02:24:06.489+00	2026-01-26 02:24:06.489+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
1633090f-7a55-48fd-88c8-06cd834ca575	7ab806d5-b245-403e-bdb2-de6ee6987ae0	7c1cf21abd958c7c4bec3a105d3858065677a5a92819f4ae3ab73710b78e2b99	09cdffb4-5942-4e21-844b-6517ae9d6055	f	2026-02-02 02:24:06.498+00	2026-01-26 02:24:06.052624+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
df6b3094-1ca9-44fe-8c45-fb1cdaa23cf2	7ab806d5-b245-403e-bdb2-de6ee6987ae0	78e7af2c3719360dd42a8920fd52b689b5608a8bd23386a618fd94139135daa7	dfd55c54-9cef-48bb-b585-4dbfb3ee1903	f	2026-02-02 02:32:39.523+00	2026-01-26 02:32:38.506179+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
d9e3b41c-b255-4010-85d0-1e12acda70fa	7ab806d5-b245-403e-bdb2-de6ee6987ae0	888edf54fa0c900b65e4168924b843d8d8b6db4904530f67418bffe976093a32	47b90cb5-9aa6-480f-b605-e41d19186c4f	t	2026-02-02 02:53:22.871+00	2026-01-26 02:53:20.579434+00	2026-01-26 03:18:20.695+00	2026-01-26 03:18:20.695+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
6e522175-cdfb-4925-b29b-84cb2af2f826	7ab806d5-b245-403e-bdb2-de6ee6987ae0	17ca9bcaa89481995daa2241e7823ace3d7719655a206febf324c84f4dfd333d	47b90cb5-9aa6-480f-b605-e41d19186c4f	t	2026-02-02 03:18:20.7+00	2026-01-26 03:18:20.825311+00	2026-01-26 12:56:32.876+00	2026-01-26 12:56:32.876+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
3f1296ed-0a87-4b45-87dc-e4ec5e838a3c	7ab806d5-b245-403e-bdb2-de6ee6987ae0	af044d9ca130a45787f28ab405f114c1e9909516e7a6066fbdcc9f8a0c24e070	47b90cb5-9aa6-480f-b605-e41d19186c4f	t	2026-02-02 12:56:32.885+00	2026-01-26 12:56:32.708763+00	2026-01-26 13:39:51.077+00	2026-01-26 13:39:51.077+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
aae0eff9-742b-4659-baa8-d90fe786bc0a	7ab806d5-b245-403e-bdb2-de6ee6987ae0	e01e6b7bef313065356f3d0e2e4c7cc9a16476cecb23e52045b7d147a3a1645e	47b90cb5-9aa6-480f-b605-e41d19186c4f	t	2026-02-02 13:39:51.085+00	2026-01-26 13:39:50.290092+00	2026-01-26 15:16:06.713+00	2026-01-26 15:16:06.713+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
17311fb0-2c69-4136-afd2-1a3766c6eb21	7ab806d5-b245-403e-bdb2-de6ee6987ae0	f8cedcfefbbcca7480c9b932859a290df7a1522e4fb280fe812d44fcd8a1f448	47b90cb5-9aa6-480f-b605-e41d19186c4f	t	2026-02-02 15:16:06.718+00	2026-01-26 15:16:06.632542+00	2026-01-26 15:39:51.893+00	2026-01-26 15:39:51.893+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
f58538e1-dc53-4b15-baab-29df60b135e3	7ab806d5-b245-403e-bdb2-de6ee6987ae0	a7947aed74ee4480023ee026a5b69fdf88593afb4aa1d0028a40038afcc85232	47b90cb5-9aa6-480f-b605-e41d19186c4f	f	2026-02-02 15:39:51.899+00	2026-01-26 15:39:52.304256+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
a4609d20-674d-407b-9e42-b2357336ed35	7ab806d5-b245-403e-bdb2-de6ee6987ae0	da2574b3001da3cfd44fcd99a841bb6189438eed9a9e3c5e647974cc4dea5ad3	e6dc55ab-f97f-4606-81c4-c1e0575a7c22	t	2026-02-02 15:46:00.754+00	2026-01-26 15:46:01.248962+00	2026-01-26 16:03:46.972+00	2026-01-26 16:03:46.972+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
71282ff8-95eb-4801-a428-e3fc405e53c0	7ab806d5-b245-403e-bdb2-de6ee6987ae0	7e90f78ba4635bf65d0463e764b68289fa371a87dd749573347f8b6f80ab512b	e6dc55ab-f97f-4606-81c4-c1e0575a7c22	t	2026-02-02 16:03:46.975+00	2026-01-26 16:03:46.941231+00	2026-01-26 16:55:25.564+00	2026-01-26 16:55:25.564+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
e6fd9932-6e9d-46ba-97fc-e07b4c312e4f	7ab806d5-b245-403e-bdb2-de6ee6987ae0	aa688841af82aa31a9dc8f5b3704fc9ce69424ed53b497f030102dd2ec6ec05b	e6dc55ab-f97f-4606-81c4-c1e0575a7c22	t	2026-02-02 16:55:25.571+00	2026-01-26 16:55:25.309698+00	2026-01-26 17:11:15.259+00	2026-01-26 17:11:15.259+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
c7f43d64-c5ae-49b7-812f-5ecf0d793c68	7ab806d5-b245-403e-bdb2-de6ee6987ae0	92d54fe4b923e51ae38cd264c406941f945dc6905a29058200bd18c9d0d78cbe	e6dc55ab-f97f-4606-81c4-c1e0575a7c22	t	2026-02-02 17:11:15.262+00	2026-01-26 17:11:14.578928+00	2026-01-26 17:35:49.679+00	2026-01-26 17:35:49.679+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
ae503569-7081-40ab-98a4-0014008e7ccb	7ab806d5-b245-403e-bdb2-de6ee6987ae0	e3d087861bc48d7da9131175be3778fef77eb51562a6e073e8faa5182184638f	e6dc55ab-f97f-4606-81c4-c1e0575a7c22	t	2026-02-02 17:35:49.683+00	2026-01-26 17:35:50.072784+00	2026-01-26 22:11:50.722+00	2026-01-26 22:11:50.722+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
f246a4d9-fadf-4cb3-b3d3-896045c4c12b	7ab806d5-b245-403e-bdb2-de6ee6987ae0	b4c467056fe5e0ba300eda67d5025db8775ca02fed3acaa09f67e77a1854f8dc	e6dc55ab-f97f-4606-81c4-c1e0575a7c22	t	2026-02-02 22:11:50.755+00	2026-01-26 22:11:50.872539+00	2026-01-26 22:27:07.463+00	2026-01-26 22:27:07.463+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
66323ac4-4a56-48e4-b06d-a62d67b58c68	7ab806d5-b245-403e-bdb2-de6ee6987ae0	37955a38dbd72828e1df70cb95a135e2b8ce9db6cd93a0dd42720822e34931c0	e6dc55ab-f97f-4606-81c4-c1e0575a7c22	f	2026-02-02 22:27:07.47+00	2026-01-26 22:27:05.919318+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
313ba18b-8cab-4073-85ca-cfdaf579d5d4	7ab806d5-b245-403e-bdb2-de6ee6987ae0	7eef13010e30d66e498b4709f654c151b4ae70489aba1210b792025d88edde17	796aab69-d9e2-4a93-a529-a05ce1fe5358	t	2026-02-02 22:37:23.538+00	2026-01-26 22:37:22.941048+00	2026-01-26 22:56:09.88+00	2026-01-26 22:56:09.88+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
42ae01e4-7ec8-4395-a313-0f6ce1112612	7ab806d5-b245-403e-bdb2-de6ee6987ae0	9ca645e9639b03b50b1ed7574aa12418bf9739d87cfc9bb7f546e205186d5191	796aab69-d9e2-4a93-a529-a05ce1fe5358	t	2026-02-02 22:56:09.886+00	2026-01-26 22:56:09.418493+00	2026-01-26 23:11:49.103+00	2026-01-26 23:11:49.103+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
8b6fa933-a3e9-419f-abe0-8f8c170156c2	7ab806d5-b245-403e-bdb2-de6ee6987ae0	2b81ebf2c883727786d228978ebb8b648adeb753dd4186d5e29234a0f21cea0a	796aab69-d9e2-4a93-a529-a05ce1fe5358	t	2026-02-02 23:11:49.108+00	2026-01-26 23:11:49.161376+00	2026-01-26 23:27:27.142+00	2026-01-26 23:27:27.142+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
5acfac47-b89e-411d-8e58-c82bff88fa51	7ab806d5-b245-403e-bdb2-de6ee6987ae0	18d92c9ef769b9f457c54d72463170d013560a82b58154698e0faf1598c411b1	796aab69-d9e2-4a93-a529-a05ce1fe5358	t	2026-02-02 23:27:27.146+00	2026-01-26 23:27:27.62839+00	2026-01-26 23:43:19.939+00	2026-01-26 23:43:19.939+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
db32365b-3a29-4208-bf04-2106dc69c0bf	7ab806d5-b245-403e-bdb2-de6ee6987ae0	b5e795d2485373b3f506c4bcee2ee53384d0a7fbc079aea640633e80c6b521e1	796aab69-d9e2-4a93-a529-a05ce1fe5358	f	2026-02-02 23:43:19.945+00	2026-01-26 23:43:20.102736+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
89702dac-88d9-4c09-b732-af6a2dfb0c70	7ab806d5-b245-403e-bdb2-de6ee6987ae0	aabb03f847b81d9920ab1ea2ec6e6c4dda06f7007afb26f08393a13f3e1cd49d	c5c167c2-f254-4fdf-99d0-d88b225507e8	t	2026-02-02 23:52:37.711+00	2026-01-26 23:52:36.300215+00	2026-01-27 03:34:19.509+00	2026-01-27 03:34:19.509+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
63f81c61-cd59-4f0a-8ec0-2e8996b27832	7ab806d5-b245-403e-bdb2-de6ee6987ae0	49beb82f3b9289d0e1c39011c273696a4c2d6c75d2d282237b275ff4b26a70ff	c5c167c2-f254-4fdf-99d0-d88b225507e8	t	2026-02-03 03:34:19.514+00	2026-01-27 03:34:18.779455+00	2026-01-27 03:54:09.169+00	2026-01-27 03:54:09.169+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
6a449a58-7c05-4c92-8ec0-ad964b0696d8	7ab806d5-b245-403e-bdb2-de6ee6987ae0	0468f2e2fc7ac3ce3da041b20bebf7a17aadb275ccf1fa76e78db4fcce2a78e8	c5c167c2-f254-4fdf-99d0-d88b225507e8	t	2026-02-03 03:54:09.175+00	2026-01-27 03:54:07.281955+00	2026-01-27 16:52:11.72+00	2026-01-27 16:52:11.72+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
b10f5f30-0a34-43df-b441-ea745a1df4f8	7ab806d5-b245-403e-bdb2-de6ee6987ae0	8dfd06de6fd0834a733d2449b8cfcedf87a16c18a31203fbdccf7343a40aa310	c5c167c2-f254-4fdf-99d0-d88b225507e8	t	2026-02-03 16:52:11.734+00	2026-01-27 16:52:11.428705+00	2026-01-27 17:15:46.3+00	2026-01-27 17:15:46.3+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
4e8c47ad-29ae-4206-8fcc-96582a10e8fe	7ab806d5-b245-403e-bdb2-de6ee6987ae0	ba52fe9057744909fd73ac4f968000eb4b11c0c19a589b93ba999dd68d4e4833	c5c167c2-f254-4fdf-99d0-d88b225507e8	f	2026-02-03 17:15:46.306+00	2026-01-27 17:15:45.061653+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
bacdab18-1add-46e5-87ec-a1e728750a11	7ab806d5-b245-403e-bdb2-de6ee6987ae0	b5fe23854140e5aac117cb5a83460cb1d39ed8ba4fabb23617bd38d83cf2c66d	453b7643-5d89-4faf-8d18-c3a14e2ff0ee	f	2026-02-03 17:20:55.241+00	2026-01-27 17:20:54.088528+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
b483bf7a-4800-4f95-8f30-9e012eda4fd5	7ab806d5-b245-403e-bdb2-de6ee6987ae0	de970698ff87aded33e50575fa66c6885216f14e065321a3b62ed94fc9b85ec6	529a4471-a4ab-4af6-ba93-22d13841afa1	t	2026-02-03 17:32:29.339+00	2026-01-27 17:32:30.044945+00	2026-01-27 18:16:18.541+00	2026-01-27 18:16:18.541+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
ca40c32d-63d6-4da4-90ff-38d2993060ae	7ab806d5-b245-403e-bdb2-de6ee6987ae0	3491e6bb68b716c4a753fedc58596a01d6d521b3135c62c9f2b31f6baacccefe	529a4471-a4ab-4af6-ba93-22d13841afa1	f	2026-02-03 18:16:18.546+00	2026-01-27 18:16:17.957501+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
8c74a8f1-cadb-43eb-bf56-4498701ed171	7ab806d5-b245-403e-bdb2-de6ee6987ae0	ddf4a381af34fbb303839e766485f2ee80f6ad3b371483298b3739cea090f71b	e930f3e8-8bd1-4fe9-aed6-fb88f92cb382	t	2026-02-03 18:21:34.994+00	2026-01-27 18:21:35.332485+00	2026-01-27 18:36:47.937+00	2026-01-27 18:36:47.937+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
5d52522f-e430-4cb7-8596-a0e5c2c9e116	7ab806d5-b245-403e-bdb2-de6ee6987ae0	93ac0ef902d0cb3c2dd6f102763608108340e4d68b894da1922a2a72d0608378	e930f3e8-8bd1-4fe9-aed6-fb88f92cb382	f	2026-02-03 18:36:47.943+00	2026-01-27 18:36:48.035249+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
986fed79-2588-4293-bc98-07b7c55c4243	7ab806d5-b245-403e-bdb2-de6ee6987ae0	f25512e39c8afd07d8bd20cd0fd9f42c9bd69ffe2fc3963cec569c5b3cb10cc4	34c5bb40-df6e-49f4-950a-deace8d03e3a	t	2026-02-03 18:37:20.225+00	2026-01-27 18:37:20.72092+00	2026-01-27 18:54:44.251+00	2026-01-27 18:54:44.251+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
ab94f3dc-b2b5-4d40-b20d-870111429f97	7ab806d5-b245-403e-bdb2-de6ee6987ae0	a3a54275cc6bfbc5c1c29b6cf52ae9f1fe8652bd5c2897d6f3f9660d23124df2	34c5bb40-df6e-49f4-950a-deace8d03e3a	t	2026-02-03 18:54:44.256+00	2026-01-27 18:54:44.039083+00	2026-01-27 19:09:47.565+00	2026-01-27 19:09:47.565+00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
c3deeb19-8ffa-4ce9-b2b8-c835c08cbbc2	7ab806d5-b245-403e-bdb2-de6ee6987ae0	cc2d4f70b3b18867a090f2c1cc1654ba3bc78fa24924f10e3cf3c2d9980d8c0e	34c5bb40-df6e-49f4-950a-deace8d03e3a	f	2026-02-03 19:09:47.57+00	2026-01-27 19:09:46.699189+00	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	127.0.0.1
\.


--
-- Data for Name: role_definitions; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.role_definitions (id, tenant_id, role_name, display_name, description, default_permission_level, default_permissions, allowed_asset_types, created_at) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.roles (id, name, description, organization_id, is_system, default_scope, permissions, priority, created_at, updated_at) FROM stdin;
1c81db7a-a6f0-46a0-afd2-880501dbd445	Owner	Full access to all organization resources and settings	\N	t	tree	{"resources": [{"actions": ["create", "read", "update", "delete"], "resource": "*"}], "menuAccess": ["*"]}	100	2026-01-25 15:04:16.28086+00	2026-01-25 15:04:16.28086+00
cf311672-7ef5-45fd-8de1-302fbe0dc354	Admin	Administrative access to organization resources	\N	t	tree	{"resources": [{"actions": ["create", "read", "update", "delete"], "resource": "*"}], "menuAccess": ["*"]}	80	2026-01-25 15:04:16.28086+00	2026-01-25 15:04:16.28086+00
f323f5a1-7c98-434a-8254-13c03bb2ca75	Member	Standard access to organization resources	\N	t	organization	{"resources": [{"actions": ["read"], "resource": "organizations"}, {"actions": ["read"], "resource": "users"}, {"actions": ["read"], "resource": "groups"}], "menuAccess": ["dashboard", "organizations", "users"]}	40	2026-01-25 15:04:16.28086+00	2026-01-25 15:04:16.28086+00
0b69ddcb-7ba1-4cd2-ba5f-5c51a6b4c432	Viewer	Read-only access to organization resources	\N	t	organization	{"resources": [{"actions": ["read"], "resource": "organizations"}, {"actions": ["read"], "resource": "users"}], "menuAccess": ["dashboard"]}	20	2026-01-25 15:04:16.28086+00	2026-01-25 15:04:16.28086+00
b688273e-29a2-431c-a150-74dc5db366e0	Work Assigner	\N	21c9d312-93cb-444d-b036-c92760f3ce91	f	tree	{"resources": [], "menuAccess": []}	0	2026-01-25 15:36:38.747926+00	2026-01-25 15:36:38.747926+00
1b3f3403-89ad-4e7f-8107-f9539d66f914	Super Admin	Platform-level administrator with access to all organizations	\N	t	tree	{"resources": [{"actions": ["*"], "resource": "*"}], "menuAccess": ["*"], "isSuperAdmin": true}	999	2026-01-25 16:35:03.889926+00	2026-01-25 16:35:03.889926+00
\.


--
-- Data for Name: system_admins; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.system_admins (id, user_id, role, is_active, created_at, created_by) FROM stdin;
24616bb9-fc69-4335-a066-4fbca23b4974	7ab806d5-b245-403e-bdb2-de6ee6987ae0	super_admin	t	2026-01-26 02:34:14.599659+00	\N
9472cdf4-f7ff-4e13-9eab-b4de63dd386d	4c575637-828b-4968-83a9-a26a883cf964	org_admin	t	2026-01-26 02:34:14.599659+00	\N
\.


--
-- Data for Name: system_events; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.system_events (id, tenant_id, event_type, entity_id, entity_type, payload, processed, processed_at, processing_result, correlation_id, created_at) FROM stdin;
\.


--
-- Data for Name: telemetry_history; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.telemetry_history (id, tenant_id, entity_id, entity_type, metric_key, value, quality, "timestamp", received_at) FROM stdin;
\.


--
-- Data for Name: type_definitions; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.type_definitions (id, tenant_id, project_id, name, display_name, description, inherits_from, property_mappings, semantic_tags, industry_vertical, default_icon, default_color, created_at, created_by, version) FROM stdin;
\.


--
-- Data for Name: user_group_memberships; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.user_group_memberships (user_id, group_id, added_at, added_by) FROM stdin;
\.


--
-- Data for Name: user_groups; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.user_groups (id, organization_id, name, description, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: user_identities; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.user_identities (id, user_id, provider_id, external_id, email, profile, access_token, refresh_token, token_expires_at, last_used_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_organizations; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.user_organizations (user_id, organization_id, role, joined_at, invited_by, is_primary, expires_at) FROM stdin;
7ab806d5-b245-403e-bdb2-de6ee6987ae0	945d5c28-3f47-42fa-81e6-b6aff4b90882	owner	2026-01-24 04:31:28.605191+00	\N	t	\N
4c575637-828b-4968-83a9-a26a883cf964	21c9d312-93cb-444d-b036-c92760f3ce91	owner	2026-01-25 03:56:48.878555+00	\N	t	\N
7ab806d5-b245-403e-bdb2-de6ee6987ae0	21c9d312-93cb-444d-b036-c92760f3ce91	admin	2026-01-25 15:30:05.786301+00	\N	f	\N
\.


--
-- Data for Name: user_role_assignments; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.user_role_assignments (user_id, role_id, organization_id, scope, source, assigned_at, assigned_by, expires_at) FROM stdin;
7ab806d5-b245-403e-bdb2-de6ee6987ae0	1b3f3403-89ad-4e7f-8107-f9539d66f914	945d5c28-3f47-42fa-81e6-b6aff4b90882	tree	direct	2026-01-25 16:35:15.426215+00	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: argus
--

COPY public.users (id, email, password_hash, first_name, last_name, status, email_verified_at, last_login_at, deleted_at, created_at, updated_at, root_organization_id, primary_organization_id, avatar_url, mfa_enabled, mfa_secret) FROM stdin;
4c575637-828b-4968-83a9-a26a883cf964	admin@argus.io	$argon2id$v=19$m=65536,t=3,p=4$/Zt7RpU5bPYWGexy/RXNUg$W+hXq0Uuhziajf54LMSMtZ5lpbEfdt5S26jaiC367Os	Admin	Argus	active	\N	\N	\N	2026-01-25 03:56:48.872995+00	2026-01-25 03:56:48.872995+00	21c9d312-93cb-444d-b036-c92760f3ce91	21c9d312-93cb-444d-b036-c92760f3ce91	\N	f	\N
7ab806d5-b245-403e-bdb2-de6ee6987ae0	admin@viaanix.com	$argon2id$v=19$m=65536,t=3,p=4$CQt3LNOl/cD9fJ7Ma1vIQg$BmUBqTohM0/I2QwpiH2YJlao5Zp0EXSkHyVY4cVKA2I	System	Admin	active	2026-01-24 04:31:28.597309+00	2026-01-27 18:37:20.207+00	\N	2026-01-24 04:31:28.597309+00	2026-01-27 18:37:20.207+00	945d5c28-3f47-42fa-81e6-b6aff4b90882	945d5c28-3f47-42fa-81e6-b6aff4b90882	\N	f	\N
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: argus
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: argus
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 30, true);


--
-- Name: permission_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: argus
--

SELECT pg_catalog.setval('public.permission_audit_log_id_seq', 1, false);


--
-- Name: system_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: argus
--

SELECT pg_catalog.setval('public.system_events_id_seq', 1, false);


--
-- Name: telemetry_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: argus
--

SELECT pg_catalog.setval('public.telemetry_history_id_seq', 1, false);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: argus
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: entities entities_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_pkey PRIMARY KEY (id);


--
-- Name: entity_edges entity_edges_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.entity_edges
    ADD CONSTRAINT entity_edges_pkey PRIMARY KEY (id);


--
-- Name: group_role_assignments group_role_assignments_group_id_role_id_pk; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.group_role_assignments
    ADD CONSTRAINT group_role_assignments_group_id_role_id_pk PRIMARY KEY (group_id, role_id);


--
-- Name: identity_providers identity_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.identity_providers
    ADD CONSTRAINT identity_providers_pkey PRIMARY KEY (id);


--
-- Name: impersonation_sessions impersonation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_pkey PRIMARY KEY (id);


--
-- Name: organization_branding organization_branding_organization_id_unique; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_branding
    ADD CONSTRAINT organization_branding_organization_id_unique UNIQUE (organization_id);


--
-- Name: organization_branding organization_branding_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_branding
    ADD CONSTRAINT organization_branding_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_token_hash_unique UNIQUE (token_hash);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_unique; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);


--
-- Name: organizations organizations_subdomain_unique; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_subdomain_unique UNIQUE (subdomain);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: permission_audit_log permission_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.permission_audit_log
    ADD CONSTRAINT permission_audit_log_pkey PRIMARY KEY (id);


--
-- Name: platform_branding platform_branding_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.platform_branding
    ADD CONSTRAINT platform_branding_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_key_unique UNIQUE (key);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: role_definitions role_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.role_definitions
    ADD CONSTRAINT role_definitions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: system_admins system_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_pkey PRIMARY KEY (id);


--
-- Name: system_admins system_admins_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_user_id_unique UNIQUE (user_id);


--
-- Name: system_events system_events_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.system_events
    ADD CONSTRAINT system_events_pkey PRIMARY KEY (id);


--
-- Name: telemetry_history telemetry_history_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.telemetry_history
    ADD CONSTRAINT telemetry_history_pkey PRIMARY KEY (id);


--
-- Name: organization_profiles tenant_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_profiles
    ADD CONSTRAINT tenant_profiles_pkey PRIMARY KEY (id);


--
-- Name: type_definitions type_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.type_definitions
    ADD CONSTRAINT type_definitions_pkey PRIMARY KEY (id);


--
-- Name: identity_providers uq_identity_providers_org_name; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.identity_providers
    ADD CONSTRAINT uq_identity_providers_org_name UNIQUE (organization_id, name);


--
-- Name: role_definitions uq_role_def_tenant_name; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.role_definitions
    ADD CONSTRAINT uq_role_def_tenant_name UNIQUE (tenant_id, role_name);


--
-- Name: type_definitions uq_type_def_tenant_name; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.type_definitions
    ADD CONSTRAINT uq_type_def_tenant_name UNIQUE (tenant_id, name);


--
-- Name: user_identities uq_user_identities_provider_external; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT uq_user_identities_provider_external UNIQUE (provider_id, external_id);


--
-- Name: user_group_memberships user_group_memberships_user_id_group_id_pk; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_user_id_group_id_pk PRIMARY KEY (user_id, group_id);


--
-- Name: user_groups user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (id);


--
-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (id);


--
-- Name: user_organizations user_organizations_user_id_organization_id_pk; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_organization_id_pk PRIMARY KEY (user_id, organization_id);


--
-- Name: user_role_assignments user_role_assignments_user_id_role_id_organization_id_pk; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_role_id_organization_id_pk PRIMARY KEY (user_id, role_id, organization_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action, created_at);


--
-- Name: idx_audit_logs_category; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_audit_logs_category ON public.audit_logs USING btree (category, created_at);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_audit_logs_org ON public.audit_logs USING btree (organization_id, created_at);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id, created_at);


--
-- Name: idx_edges_source; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_edges_source ON public.entity_edges USING btree (source_entity_id);


--
-- Name: idx_edges_source_type; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_edges_source_type ON public.entity_edges USING btree (source_entity_id, relationship_type);


--
-- Name: idx_edges_target; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_edges_target ON public.entity_edges USING btree (target_entity_id);


--
-- Name: idx_edges_target_type; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_edges_target_type ON public.entity_edges USING btree (target_entity_id, relationship_type);


--
-- Name: idx_edges_tenant; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_edges_tenant ON public.entity_edges USING btree (tenant_id);


--
-- Name: idx_edges_type; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_edges_type ON public.entity_edges USING btree (relationship_type);


--
-- Name: idx_entities_base; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_entities_base ON public.entities USING btree (base_type);


--
-- Name: idx_entities_health; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_entities_health ON public.entities USING btree (health_score);


--
-- Name: idx_entities_location; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_entities_location ON public.entities USING btree (location_ref);


--
-- Name: idx_entities_parent; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_entities_parent ON public.entities USING btree (parent_id);


--
-- Name: idx_entities_tenant; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_entities_tenant ON public.entities USING btree (tenant_id);


--
-- Name: idx_entities_type; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_entities_type ON public.entities USING btree (type_definition_id);


--
-- Name: idx_events_correlation; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_events_correlation ON public.system_events USING btree (correlation_id);


--
-- Name: idx_events_entity; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_events_entity ON public.system_events USING btree (entity_id, created_at);


--
-- Name: idx_events_tenant; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_events_tenant ON public.system_events USING btree (tenant_id);


--
-- Name: idx_events_type; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_events_type ON public.system_events USING btree (event_type, created_at);


--
-- Name: idx_events_unprocessed; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_events_unprocessed ON public.system_events USING btree (processed, created_at);


--
-- Name: idx_group_role_assignments_group; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_group_role_assignments_group ON public.group_role_assignments USING btree (group_id);


--
-- Name: idx_group_role_assignments_role; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_group_role_assignments_role ON public.group_role_assignments USING btree (role_id);


--
-- Name: idx_identity_providers_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_identity_providers_org ON public.identity_providers USING btree (organization_id);


--
-- Name: idx_identity_providers_type; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_identity_providers_type ON public.identity_providers USING btree (type);


--
-- Name: idx_impersonation_sessions_expires; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_impersonation_sessions_expires ON public.impersonation_sessions USING btree (expires_at);


--
-- Name: idx_impersonation_sessions_impersonator; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_impersonation_sessions_impersonator ON public.impersonation_sessions USING btree (impersonator_id);


--
-- Name: idx_impersonation_sessions_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_impersonation_sessions_org ON public.impersonation_sessions USING btree (organization_id);


--
-- Name: idx_impersonation_sessions_status; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_impersonation_sessions_status ON public.impersonation_sessions USING btree (status);


--
-- Name: idx_impersonation_sessions_target; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_impersonation_sessions_target ON public.impersonation_sessions USING btree (target_user_id);


--
-- Name: idx_org_invitations_email; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_org_invitations_email ON public.organization_invitations USING btree (email);


--
-- Name: idx_org_invitations_org_id; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_org_invitations_org_id ON public.organization_invitations USING btree (organization_id);


--
-- Name: idx_org_invitations_status; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_org_invitations_status ON public.organization_invitations USING btree (status);


--
-- Name: idx_org_invitations_token; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_org_invitations_token ON public.organization_invitations USING btree (token_hash);


--
-- Name: idx_organization_profiles_active; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organization_profiles_active ON public.organization_profiles USING btree (is_active);


--
-- Name: idx_organization_profiles_name; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organization_profiles_name ON public.organization_profiles USING btree (name);


--
-- Name: idx_organization_profiles_type; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organization_profiles_type ON public.organization_profiles USING btree (type);


--
-- Name: idx_organizations_org_code; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organizations_org_code ON public.organizations USING btree (org_code);


--
-- Name: idx_organizations_org_code_root; Type: INDEX; Schema: public; Owner: argus
--

CREATE UNIQUE INDEX idx_organizations_org_code_root ON public.organizations USING btree (org_code, root_organization_id);


--
-- Name: idx_organizations_parent; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organizations_parent ON public.organizations USING btree (parent_organization_id);


--
-- Name: idx_organizations_path_btree; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organizations_path_btree ON public.organizations USING btree (path);


--
-- Name: idx_organizations_path_gist; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organizations_path_gist ON public.organizations USING gist (path);


--
-- Name: idx_organizations_profile; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organizations_profile ON public.organizations USING btree (profile_id);


--
-- Name: idx_organizations_root; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organizations_root ON public.organizations USING btree (root_organization_id);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_organizations_subdomain; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_organizations_subdomain ON public.organizations USING btree (subdomain);


--
-- Name: idx_password_reset_tokens_expires_at; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_token_hash; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_password_reset_tokens_token_hash ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_permission_audit_entity; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_permission_audit_entity ON public.permission_audit_log USING btree (entity_id, checked_at);


--
-- Name: idx_permission_audit_person; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_permission_audit_person ON public.permission_audit_log USING btree (person_id, checked_at);


--
-- Name: idx_permission_audit_tenant; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_permission_audit_tenant ON public.permission_audit_log USING btree (tenant_id);


--
-- Name: idx_projects_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_projects_org ON public.projects USING btree (organization_id);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_family_id; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_refresh_tokens_family_id ON public.refresh_tokens USING btree (family_id);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_roles_name; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_roles_name ON public.roles USING btree (name);


--
-- Name: idx_roles_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_roles_org ON public.roles USING btree (organization_id);


--
-- Name: idx_roles_org_name; Type: INDEX; Schema: public; Owner: argus
--

CREATE UNIQUE INDEX idx_roles_org_name ON public.roles USING btree (organization_id, name) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_roles_system; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_roles_system ON public.roles USING btree (is_system);


--
-- Name: idx_roles_system_name; Type: INDEX; Schema: public; Owner: argus
--

CREATE UNIQUE INDEX idx_roles_system_name ON public.roles USING btree (name) WHERE ((organization_id IS NULL) AND (is_system = true));


--
-- Name: idx_telemetry_composite; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_telemetry_composite ON public.telemetry_history USING btree (entity_id, metric_key, "timestamp");


--
-- Name: idx_telemetry_entity_time; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_telemetry_entity_time ON public.telemetry_history USING btree (entity_id, "timestamp");


--
-- Name: idx_telemetry_metric_time; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_telemetry_metric_time ON public.telemetry_history USING btree (metric_key, "timestamp");


--
-- Name: idx_telemetry_tenant; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_telemetry_tenant ON public.telemetry_history USING btree (tenant_id);


--
-- Name: idx_type_def_base; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_type_def_base ON public.type_definitions USING btree (inherits_from);


--
-- Name: idx_type_def_tenant; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_type_def_tenant ON public.type_definitions USING btree (tenant_id);


--
-- Name: idx_user_group_memberships_group; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_group_memberships_group ON public.user_group_memberships USING btree (group_id);


--
-- Name: idx_user_group_memberships_user; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_group_memberships_user ON public.user_group_memberships USING btree (user_id);


--
-- Name: idx_user_groups_name; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_groups_name ON public.user_groups USING btree (name);


--
-- Name: idx_user_groups_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_groups_org ON public.user_groups USING btree (organization_id);


--
-- Name: idx_user_groups_org_name; Type: INDEX; Schema: public; Owner: argus
--

CREATE UNIQUE INDEX idx_user_groups_org_name ON public.user_groups USING btree (organization_id, name);


--
-- Name: idx_user_identities_provider; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_identities_provider ON public.user_identities USING btree (provider_id);


--
-- Name: idx_user_identities_user; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_identities_user ON public.user_identities USING btree (user_id);


--
-- Name: idx_user_organizations_org_id; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_organizations_org_id ON public.user_organizations USING btree (organization_id);


--
-- Name: idx_user_organizations_role; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_organizations_role ON public.user_organizations USING btree (role);


--
-- Name: idx_user_organizations_user_id; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_organizations_user_id ON public.user_organizations USING btree (user_id);


--
-- Name: idx_user_role_assignments_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_role_assignments_org ON public.user_role_assignments USING btree (organization_id);


--
-- Name: idx_user_role_assignments_role; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_role_assignments_role ON public.user_role_assignments USING btree (role_id);


--
-- Name: idx_user_role_assignments_user; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_user_role_assignments_user ON public.user_role_assignments USING btree (user_id);


--
-- Name: idx_users_email_root; Type: INDEX; Schema: public; Owner: argus
--

CREATE UNIQUE INDEX idx_users_email_root ON public.users USING btree (email, root_organization_id);


--
-- Name: idx_users_primary_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_users_primary_org ON public.users USING btree (primary_organization_id);


--
-- Name: idx_users_root_org; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_users_root_org ON public.users USING btree (root_organization_id);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: argus
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: organizations trg_organization_path; Type: TRIGGER; Schema: public; Owner: argus
--

CREATE TRIGGER trg_organization_path BEFORE INSERT OR UPDATE OF parent_organization_id, is_root, slug ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_organization_path();


--
-- Name: user_organizations trg_single_primary_org; Type: TRIGGER; Schema: public; Owner: argus
--

CREATE TRIGGER trg_single_primary_org AFTER INSERT OR UPDATE OF is_primary ON public.user_organizations FOR EACH ROW WHEN ((new.is_primary = true)) EXECUTE FUNCTION public.ensure_single_primary_org();


--
-- Name: audit_logs audit_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entities entities_tenant_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_tenant_id_organizations_id_fk FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: entities entities_type_definition_id_type_definitions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_type_definition_id_type_definitions_id_fk FOREIGN KEY (type_definition_id) REFERENCES public.type_definitions(id) ON DELETE SET NULL;


--
-- Name: entity_edges entity_edges_source_entity_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.entity_edges
    ADD CONSTRAINT entity_edges_source_entity_id_entities_id_fk FOREIGN KEY (source_entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_edges entity_edges_target_entity_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.entity_edges
    ADD CONSTRAINT entity_edges_target_entity_id_entities_id_fk FOREIGN KEY (target_entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_edges entity_edges_tenant_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.entity_edges
    ADD CONSTRAINT entity_edges_tenant_id_organizations_id_fk FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: group_role_assignments group_role_assignments_assigned_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.group_role_assignments
    ADD CONSTRAINT group_role_assignments_assigned_by_users_id_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: group_role_assignments group_role_assignments_group_id_user_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.group_role_assignments
    ADD CONSTRAINT group_role_assignments_group_id_user_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.user_groups(id) ON DELETE CASCADE;


--
-- Name: group_role_assignments group_role_assignments_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.group_role_assignments
    ADD CONSTRAINT group_role_assignments_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: identity_providers identity_providers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.identity_providers
    ADD CONSTRAINT identity_providers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: impersonation_sessions impersonation_sessions_impersonator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_impersonator_id_fkey FOREIGN KEY (impersonator_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: impersonation_sessions impersonation_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: impersonation_sessions impersonation_sessions_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_branding organization_branding_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_branding
    ADD CONSTRAINT organization_branding_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_invitations organization_invitations_accepted_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_accepted_by_users_id_fk FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_invitations organization_invitations_invited_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_invited_by_users_id_fk FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_invitations organization_invitations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_parent_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_parent_organization_id_organizations_id_fk FOREIGN KEY (parent_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: organizations organizations_profile_id_tenant_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_profile_id_tenant_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.organization_profiles(id) ON DELETE SET NULL;


--
-- Name: organizations organizations_root_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_root_organization_id_organizations_id_fk FOREIGN KEY (root_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: permission_audit_log permission_audit_log_tenant_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.permission_audit_log
    ADD CONSTRAINT permission_audit_log_tenant_id_organizations_id_fk FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: platform_branding platform_branding_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.platform_branding
    ADD CONSTRAINT platform_branding_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: platform_settings platform_settings_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: projects projects_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_definitions role_definitions_tenant_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.role_definitions
    ADD CONSTRAINT role_definitions_tenant_id_organizations_id_fk FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: roles roles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: system_admins system_admins_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: system_admins system_admins_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: system_events system_events_tenant_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.system_events
    ADD CONSTRAINT system_events_tenant_id_organizations_id_fk FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: telemetry_history telemetry_history_tenant_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.telemetry_history
    ADD CONSTRAINT telemetry_history_tenant_id_organizations_id_fk FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: type_definitions type_definitions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.type_definitions
    ADD CONSTRAINT type_definitions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: type_definitions type_definitions_tenant_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.type_definitions
    ADD CONSTRAINT type_definitions_tenant_id_organizations_id_fk FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_group_memberships user_group_memberships_added_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_added_by_users_id_fk FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_group_memberships user_group_memberships_group_id_user_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_group_id_user_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.user_groups(id) ON DELETE CASCADE;


--
-- Name: user_group_memberships user_group_memberships_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_groups user_groups_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_groups user_groups_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_identities user_identities_provider_id_identity_providers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_provider_id_identity_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.identity_providers(id) ON DELETE CASCADE;


--
-- Name: user_identities user_identities_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_invited_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_invited_by_users_id_fk FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_organizations user_organizations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_assigned_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_assigned_by_users_id_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_role_assignments user_role_assignments_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_primary_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_primary_organization_id_organizations_id_fk FOREIGN KEY (primary_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: users users_root_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: argus
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_root_organization_id_organizations_id_fk FOREIGN KEY (root_organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict jifbCbfDADsbKPM4Z8wYYhaBbOnPMK9vNLkJm88ELmMEWkiMmH6RnLUduM9nGPX

