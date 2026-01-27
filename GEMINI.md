# Argus IQ Lite

**Argus IQ Lite** is a streamlined meta-data driven IoT platform.
This project implements the core specifications defined in the platform management repo.

## Critical Contexts & References

The following external paths serve as the **Source of Truth** for architecture, data models, and UI references. Always consult these when planning or implementing features.

### 1. Architecture & Meta-Model Spec
**Location**: `C:\source\platform-argus-mgmt\planning`
**Core Specification**: `C:\source\platform-argus-mgmt\planning\META_MODEL_SPECIFICATION.md`

> **Note**: The `META_MODEL_SPECIFICATION.md` defines the Dynamic Meta-Model, Base Types (Asset, Device, Person, Activity, Space), and the Graph-First/EAV approach.

### 2. Mock UI & Research
**Location**: `C:\source\platfromresearch\Research\reference-ui`
*(Path note: 'platfromresearch' is the correct directory name on disk)*

- Refer to this directory for UI patterns, component designs, and research mockups.
- Contains: `sysadmin` (React Admin), `knowledge-base`, and `shared` components.

---

## Project Structure (Argus IQ Lite)

This is a **pnpm** monorepo:

- **Web Client**: `packages/web`
- **Backend API**: `packages/api`
- **Shared Logic**: `packages/shared`
- **Infrastructure**: `packages/infra`

## Development Guidelines

- **Package Management**: Use `pnpm`.
- **Scripts**: Run `pnpm dev` for parallel development of all packages.
- **Context Loading**: When working on features that touch the data model or core UI layout, **read the linked specification files from the external paths** to ensure alignment with the master plan.

## File Reading Guidelines
- **For external specs ( > 16k chars)**: Use `cat` or `read_file` (if size permits) carefully. `META_MODEL_SPECIFICATION.md` is large (~67KB), so read relevant sections or use `grep` to find specific types if needed, or read in chunks.
