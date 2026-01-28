/**
 * Test helpers for route integration tests
 * Provides utilities for mocking auth, repositories, and common test data
 */

import { vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createUserId, createOrganizationId } from '@argus/shared';
import type { AuthUser } from '../../plugins/auth.js';

/**
 * Mock user for authenticated requests
 */
export const mockUser: AuthUser = {
  id: createUserId('00000000-0000-0000-0000-000000000001'),
  email: 'test@example.com',
  organizationContext: {
    rootOrganizationId: createOrganizationId('00000000-0000-0000-0000-000000000010'),
    currentOrganizationId: createOrganizationId('00000000-0000-0000-0000-000000000010'),
    accessibleOrganizationIds: [
      createOrganizationId('00000000-0000-0000-0000-000000000010'),
      createOrganizationId('00000000-0000-0000-0000-000000000011'),
    ],
  },
  organizationId: createOrganizationId('00000000-0000-0000-0000-000000000010'),
};

/**
 * Mock admin user for permission-required routes
 */
export const mockAdminUser: AuthUser = {
  id: createUserId('00000000-0000-0000-0000-000000000002'),
  email: 'admin@example.com',
  organizationContext: {
    rootOrganizationId: createOrganizationId('00000000-0000-0000-0000-000000000010'),
    currentOrganizationId: createOrganizationId('00000000-0000-0000-0000-000000000010'),
    accessibleOrganizationIds: [createOrganizationId('00000000-0000-0000-0000-000000000010')],
  },
  organizationId: createOrganizationId('00000000-0000-0000-0000-000000000010'),
};

/**
 * Generate a mock access token (for header injection)
 */
export function generateMockToken(userId: string = 'user-123'): string {
  return `mock-token-${userId}`;
}

/**
 * Mock the authenticate decorator to inject a user
 */
export function mockAuthenticate(app: FastifyInstance, user: AuthUser = mockUser) {
  app.decorate('authenticate', async (request: any) => {
    request.user = user;
  });
}

/**
 * Mock user data factories
 */
