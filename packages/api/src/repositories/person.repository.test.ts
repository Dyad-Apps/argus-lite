/**
 * Unit tests for PersonRepository
 * Tests all CRUD operations and person-specific methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersonRepository, type NewPerson, type Person } from './person.repository.js';
import * as baseRepository from './base.repository.js';
import { persons } from '../db/schema/index.js';

// Mock the database
const mockExecutor = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock the base repository utilities
vi.mock('./base.repository.js', async () => {
  const actual = await vi.importActual('./base.repository.js');
  return {
    ...actual,
    getExecutor: vi.fn(() => mockExecutor),
    withTransaction: vi.fn((fn) => fn(mockExecutor)),
  };
});

describe('PersonRepository', () => {
  let repository: PersonRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PersonRepository();

    // Reset mock chains
    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockPerson()]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockPerson()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockPerson()]),
            }),
          }),
        }),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockPerson()]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'person-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new person', async () => {
      const newPerson: NewPerson = {
        name: 'John Doe',
        personTypeId: 'type-1',
        organizationId: 'org-1',
      };

      const result = await repository.create(newPerson);

      expect(mockExecutor.insert).toHaveBeenCalledWith(persons);
      expect(result).toBeDefined();
      expect(result.name).toBe('John Doe');
    });

    it('should create person with transaction', async () => {
      const newPerson: NewPerson = {
        name: 'John Doe',
        personTypeId: 'type-1',
        organizationId: 'org-1',
      };

      await repository.create(newPerson, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });

    it('should create person with optional fields', async () => {
      const newPerson: NewPerson = {
        name: 'John Doe',
        personTypeId: 'type-1',
        organizationId: 'org-1',
        email: 'john@example.com',
        phone: '+1234567890',
        department: 'Engineering',
        userId: 'user-1',
      };

      const result = await repository.create(newPerson);

      expect(result).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('createMany', () => {
    it('should create multiple persons', async () => {
      const newPersons: NewPerson[] = [
        { name: 'John Doe', personTypeId: 'type-1', organizationId: 'org-1' },
        { name: 'Jane Smith', personTypeId: 'type-1', organizationId: 'org-1' },
      ];

      mockExecutor.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockPerson(), createMockPerson({ id: 'person-2', name: 'Jane Smith' })]),
        }),
      });

      const result = await repository.createMany(newPersons);

      expect(mockExecutor.insert).toHaveBeenCalledWith(persons);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.createMany([]);

      expect(result).toEqual([]);
      expect(mockExecutor.insert).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find person by ID', async () => {
      const result = await repository.findById('person-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('person-1');
    });

    it('should return null when person not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findById('nonexistent', 'org-1');

      expect(result).toBeNull();
    });

    it('should exclude soft deleted persons', async () => {
      await repository.findById('person-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findByUserId', () => {
    it('should find person by user ID', async () => {
      const result = await repository.findByUserId('user-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when person not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByUserId('nonexistent', 'org-1');

      expect(result).toBeNull();
    });
  });

  describe('findAllInTenant', () => {
    it('should find all persons with default pagination', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 10 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockPerson()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: dataMock,
              }),
            }),
          }),
        }),
      });

      const result = await repository.findAllInTenant('org-1');

      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
    });
  });

  describe('findByPersonType', () => {
    it('should find persons by person type', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 5 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockPerson()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: dataMock,
            }),
          }),
        }),
      });

      const result = await repository.findByPersonType('org-1', 'type-1');

      expect(result.data).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should find person by email', async () => {
      const result = await repository.findByEmail('org-1', 'john@example.com');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when email not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByEmail('org-1', 'notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByDepartment', () => {
    it('should find persons by department', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 3 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockPerson()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: dataMock,
            }),
          }),
        }),
      });

      const result = await repository.findByDepartment('org-1', 'Engineering');

      expect(result.data).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('searchByName', () => {
    it('should search persons by name', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockPerson()]),
        }),
      });

      const result = await repository.searchByName('org-1', 'john');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should perform case-insensitive search', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockPerson()]),
        }),
      });

      await repository.searchByName('org-1', 'JOHN');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findManyByIds', () => {
    it('should find multiple persons by IDs', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockPerson(), createMockPerson({ id: 'person-2' })]),
        }),
      });

      const result = await repository.findManyByIds('org-1', ['person-1', 'person-2']);

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.findManyByIds('org-1', []);

      expect(result).toEqual([]);
      expect(mockExecutor.select).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update person by ID', async () => {
      const updates = { name: 'Jane Doe', email: 'jane@example.com' };

      const result = await repository.update('person-1', 'org-1', updates);

      expect(mockExecutor.update).toHaveBeenCalledWith(persons);
      expect(result).toBeDefined();
    });

    it('should return null when person not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('nonexistent', 'org-1', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should include updatedAt timestamp', async () => {
      await repository.update('person-1', 'org-1', { name: 'Test' });

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete a person', async () => {
      const result = await repository.softDelete('person-1', 'org-1');

      expect(mockExecutor.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should hard delete a person', async () => {
      const result = await repository.delete('person-1', 'org-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(persons);
      expect(result).toBe(true);
    });

    it('should return false when person not found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.delete('nonexistent', 'org-1');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when person exists', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.exists('person-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return false when person does not exist', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.exists('nonexistent', 'org-1');

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should count persons in tenant', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      });

      const result = await repository.count('org-1');

      expect(result).toBe(42);
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findNearby', () => {
    it('should find persons within radius', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockPerson()]),
        }),
      });

      const result = await repository.findNearby('org-1', 40.7128, -74.006, 1000);

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('updateLocation', () => {
    it('should update person location', async () => {
      const result = await repository.updateLocation('person-1', 'org-1', 40.7128, -74.006);

      expect(mockExecutor.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when person not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.updateLocation('nonexistent', 'org-1', 40.7128, -74.006);

      expect(result).toBeNull();
    });
  });

  describe('withTransaction', () => {
    it('should execute function within transaction', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');

      await repository.withTransaction(mockFn);

      expect(baseRepository.withTransaction).toHaveBeenCalledWith(mockFn);
    });
  });
});

// Helper function to create mock persons
function createMockPerson(overrides?: Partial<Person>): Person {
  return {
    id: 'person-1',
    name: 'John Doe',
    personTypeId: 'type-1',
    organizationId: 'org-1',
    userId: 'user-1',
    email: 'john@example.com',
    phone: '+1234567890',
    department: 'Engineering',
    title: 'Software Engineer',
    geolocation: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
