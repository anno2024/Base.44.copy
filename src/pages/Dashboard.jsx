/* @ts-nocheck */
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  BookOpen,
  Users,
  MessageSquare,
  Clock,
  Plus,
  ChevronRight,
  Sparkles,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => base44.entities.Course.list(),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => base44.entities.ChatSession.list("-created_date", 100),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => base44.entities.CourseEnrollment.list(),
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ["allAssignments"],
    queryFn: () => base44.entities.Assignment.list(),
  });

  const isInstructor = user?.role === "admin";

  const myCourses = isInstructor
    ? courses.filter((c) => c.instructor_id === user?.id)
    : courses.filter((c) =>
        enrollments.some(
          (e) => e.course_id === c.id && e.student_id === user?.id,
        ),
      );

  const totalStudents = new Set(enrollments.map((e) => e.student_id)).size;
  const totalSessions = sessions.length;
  const totalTimeMinutes = sessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0,
  );

  // Student-specific data
  const mySessions = sessions.filter((s) => s.student_id === user?.id);
  const myStudyTime = mySessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0,
  );
  const myAssignments = allAssignments.filter((a) =>
    myCourses.some((c) => c.id === a.course_id),
  );

  if (coursesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Welcome back
              {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
            </h1>
          </div>
          <p className="text-slate-500 text-lg ml-[52px]">
            {isInstructor
              ? "Manage your courses and track student progress"
              : "Continue your learning journey"}
          </p>
        </div>

        {/* Stats Grid */}
        {isInstructor ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            <StatCard
              icon={BookOpen}
              label="Active Courses"
              value={myCourses.length}
              gradient="from-blue-500 to-cyan-500"
            />
            <StatCard
              icon={Users}
              label="Total Students"
              value={totalStudents}
              gradient="from-emerald-500 to-teal-500"
            />
            <StatCard
              icon={MessageSquare}
              label="Chat Sessions"
              value={totalSessions}
              gradient="from-violet-500 to-purple-500"
            />
            <StatCard
              icon={Clock}
              label="Learning Hours"
              value={Math.round(totalTimeMinutes / 60)}
              gradient="from-orange-500 to-amber-500"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            <StatCard
              icon={BookOpen}
              label="Enrolled Courses"
              value={myCourses.length}
              gradient="from-blue-500 to-cyan-500"
            />
            <StatCard
              icon={Clock}
              label="Study Hours"
              value={Math.round(myStudyTime / 60)}
              gradient="from-emerald-500 to-teal-500"
            />
            <StatCard
              icon={MessageSquare}
              label="Chat Sessions"
              value={mySessions.length}
              gradient="from-violet-500 to-purple-500"
            />
            <StatCard
              icon={FileText}
              label="Assignments"
              value={myAssignments.length}
              gradient="from-orange-500 to-amber-500"
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div
          className={`grid grid-cols-1 gap-8 ${isInstructor ? "" : "lg:grid-cols-3"}`}
        >
          {/* Courses Section */}
          <div className={isInstructor ? "" : "lg:col-span-2"}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                {isInstructor ? "Your Courses" : "My Courses"}
              </h2>
              {isInstructor && (
                <Link to={createPageUrl("CreateCourse")}>
                  <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5">
                    <Plus className="h-4 w-4 mr-2" />
                    New Course
                  </Button>
                </Link>
              )}
            </div>

            {myCourses.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 bg-white/50">
                <CardContent className="py-16 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="h-7 w-7 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    {isInstructor
                      ? "No courses yet"
                      : "Not enrolled in any courses"}
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {isInstructor
                      ? "Create your first course to get started"
                      : "Browse available courses to enroll"}
                  </p>
                  <Link
                    to={createPageUrl(
                      isInstructor ? "CreateCourse" : "BrowseCourses",
                    )}
                  >
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                      {isInstructor ? "Create Course" : "Browse Courses"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    isInstructor={isInstructor}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed - Student */}
          {!isInstructor && (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Recent Activity
              </h2>
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardContent className="p-0">
                  {mySessions.length === 0 ? (
                    <div className="py-12 text-center">
                      <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">No recent activity</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {mySessions.slice(0, 5).map((session) => (
                        <div
                          key={session.id}
                          className="p-4 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {session.title || "Chat Session"}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {session.duration_minutes
                                  ? `${session.duration_minutes} min`
                                  : "In progress"}{" "}
                                •{" "}
                                {new Date(
                                  session.created_date,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Course Assignments */}
              {myAssignments.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">
                    Course Assignments
                  </h2>
                  <Card className="border-0 shadow-sm bg-white rounded-2xl">
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-100">
                        {myAssignments.slice(0, 3).map((assignment) => {
                          return (
                            <div
                              key={assignment.id}
                              className="p-4 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                                  <FileText className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium text-slate-900 truncate">
                                        {assignment.title}
                                      </p>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {assignment.file_name ||
                                          "PDF assignment"}
                                      </p>
                                    </div>
                                    {assignment.pdf_url ? (
                                      <div className="flex gap-2">
                                        <a
                                          href={assignment.pdf_url}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-lg"
                                          >
                                            Open
                                          </Button>
                                        </a>
                                        <a
                                          href={assignment.pdf_url}
                                          download={
                                            assignment.file_name ||
                                            assignment.title
                                          }
                                        >
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-lg"
                                          >
                                            Download
                                          </Button>
                                        </a>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg"
                                        disabled
                                      >
                                        PDF unavailable
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, gradient }) {
  return (
    <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 mb-1">{label}</p>
            <p className="text-3xl font-semibold text-slate-900">{value}</p>
          </div>
          <div
            className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseCard({ course, isInstructor }) {
  return (
    <Link
      to={
        createPageUrl(isInstructor ? "CourseManagement" : "StudentCourse") +
        `?id=${course.id}`
      }
    >
      <Card className="border-0 shadow-sm bg-white rounded-2xl hover:shadow-md transition-all duration-200 cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <BookOpen className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {course.name}
                </h3>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