export const mockUserData = {
  createUser: (overrides?: Partial<any>) => ({
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mockHash',
    status: 'active' as const,
    emailVerifiedAt: null,
    lastLoginAt: null,
    rootOrganizationId: '00000000-0000-0000-0000-000000000010',
    primaryOrganizationId: '00000000-0000-0000-0000-000000000010',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),
};

/**
 * Mock organization data factories
 */
export const mockOrgData = {
  createOrg: (overrides?: Partial<any>) => ({
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Test Organization',
    slug: 'test-org',
    orgCode: 'TEST_ORG',
    description: 'Test organization description',
    isActive: true,
    isRoot: true,
    canHaveChildren: true,
    depth: 1,
    path: '00000000-0000-0000-0000-000000000010',
    subdomain: 'test-org',
    plan: 'free' as const,
    profileId: null,
    parentOrganizationId: null,
    rootOrganizationId: '00000000-0000-0000-0000-000000000010',
    settings: {},
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),
};

/**
 * Mock refresh token data
 */
export const mockTokenData = {
  createRefreshToken: (overrides?: Partial<any>) => ({
    id: '00000000-0000-0000-0000-000000000020',
    userId: '00000000-0000-0000-0000-000000000001',
    tokenHash: 'hashed-token',
    familyId: '00000000-0000-0000-0000-000000000021',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),
};

/**
 * Mock group data factories
 */
export const mockGroupData = {
  createGroup: (overrides?: Partial<any>) => ({
    id: '00000000-0000-0000-0000-000000000030',
    name: 'Test Group',
    description: 'Test group description',
    organizationId: '00000000-0000-0000-0000-000000000010',
    createdBy: '00000000-0000-0000-0000-000000000001',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),
};

/**
 * Mock role data factories
 */
export const mockRoleData = {
  createRole: (overrides?: Partial<any>) => ({
    id: '00000000-0000-0000-0000-000000000040',
    name: 'Test Role',
    description: 'Test role description',
    organizationId: '00000000-0000-0000-0000-000000000010',
    permissions: ['read:users', 'write:users'],
    createdBy: '00000000-0000-0000-0000-000000000001',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),
};

/**
 * Create mock repository functions
 */
export const createMockRepositories = () => ({
  userRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    existsByEmail: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    updatePassword: vi.fn(),
    updateLastLogin: vi.fn(),
    softDelete: vi.fn(),
  },
  orgRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findBySubdomain: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    isSlugAvailable: vi.fn(),
    getChildren: vi.fn(),
    getHierarchy: vi.fn(),
  },
  userOrgRepo: {
    addMember: vi.fn(),
    findMembershipOrSuperAdmin: vi.fn(),
    hasRoleOrHigher: vi.fn(),
    getUserOrganizations: vi.fn(),
    getMembers: vi.fn(),
    updateRole: vi.fn(),
    removeMember: vi.fn(),
  },
  refreshTokenRepo: {
    create: vi.fn(),
    findByTokenHashIncludeRevoked: vi.fn(),
    rotate: vi.fn(),
    revokeById: vi.fn(),
    revokeFamilyTokens: vi.fn(),
    revokeAllUserTokens: vi.fn(),
  },
  passwordResetRepo: {
    create: vi.fn(),
    findValidByTokenHash: vi.fn(),
    markUsed: vi.fn(),
  },
  groupRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    findByOrganization: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    isNameAvailable: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    getMembers: vi.fn(),
  },
  roleRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    findByOrganization: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    isNameAvailable: vi.fn(),
    assignToUser: vi.fn(),
    unassignFromUser: vi.fn(),
    getUserRoles: vi.fn(),
  },
  brandingRepo: {
    findByOrganizationId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  systemAdminRepo: {
    isSuperAdmin: vi.fn(),
  },
});

/**
 * Setup successful repository mocks with default responses
 */
export function setupSuccessfulMocks(mocks: ReturnType<typeof createMockRepositories>) {
  // User repository
  mocks.userRepo.create.mockResolvedValue(mockUserData.createUser());
  mocks.userRepo.findById.mockResolvedValue(mockUserData.createUser());
  mocks.userRepo.findByEmail.mockResolvedValue(mockUserData.createUser());
  mocks.userRepo.existsByEmail.mockResolvedValue(false);
  mocks.userRepo.findAll.mockResolvedValue({
    data: [mockUserData.createUser()],
    pagination: {
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });
  mocks.userRepo.update.mockResolvedValue(mockUserData.createUser());
  mocks.userRepo.softDelete.mockResolvedValue(true);
  mocks.userRepo.updateLastLogin.mockResolvedValue(undefined);

  // Organization repository
  mocks.orgRepo.create.mockResolvedValue(mockOrgData.createOrg());
  mocks.orgRepo.findById.mockResolvedValue(mockOrgData.createOrg());
  mocks.orgRepo.findBySlug.mockResolvedValue(mockOrgData.createOrg());
  mocks.orgRepo.findBySubdomain.mockResolvedValue(mockOrgData.createOrg());
  mocks.orgRepo.isSlugAvailable.mockResolvedValue(true);
  mocks.orgRepo.findAll.mockResolvedValue({
    data: [mockOrgData.createOrg()],
    pagination: {
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });
  mocks.orgRepo.update.mockResolvedValue(mockOrgData.createOrg());
  mocks.orgRepo.getChildren.mockResolvedValue([]);

  // User-Organization repository
  mocks.userOrgRepo.addMember.mockResolvedValue(undefined);
  mocks.userOrgRepo.findMembershipOrSuperAdmin.mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    organizationId: '00000000-0000-0000-0000-000000000010',
    role: 'member' as const,
    isPrimary: true,
  });
  mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(true);
  mocks.userOrgRepo.getUserOrganizations.mockResolvedValue([
    {
      userId: '00000000-0000-0000-0000-000000000001',
      organizationId: '00000000-0000-0000-0000-000000000010',
      role: 'member' as const,
      isPrimary: true,
      organization: mockOrgData.createOrg(),
    },
  ]);
  mocks.userOrgRepo.getMembers.mockResolvedValue({
    data: [],
    pagination: {
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    },
  });

  // Refresh token repository
  mocks.refreshTokenRepo.create.mockResolvedValue({
    token: 'mock-refresh-token',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  mocks.refreshTokenRepo.findByTokenHashIncludeRevoked.mockResolvedValue(
    mockTokenData.createRefreshToken()
  );
  mocks.refreshTokenRepo.rotate.mockResolvedValue({
    token: 'new-refresh-token',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  mocks.refreshTokenRepo.revokeAllUserTokens.mockResolvedValue(1);

  // Password reset repository
  mocks.passwordResetRepo.create.mockResolvedValue({
    token: 'reset-token-123',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  mocks.passwordResetRepo.findValidByTokenHash.mockResolvedValue({
    id: '00000000-0000-0000-0000-000000000025',
    userId: '00000000-0000-0000-0000-000000000001',
    tokenHash: 'hashed-reset-token',
    isUsed: false,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date(),
  });

  // Group repository
  mocks.groupRepo.create.mockResolvedValue(mockGroupData.createGroup());
  mocks.groupRepo.findById.mockResolvedValue(mockGroupData.createGroup());
  mocks.groupRepo.isNameAvailable.mockResolvedValue(true);
  mocks.groupRepo.findByOrganization.mockResolvedValue({
    data: [{ ...mockGroupData.createGroup(), memberCount: 0 }],
    pagination: {
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });

  // Role repository
  mocks.roleRepo.create.mockResolvedValue(mockRoleData.createRole());
  mocks.roleRepo.findById.mockResolvedValue(mockRoleData.createRole());
  mocks.roleRepo.isNameAvailable.mockResolvedValue(true);
  mocks.roleRepo.findByOrganization.mockResolvedValue({
    data: [mockRoleData.createRole()],
    pagination: {
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });

  // Branding repository
  mocks.brandingRepo.findByOrganizationId.mockResolvedValue(null);

  // System admin repository
  mocks.systemAdminRepo.isSuperAdmin.mockResolvedValue(false);

  return mocks;
}
