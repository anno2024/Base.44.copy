import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import { loadEnv } from '../src/lib/env.js';

const prisma = new PrismaClient();
const env = loadEnv();

async function main() {
  const instructorPassword = await hashPassword('Instructor!123');
  const studentPassword = await hashPassword('Student!123');

  const instructor = await prisma.user.upsert({
    where: { email: env.DEFAULT_INSTRUCTOR_EMAIL },
    update: {},
    create: {
      email: env.DEFAULT_INSTRUCTOR_EMAIL,
      full_name: 'Demo Instructor',
      role: UserRole.admin,
      password_hash: instructorPassword
    }
  });

  const student = await prisma.user.upsert({
    where: { email: env.DEFAULT_STUDENT_EMAIL },
    update: {},
    create: {
      email: env.DEFAULT_STUDENT_EMAIL,
      full_name: 'Demo Student',
      role: UserRole.student,
      password_hash: studentPassword
    }
  });

  const course = await prisma.course.upsert({
    where: {
      app_id_code: {
        app_id: env.APP_ID,
        code: 'TDT4140'
      }
    },
    update: {},
    create: {
      app_id: env.APP_ID,
      name: 'Programvareutvikling',
      code: 'TDT4140',
      description: 'Project-based course on modern software engineering practices.',
      instructor_id: instructor.id,
      llm_config: {
        hint_only_mode: true,
        language: 'Norwegian',
        tone: 'friendly',
        max_help_level: 'explanation',
        custom_instructions: 'Ask Socratic follow-up questions.'
      },
      content_sources: []
    }
  });

  await prisma.courseEnrollment.upsert({
    where: {
      course_id_student_id: {
        course_id: course.id,
        student_id: student.id
      }
    },
    update: {},
    create: {
      course_id: course.id,
      student_id: student.id,
      student_email: student.email
    }
  });

  await prisma.assignment.upsert({
    where: { id: 'seed-assignment-1' },
    update: {},
    create: {
      id: 'seed-assignment-1',
      course_id: course.id,
      title: 'Scrum Fundamentals',
      description: 'Short answers on Scrum roles and ceremonies.',
      questions: [
        {
          id: 'q1',
          text: 'Forklar Product Owner-rollen i Scrum.',
          type: 'short-answer',
          points: 10,
          rubric: 'Fokuser på ansvar, samarbeid og prioritering.'
        },
        {
          id: 'q2',
          text: 'Hva er formålet med Sprint Retrospective?',
          type: 'short-answer',
          points: 10,
          rubric: 'Beskriv læring, forbedring og teamdynamikk.'
        }
      ],
      feedback_structure: {
        categories: ['Styrker', 'Forbedringsområder', 'Neste steg'],
        include_suggestions: true,
        include_strengths: true
      }
    }
  });

  await prisma.flashcard.createMany({
    data: [
      {
        course_id: course.id,
        front: 'Hva er hovedmålet til Sprint Planning?',
        back: 'Teamet velger mål og arbeidspakker for neste sprint.',
        topic: 'Scrum',
        difficulty: 'easy'
      },
      {
        course_id: course.id,
        front: 'Nevn tre viktige Scrum-artefakter.',
        back: 'Product Backlog, Sprint Backlog, Increment.',
        topic: 'Scrum',
        difficulty: 'medium'
      }
    ]
  });

  console.log('Seed data ready.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
