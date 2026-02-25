import type {
  Assignment,
  ChatSession,
  Course,
  CourseEnrollment,
  Flashcard,
  Submission,
  User
} from '@prisma/client';

const formatDate = (value: Date | null | undefined) => value?.toISOString() ?? null;

const withTimestamps = <T extends { created_at: Date; updated_at?: Date }>(entity: T) => ({
  created_date: formatDate(entity.created_at),
  updated_date: entity.updated_at ? formatDate(entity.updated_at) : null
});

export const serializeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  role: user.role,
  ...withTimestamps(user)
});

export const serializeCourse = (course: Course) => ({
  id: course.id,
  name: course.name,
  code: course.code,
  description: course.description,
  instructor_id: course.instructor_id,
  llm_config: course.llm_config,
  content_sources: course.content_sources,
  ...withTimestamps(course)
});

export const serializeCourseEnrollment = (enrollment: CourseEnrollment) => ({
  id: enrollment.id,
  course_id: enrollment.course_id,
  student_id: enrollment.student_id,
  student_email: enrollment.student_email,
  enrolled_at: formatDate(enrollment.enrolled_at)
});

export const serializeAssignment = (assignment: Assignment) => ({
  id: assignment.id,
  course_id: assignment.course_id,
  title: assignment.title,
  description: assignment.description,
  questions: assignment.questions,
  due_date: formatDate(assignment.due_date ?? null),
  feedback_structure: assignment.feedback_structure,
  ...withTimestamps(assignment)
});

export const serializeSubmission = (submission: Submission) => ({
  id: submission.id,
  assignment_id: submission.assignment_id,
  student_id: submission.student_id,
  student_email: submission.student_email,
  answers: submission.answers,
  feedback: submission.feedback,
  time_spent_minutes: submission.time_spent_minutes,
  status: submission.status,
  ...withTimestamps(submission)
});

export const serializeChatSession = (session: ChatSession) => ({
  id: session.id,
  course_id: session.course_id,
  student_id: session.student_id,
  student_email: session.student_email,
  title: session.title,
  messages: session.messages,
  duration_minutes: session.duration_minutes,
  topics_discussed: session.topics_discussed,
  status: session.status,
  ...withTimestamps(session)
});

export const serializeFlashcard = (card: Flashcard) => ({
  id: card.id,
  course_id: card.course_id,
  front: card.front,
  back: card.back,
  topic: card.topic,
  difficulty: card.difficulty,
  verified: card.verified,
  shared: card.shared,
  ...withTimestamps(card)
});
