import { prisma } from '../lib/prisma.js';

export interface CourseIdentifier {
  name?: string;
  code?: string;
}

export const parseCourseIdentifier = (prompt?: string | null): CourseIdentifier | null => {
  if (!prompt) return null;
  const match = prompt.match(/course\s+"(.+?)"\s*\((.+?)\)/i);
  if (match) {
    return { name: match[1], code: match[2] };
  }
  return null;
};

export const findCourseFromPrompt = async (appId: string, prompt?: string | null) => {
  const identifier = parseCourseIdentifier(prompt);
  if (!identifier?.name && !identifier?.code) {
    return null;
  }
  return prisma.course.findFirst({
    where: {
      app_id: appId,
      name: identifier.name ?? undefined,
      code: identifier.code ?? undefined
    }
  });
};
