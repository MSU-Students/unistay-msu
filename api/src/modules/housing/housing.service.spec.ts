import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, beforeEach } from '@jest/globals';
import { Role } from '../../common/enums/role.enum';
import { HousingService } from './housing.service';

describe('HousingService listing management', () => {
  let service: HousingService;
  let propertyStore: any[];

  const createManager = (id: string, role = Role.PROPERTY_MANAGER) => ({
    id,
    role,
    fullName: `Manager ${id}`,
  });

  beforeEach(() => {
    propertyStore = [];

    const propertyRepo = {
      create: (data: any) => ({
        id: data.id || `prop-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }),
      save: async (property: any) => {
        const index = propertyStore.findIndex((item) => item.id === property.id);
        if (index >= 0) {
          propertyStore[index] = { ...propertyStore[index], ...property };
          return propertyStore[index];
        }
        propertyStore.push(property);
        return property;
      },
      findOne: async ({ where }: any) => propertyStore.find((property) => property.id === where.id) || null,
      find: async ({ where }: any) => {
        let results = [...propertyStore];
        if (where?.status) {
          results = results.filter((property) => property.status === where.status);
        }
        if (where?.manager?.id) {
          results = results.filter((property) => property.manager?.id === where.manager.id);
        }
        return results;
      },
      createQueryBuilder: () => ({
        leftJoinAndSelect: () => ({
          andWhere: () => ({
            getMany: async () => propertyStore.filter((property) => property.status !== 'inactive'),
          }),
        }),
      }),
    };

    const applicationRepo = {};

    service = new HousingService(propertyRepo as any, applicationRepo as any);
  });

  it('creates a listing with required fields and defaults status to active', async () => {
    const manager = createManager('mgr-1');

    const property = await service.createProperty(
      {
        title: 'Sunset Residency',
        address: '123 Main St',
        price: 1500,
        unitDetails: {
          unitNumber: 'B-12',
          bedrooms: 2,
          bathrooms: 2,
          size: 980,
        },
        photos: ['a.jpg', 'b.jpg'],
      },
      manager as any,
    );

    expect(property.status).toBe('active');
    expect(property.title).toBe('Sunset Residency');
    expect(property.address).toBe('123 Main St');
    expect(property.price).toBe(1500);
    expect(property.photos).toHaveLength(2);
    expect(property.manager.id).toBe('mgr-1');
  });

  it('updates an owned listing and adds unit details', async () => {
    const manager = createManager('mgr-1');
    const created = await service.createProperty(
      {
        title: 'Sunrise Suites',
        address: '456 Pine Rd',
        price: 1200,
        unitDetails: { unitNumber: 'A-1', bedrooms: 1, bathrooms: 1, size: 600 },
      },
      manager as any,
    );

    const updated = await service.updateProperty(
      created.id,
      {
        title: 'Sunrise Suites Deluxe',
        price: 1350,
        unitDetails: { unitNumber: 'A-1', bedrooms: 2, bathrooms: 2, size: 760 },
        photos: ['new.jpg'],
      },
      manager as any,
    );

    expect(updated.title).toBe('Sunrise Suites Deluxe');
    expect(updated.price).toBe(1350);
    expect(updated.unitDetails.bedrooms).toBe(2);
    expect(updated.photos).toEqual(['new.jpg']);
  });

  it('rejects edits and deactivation from a different manager', async () => {
    const owner = createManager('mgr-owner');
    const otherManager = createManager('mgr-other');
    const created = await service.createProperty(
      {
        title: 'Manager House',
        address: '789 Oak Ave',
        price: 900,
        unitDetails: { unitNumber: 'C-3', bedrooms: 1, bathrooms: 1, size: 500 },
      },
      owner as any,
    );

    await expect(
      service.updateProperty(created.id, { title: 'Hacked Title', price: 1100 }, otherManager as any),
    ).rejects.toThrow(ForbiddenException);

    await expect(service.deactivateProperty(created.id, otherManager as any)).rejects.toThrow(ForbiddenException);
  });

  it('deactivates a listing and excludes it from active query results', async () => {
    const manager = createManager('mgr-1');
    const created = await service.createProperty(
      {
        title: 'Oakwood Homes',
        address: '200 Cedar St',
        price: 1600,
        unitDetails: { unitNumber: 'D-1', bedrooms: 2, bathrooms: 2, size: 900 },
      },
      manager as any,
    );

    const deactivated = await service.deactivateProperty(created.id, manager as any);

    expect(deactivated.status).toBe('inactive');
    const activeProperties = await service.findAllProperties({});
    expect(activeProperties.some((property) => property.id === created.id)).toBe(false);
  });

  it('throws a not found error when editing a missing listing and validates price input', async () => {
    const manager = createManager('mgr-1');

    await expect(service.updateProperty('missing-id', { title: 'Nope', price: 1000 }, manager as any)).rejects.toThrow(
      NotFoundException,
    );

    await expect(
      service.createProperty(
        {
          title: 'Bad Price',
          address: '101 Wrong Way',
          price: -50,
          unitDetails: { unitNumber: 'Z-9', bedrooms: 1, bathrooms: 1, size: 400 },
        },
        manager as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
