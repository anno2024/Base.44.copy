import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  BookOpen, 
  Search,
  CheckCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function BrowseCourses() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['allCourses'],
    queryFn: () => base44.entities.Course.list(),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['myEnrollments', user?.id],
    queryFn: () => base44.entities.CourseEnrollment.filter({ student_id: user?.id }),
    enabled: !!user?.id
  });

  const enrollMutation = useMutation({
    mutationFn: (courseId) => base44.entities.CourseEnrollment.create({
      course_id: courseId,
      student_id: user.id,
      student_email: user.email,
      enrolled_at: new Date().toISOString()
    }),
    onSuccess: () => queryClient.invalidateQueries(['myEnrollments'])
  });

  const isEnrolled = (courseId) => enrollments.some(e => e.course_id === courseId);

  const filteredCourses = courses.filter(course => 
    course.name.toLowerCase().includes(search.toLowerCase()) ||
    course.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link to={createPageUrl('Dashboard')} className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6 group">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Browse Courses</h1>
          <p className="text-slate-500 mt-2">Find and enroll in available courses</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 rounded-xl border-slate-200"
          />
        </div>

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No courses found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCourses.map(course => {
              const enrolled = isEnrolled(course.id);
              return (
                <Card key={course.id} className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="h-7 w-7 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 text-lg">{course.name}</h3>
                          <p className="text-sm text-slate-500 mb-2">{course.code}</p>
                          {course.description && (
                            <p className="text-sm text-slate-600 line-clamp-2">{course.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        {enrolled ? (
                          <Link to={createPageUrl('StudentCourse') + `?id=${course.id}`}>
                            <Button variant="outline" className="rounded-xl">
                              <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                              Enrolled
                            </Button>
                          </Link>
                        ) : (
                          <Button 
                            onClick={() => enrollMutation.mutate(course.id)}
                            disabled={enrollMutation.isPending}
                            className="bg-slate-900 hover:bg-slate-800 rounded-xl"
                          >
                            Enroll
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}