import { UserRole } from '@prisma/client';
import type { Env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import {
  serializeAssignment,
  serializeChatSession,
  serializeCourse,
  serializeCourseEnrollment,
  serializeFlashcard,
  serializeSubmission
} from '../utils/serializers.js';
import { RagService } from './rag-service.js';
import type { SourceInput } from './rag-service.js';

const ENTITY_SERIALIZERS = {
  Course: serializeCourse,
  CourseEnrollment: serializeCourseEnrollment,
  Assignment: serializeAssignment,
  Submission: serializeSubmission,
  ChatSession: serializeChatSession,
  Flashcard: serializeFlashcard
} as const;

type EntityName = keyof typeof ENTITY_SERIALIZERS;

const sortFieldMap: Record<string, string> = {
  created_date: 'created_at',
  updated_date: 'updated_at'
};

const isStudent = (role: UserRole) => role === UserRole.student;

interface ListParams {
  sort?: string;
  limit?: number;
  skip?: number;
  query?: Record<string, unknown> | null;
}

export class EntityService {
  private ragService: RagService;

  constructor(private env: Env, ragService = new RagService()) {
    this.ragService = ragService;
  }

  private resolveEntity(entityName: string): EntityName {
    if (entityName in ENTITY_SERIALIZERS) {
      return entityName as EntityName;
    }
    throw Object.assign(new Error(`Unsupported entity ${entityName}`), { status: 404 });
  }

  private getModel(entity: EntityName): any {
    switch (entity) {
      case 'Course':
        return prisma.course;
      case 'CourseEnrollment':
        return prisma.courseEnrollment;
      case 'Assignment':
        return prisma.assignment;
      case 'Submission':
        return prisma.submission;
      case 'ChatSession':
        return prisma.chatSession;
      case 'Flashcard':
        return prisma.flashcard;
      default:
        throw new Error('Unknown entity');
    }
  }

  private buildOrder(sort?: string) {
    if (!sort) return undefined;
    const direction = sort.startsWith('-') ? 'desc' : 'asc';
    const fieldKey = sort.replace(/^[-+]/, '');
    const field = sortFieldMap[fieldKey] ?? fieldKey;
    return { [field]: direction } as Record<string, 'asc' | 'desc'>;
  }

  private parseQuery(raw?: string | string[]): Record<string, unknown> | null {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private buildAccessFilter(entity: EntityName, user: Express.UserClaims) {
    if (user.role === UserRole.admin) {
      if (entity === 'Course') {
        return { app_id: this.env.APP_ID, instructor_id: user.id };
      }
      if (entity === 'CourseEnrollment' || entity === 'Assignment' || entity === 'ChatSession' || entity === 'Flashcard') {
        return { course: { app_id: this.env.APP_ID, instructor_id: user.id } };
      }
      if (entity === 'Submission') {
        return { assignment: { course: { app_id: this.env.APP_ID, instructor_id: user.id } } };
      }
      return {};
    }

    switch (entity) {
      case 'Course':
        return { app_id: this.env.APP_ID };
      case 'CourseEnrollment':
        return { student_id: user.id };
      case 'Assignment':
        return { course: { enrollments: { some: { student_id: user.id } } } };
      case 'Submission':
        return { student_id: user.id };
      case 'ChatSession':
        return { student_id: user.id };
      case 'Flashcard':
        return { OR: [
          { verified: true, course: { enrollments: { some: { student_id: user.id } } } },
          { shared: true, course: { enrollments: { some: { student_id: user.id } } } }
        ] };
      default:
        return {};
    }
  }

  private enforceMutationPermissions(entity: EntityName, user: Express.UserClaims, data?: Record<string, unknown>) {
    if (user.role === UserRole.admin) {
      return;
    }
    switch (entity) {
      case 'CourseEnrollment':
        if (data?.student_id && data.student_id !== user.id) {
          throw Object.assign(new Error('Cannot enroll other students'), { status: 403 });
        }
        break;
      case 'ChatSession':
      case 'Submission':
        if (data?.student_id && data.student_id !== user.id) {
          throw Object.assign(new Error('Cannot act on behalf of other students'), { status: 403 });
        }
        break;
      default:
        throw Object.assign(new Error('Insufficient permissions'), { status: 403 });
    }
  }

  private sanitizeData(entity: EntityName, data: Record<string, unknown>, user: Express.UserClaims) {
    if (entity === 'Course') {
      return {
        ...data,
        app_id: this.env.APP_ID,
        instructor_id: typeof data.instructor_id === 'string' ? data.instructor_id : user.id
      };
    }
    if (entity === 'CourseEnrollment' && isStudent(user.role)) {
      return {
        ...data,
        student_id: user.id,
        student_email: user.email
      };
    }
    if ((entity === 'Submission' || entity === 'ChatSession') && isStudent(user.role)) {
      return {
        ...data,
        student_id: user.id,
        student_email: user.email
      };
    }
    return data;
  }

  async list(entityName: string, params: ListParams, user: Express.UserClaims) {
    const entity = this.resolveEntity(entityName);
    const model = this.getModel(entity);
    const orderBy = this.buildOrder(params.sort);
    const where = this.buildWhere(entity, params.query ?? {}, user);

    const records = await model.findMany({
      where,
      orderBy,
      take: params.limit,
      skip: params.skip
    });
    return records.map(ENTITY_SERIALIZERS[entity]);
  }

  async get(entityName: string, id: string, user: Express.UserClaims) {
    const entity = this.resolveEntity(entityName);
    const model = this.getModel(entity);
    const record = await model.findUnique({ where: { id } });
    if (!record) {
      throw Object.assign(new Error('Not found'), { status: 404 });
    }
    const accessFilter = this.buildAccessFilter(entity, user);
    const matches = await model.count({ where: { id, AND: [accessFilter] } });
    if (matches === 0) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    return ENTITY_SERIALIZERS[entity](record as never);
  }

  async create(entityName: string, body: Record<string, unknown>, user: Express.UserClaims) {
    const entity = this.resolveEntity(entityName);
    this.enforceMutationPermissions(entity, user, body);
    const model = this.getModel(entity);
    const data = this.sanitizeData(entity, body, user);
    await this.validateBeforePersist(entity, data, user);
    const record = await model.create({ data });

    if (entity === 'Course') {
      await this.ragService.syncCourseSources(record.id, (record.content_sources as SourceInput[]) ?? []);
    }

    return ENTITY_SERIALIZERS[entity](record as never);
  }

  async update(entityName: string, id: string, body: Record<string, unknown>, user: Express.UserClaims) {
    const entity = this.resolveEntity(entityName);
    const accessFilter = this.buildAccessFilter(entity, user);
    const model = this.getModel(entity);

    const target = await model.findFirst({ where: { id, AND: [accessFilter] } });
    if (!target) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }

    const sanitized = this.sanitizeData(entity, body, user);
    await this.validateBeforePersist(entity, { ...target, ...sanitized }, user);
    const record = await model.update({ where: { id }, data: sanitized });

    if (entity === 'Course') {
      await this.ragService.syncCourseSources(record.id, (record.content_sources as SourceInput[]) ?? []);
    }

    return ENTITY_SERIALIZERS[entity](record as never);
  }

  async remove(entityName: string, id: string, user: Express.UserClaims) {
    const entity = this.resolveEntity(entityName);
    if (isStudent(user.role) && entity !== 'ChatSession' && entity !== 'Submission') {
      throw Object.assign(new Error('Insufficient permissions'), { status: 403 });
    }
    const accessFilter = this.buildAccessFilter(entity, user);
    const model = this.getModel(entity);
    const target = await model.findFirst({ where: { id, AND: [accessFilter] } });
    if (!target) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    const deleted = await model.delete({ where: { id } });
    return ENTITY_SERIALIZERS[entity](deleted as never);
  }

  parseListParams(req: Express.Request): ListParams {
    return {
      sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      skip: typeof req.query.skip === 'string' ? Number(req.query.skip) : undefined,
      query: this.parseQuery(req.query.q as string | undefined)
    };
  }

  private buildWhere(entity: EntityName, query: Record<string, unknown> | null | undefined, user: Express.UserClaims) {
    const base = query ?? {};
    const access = this.buildAccessFilter(entity, user);
    return { AND: [base, access] };
  }

  private async validateBeforePersist(entity: EntityName, data: Record<string, unknown>, user: Express.UserClaims) {
    switch (entity) {
      case 'Assignment':
      case 'Flashcard':
        if (typeof data.course_id === 'string') {
          await this.ensureInstructorOwnsCourse(data.course_id, user);
        }
        break;
      case 'CourseEnrollment':
        if (typeof data.course_id === 'string') {
          const course = await prisma.course.findUnique({ where: { id: data.course_id, app_id: this.env.APP_ID } });
          if (!course) {
            throw Object.assign(new Error('Course not found'), { status: 404 });
          }
          if (user.role === UserRole.admin) {
            await this.ensureInstructorOwnsCourse(data.course_id, user);
          }
        }
        break;
      case 'ChatSession':
        if (user.role === UserRole.student && typeof data.course_id === 'string') {
          await this.ensureStudentEnrollment(data.course_id, user.id);
        }
        break;
      case 'Submission':
        if (user.role === UserRole.student && typeof data.assignment_id === 'string') {
          const assignment = await prisma.assignment.findUnique({
            where: { id: data.assignment_id },
            include: { course: true }
          });
          if (!assignment?.course_id) {
            throw Object.assign(new Error('Assignment not found'), { status: 404 });
          }
          await this.ensureStudentEnrollment(assignment.course_id, user.id);
        }
        break;
      default:
        break;
    }
  }

  private async ensureInstructorOwnsCourse(courseId: string, user: Express.UserClaims) {
    if (user.role !== UserRole.admin) return;
    const course = await prisma.course.findUnique({ where: { id: courseId, app_id: this.env.APP_ID } });
    if (!course) {
      throw Object.assign(new Error('Course not found'), { status: 404 });
    }
    if (course.instructor_id !== user.id) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
  }

  private async ensureStudentEnrollment(courseId: string, studentId: string) {
    const enrollment = await prisma.courseEnrollment.count({
      where: { course_id: courseId, student_id: studentId }
    });
    if (enrollment === 0) {
      throw Object.assign(new Error('Du er ikke meldt i kurset'), { status: 403 });
    }
  }
}
