import { test, describe, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Role } from '../../common/enums/role.enum';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService and UsersService Unit Tests', () => {
  let authService: AuthService;
  let mockUsersRepo: any;
  let usersService: UsersService;
  let mockJwtService: any;
  let userDatabase: any[];

  beforeEach(() => {
    userDatabase = [];

    mockUsersRepo = {
      find: async () => userDatabase,
      findOne: async ({ where }: any) => {
        if (where.id) return userDatabase.find((u) => u.id === where.id) || null;
        if (where.email) return userDatabase.find((u) => u.email.toLowerCase() === where.email.toLowerCase()) || null;
        if (where.studentIdNumber) return userDatabase.find((u) => u.studentIdNumber === where.studentIdNumber) || null;
        return null;
      },
      createQueryBuilder: () => ({
        addSelect: () => ({
          where: (_query: string, params: any) => ({
            getOne: async () => {
              const u = userDatabase.find((user) => user.email.toLowerCase() === params.email.toLowerCase());
              return u || null;
            },
          }),
        }),
      }),
      create: (data: any) => ({
        id: 'test-uuid-' + Math.random().toString(36).substring(7),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }),
      save: async (user: any) => {
        const idx = userDatabase.findIndex((u) => u.id === user.id);
        if (idx >= 0) {
          userDatabase[idx] = { ...userDatabase[idx], ...user };
          return userDatabase[idx];
        }
        userDatabase.push(user);
        return user;
      },
    };

    mockJwtService = {
      sign: (payload: any) => 'mock-jwt-token-for-' + payload.email,
    };

    usersService = new UsersService(mockUsersRepo);
    authService = new AuthService(usersService, mockJwtService as any);
  });

  test('should successfully register a student with valid information and assign Role.STUDENT', async () => {
    const registerDto = {
      email: 'amina.dimaporo@msu.edu.ph',
      password: 'StrongPassword123!',
      fullName: 'Amina Dimaporo',
      studentIdNumber: '2023-00123',
      college: 'College of Natural Sciences and Mathematics (CNSM)',
      course: 'BS Computer Science',
      phoneNumber: '09123456789',
      nickName: 'Ami',
    };

    const result = await authService.register(registerDto);

    assert.ok(result.accessToken, 'Access token should be generated');
    assert.strictEqual(result.user.email, 'amina.dimaporo@msu.edu.ph');
    assert.strictEqual(result.user.role, Role.STUDENT, 'Role must strictly be student');
    assert.strictEqual(result.user.isInstitutionalVerified, true, 'msu.edu.ph email should be institutional verified');
    assert.strictEqual(result.user.studentIdNumber, '2023-00123');
    assert.strictEqual(result.user.fullName, 'Amina Dimaporo');

    // Verify password is encrypted in database
    const savedUser = userDatabase[0];
    assert.ok(savedUser.password, 'Password must be stored');
    assert.notStrictEqual(savedUser.password, 'StrongPassword123!', 'Password must be hashed');
    const isMatch = await bcrypt.compare('StrongPassword123!', savedUser.password);
    assert.strictEqual(isMatch, true, 'Bcrypt compare should match the plain password');
  });

  test('should reject duplicate email during registration', async () => {
    await authService.register({
      email: 'student1@msu.edu.ph',
      password: 'Password1!',
      fullName: 'Student One',
    });

    await assert.rejects(
      async () => {
        await authService.register({
          email: 'student1@msu.edu.ph',
          password: 'Password2!',
          fullName: 'Student One Duplicate',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.strictEqual(err.message, 'An account with this email address already exists.');
        return true;
      },
    );
  });

  test('should reject duplicate student ID number', async () => {
    await authService.register({
      email: 'studentA@msu.edu.ph',
      password: 'Password1!',
      fullName: 'Student A',
      studentIdNumber: '2023-11111',
    });

    await assert.rejects(
      async () => {
        await authService.register({
          email: 'studentB@msu.edu.ph',
          password: 'Password2!',
          fullName: 'Student B',
          studentIdNumber: '2023-11111',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.strictEqual(err.message, 'A student account with this Student ID Number already exists.');
        return true;
      },
    );
  });

  test('should allow student to login with registered credentials', async () => {
    await authService.register({
      email: 'login.test@msu.edu.ph',
      password: 'MySecretPassword123',
      fullName: 'Login Test Student',
    });

    const loginResult = await authService.login({
      email: 'login.test@msu.edu.ph',
      password: 'MySecretPassword123',
    });

    assert.ok(loginResult.accessToken);
    assert.strictEqual(loginResult.user.email, 'login.test@msu.edu.ph');
    assert.strictEqual(loginResult.user.role, Role.STUDENT);
  });

  test('should reject login with wrong password', async () => {
    await authService.register({
      email: 'wrongpass@msu.edu.ph',
      password: 'CorrectPassword123',
      fullName: 'Wrong Pass Student',
    });

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'wrongpass@msu.edu.ph',
          password: 'IncorrectPassword',
        });
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.strictEqual(err.message, 'Invalid email or password.');
        return true;
      },
    );
  });
});

