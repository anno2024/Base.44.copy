// @ts-nocheck
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Settings2,
  Users,
  MessageSquare,
  FileText,
  Clock,
  Plus,
  Upload,
  Download,
  ExternalLink,
  BarChart3,
  BookOpen,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function CourseManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get("id");

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const courses = await base44.entities.Course.filter({ id: courseId });
      return courses[0];
    },
    enabled: !!courseId,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments", courseId],
    queryFn: () =>
      base44.entities.CourseEnrollment.filter({ course_id: courseId }),
    enabled: !!courseId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", courseId],
    queryFn: () =>
      base44.entities.ChatSession.filter(
        { course_id: courseId },
        "-created_date",
      ),
    enabled: !!courseId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments", courseId],
    queryFn: () => base44.entities.Assignment.filter({ course_id: courseId }),
    enabled: !!courseId,
  });

  const { data: flashcards = [] } = useQuery({
    queryKey: ["flashcards", courseId],
    queryFn: () => base44.entities.Flashcard.filter({ course_id: courseId }),
    enabled: !!courseId,
  });

  const deleteCourseMutation = useMutation({
    mutationFn: () => base44.entities.Course.delete(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      navigate(createPageUrl("Dashboard"));
    },
  });

  const [llmConfig, setLlmConfig] = useState(null);
  const [contentSources, setContentSources] = useState([]);
  const [isUploadingRagPdf, setIsUploadingRagPdf] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    if (!course) return;

    setLlmConfig(
      course.llm_config || {
        language: "English",
        tone: "friendly",
        max_help_level: "explanation",
        custom_instructions: "",
      },
    );
    setContentSources(
      Array.isArray(course.content_sources) ? course.content_sources : [],
    );
  }, [course]);

  const saveLlmConfig = async () => {
    if (!courseId || isSavingConfig) return;

    setIsSavingConfig(true);
    try {
      await base44.entities.Course.update(courseId, {
        llm_config: llmConfig,
        content_sources: contentSources,
      });

      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    } catch (error) {
      window.alert(error?.message || "Failed to save AI configuration");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRagPdfUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const invalid = files.find(
      (file) =>
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf"),
    );

    if (invalid) {
      window.alert("Only PDF files are supported for AI content sources.");
      event.target.value = "";
      return;
    }

    setIsUploadingRagPdf(true);
    try {
      const uploadedSources = [];

      for (const file of files) {
        const { file_url, content_text } =
          await base44.integrations.Core.UploadFile({ file });

        uploadedSources.push({
          name: file.name,
          type: "pdf",
          url: file_url,
          content_text,
        });
      }

      setContentSources((prev) => [...prev, ...uploadedSources]);
    } catch (error) {
      window.alert(error?.message || "Failed to upload PDF source");
    } finally {
      setIsUploadingRagPdf(false);
      event.target.value = "";
    }
  };

  const removeRagSource = (index) => {
    setContentSources((prev) =>
      prev.filter((_, sourceIndex) => sourceIndex !== index),
    );
  };

  const [isUploadingAssignment, setIsUploadingAssignment] = useState(false);

  const handleAssignmentPdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      window.alert("Only PDF files are supported for assignments.");
      event.target.value = "";
      return;
    }

    setIsUploadingAssignment(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.Assignment.create({
        course_id: courseId,
        title: file.name.replace(/\.pdf$/i, ""),
        file_name: file.name,
        pdf_url: file_url,
        uploaded_at: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ["assignments", courseId] });
    } catch (error) {
      window.alert(error?.message || "Failed to upload assignment PDF");
    } finally {
      setIsUploadingAssignment(false);
      event.target.value = "";
    }
  };

  const deleteCourse = async () => {
    if (!courseId || deleteCourseMutation.isPending) return;
    const confirmed = window.confirm(
      `Delete "${course?.name || "this course"}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await deleteCourseMutation.mutateAsync();
    } catch (error) {
      window.alert(error?.message || "Failed to delete course");
    }
  };

  const totalTimeMinutes = sessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0,
  );
  const uniqueStudents = new Set(sessions.map((s) => s.student_id)).size;

  if (isLoading || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            to={createPageUrl("Dashboard")}
            className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  {course.name}
                </h1>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={deleteCourse}
              disabled={deleteCourseMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteCourseMutation.isPending ? "Deleting..." : "Delete Course"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
          <StatCard
            icon={Users}
            label="Enrolled Students"
            value={enrollments.length}
          />
          <StatCard
            icon={MessageSquare}
            label="Chat Sessions"
            value={sessions.length}
          />
          <StatCard
            icon={Clock}
            label="Total Hours"
            value={Math.round(totalTimeMinutes / 60)}
          />
          <StatCard
            icon={FileText}
            label="Assignments"
            value={assignments.length}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1 rounded-xl">
            <TabsTrigger
              value="analytics"
              className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Sessions
            </TabsTrigger>
            <TabsTrigger
              value="assignments"
              className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              Assignments
            </TabsTrigger>
            <TabsTrigger
              value="flashcards"
              className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Flashcards
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              AI Settings
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 gap-6">
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Student Activity Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <span className="text-slate-600">
                        Active Students (Last 7 days)
                      </span>
                      <span className="font-semibold text-slate-900">
                        {uniqueStudents}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <span className="text-slate-600">
                        Avg. Session Duration
                      </span>
                      <span className="font-semibold text-slate-900">
                        {sessions.length > 0
                          ? Math.round(totalTimeMinutes / sessions.length)
                          : 0}{" "}
                        min
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <span className="text-slate-600">
                        Total Chat Messages
                      </span>
                      <span className="font-semibold text-slate-900">
                        {sessions.reduce(
                          (acc, s) => acc + (s.messages?.length || 0),
                          0,
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Recent Chat Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No chat sessions yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Messages</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.slice(0, 20).map((session) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {session.student_email || "Anonymous"}
                          </TableCell>
                          <TableCell>
                            {session.title || "General Discussion"}
                          </TableCell>
                          <TableCell>
                            {session.duration_minutes || 0} min
                          </TableCell>
                          <TableCell>{session.messages?.length || 0}</TableCell>
                          <TableCell className="text-slate-500">
                            {new Date(
                              session.created_date,
                            ).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">
                  Course Assignments (PDF)
                </h3>
                <p className="text-sm text-slate-500">
                  Upload PDF assignments for students to view and download.
                </p>
              </div>
              <div>
                <input
                  id="assignment-pdf-upload"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleAssignmentPdfUpload}
                  className="hidden"
                  disabled={isUploadingAssignment}
                />
                <label htmlFor="assignment-pdf-upload">
                  <Button
                    type="button"
                    className="bg-slate-900 hover:bg-slate-800 rounded-xl"
                    disabled={isUploadingAssignment}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploadingAssignment ? "Uploading..." : "Upload PDF"}
                  </Button>
                </label>
              </div>
            </div>
            {assignments.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200">
                <CardContent className="py-12 text-center">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">
                    No assignment PDFs uploaded yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <Card
                    key={assignment.id}
                    className="border-0 shadow-sm rounded-2xl"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-900">
                            {assignment.title ||
                              assignment.file_name ||
                              "Assignment PDF"}
                          </h4>
                          <p className="text-sm text-slate-500">
                            {assignment.file_name || "PDF file"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {assignment.pdf_url ? (
                            <>
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
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open
                                </Button>
                              </a>
                              <a
                                href={assignment.pdf_url}
                                download={
                                  assignment.file_name || assignment.title
                                }
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                              </a>
                            </>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Flashcards Tab */}
          <TabsContent value="flashcards">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Flashcards</h3>
              <Link
                to={createPageUrl("ManageFlashcards") + `?courseId=${courseId}`}
              >
                <Button className="bg-slate-900 hover:bg-slate-800 rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Flashcards
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-600">Verified Cards</span>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {flashcards.filter((f) => f.verified).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Shared with Students</span>
                    <Badge className="bg-indigo-100 text-indigo-700">
                      {flashcards.filter((f) => f.shared).length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Total Flashcards</span>
                    <span className="text-2xl font-semibold">
                      {flashcards.length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="settings">
            {llmConfig && (
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">
                    AI Assistant Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Response Language</Label>
                      <Select
                        value={llmConfig.language}
                        onValueChange={(value) =>
                          setLlmConfig({ ...llmConfig, language: value })
                        }
                      >
                        <SelectTrigger className="rounded-xl h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Norwegian">Norwegian</SelectItem>
                          <SelectItem value="Spanish">Spanish</SelectItem>
                          <SelectItem value="German">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Communication Tone</Label>
                      <Select
                        value={llmConfig.tone}
                        onValueChange={(value) =>
                          setLlmConfig({ ...llmConfig, tone: value })
                        }
                      >
                        <SelectTrigger className="rounded-xl h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="friendly">
                            Friendly & Supportive
                          </SelectItem>
                          <SelectItem value="formal">
                            Formal & Professional
                          </SelectItem>
                          <SelectItem value="socratic">
                            Socratic (Question-based)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Maximum Help Level</Label>
                    <Select
                      value={llmConfig.max_help_level}
                      onValueChange={(value) =>
                        setLlmConfig({ ...llmConfig, max_help_level: value })
                      }
                    >
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hint">Hints Only</SelectItem>
                        <SelectItem value="explanation">
                          Hints + Explanations
                        </SelectItem>
                        <SelectItem value="solution">
                          Full Solutions Allowed
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Instructions</Label>
                    <Textarea
                      value={llmConfig.custom_instructions || ""}
                      onChange={(e) =>
                        setLlmConfig({
                          ...llmConfig,
                          custom_instructions: e.target.value,
                        })
                      }
                      placeholder="Add specific instructions for the AI..."
                      className="rounded-xl min-h-[120px]"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>RAG Content Sources (PDF)</Label>
                        <p className="text-sm text-slate-500 mt-1">
                          Upload or remove PDFs the AI uses as course context.
                        </p>
                      </div>
                      <div>
                        <input
                          id="rag-pdf-upload"
                          type="file"
                          multiple
                          accept="application/pdf,.pdf"
                          onChange={handleRagPdfUpload}
                          className="hidden"
                          disabled={isUploadingRagPdf}
                        />
                        <label htmlFor="rag-pdf-upload">
                          <Button
                            type="button"
                            className="bg-slate-900 hover:bg-slate-800 rounded-xl"
                            disabled={isUploadingRagPdf}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {isUploadingRagPdf ? "Uploading..." : "Upload PDF"}
                          </Button>
                        </label>
                      </div>
                    </div>

                    {contentSources.length > 0 ? (
                      <div className="space-y-2">
                        {contentSources.map((source, index) => (
                          <div
                            key={`${source.url || source.name}-${index}`}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm text-slate-700 truncate">
                                {source.name || "PDF source"}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={() => removeRagSource(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No PDF sources uploaded yet.
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={saveLlmConfig}
                    disabled={isSavingConfig}
                    className="bg-slate-900 hover:bg-slate-800 rounded-xl"
                  >
                    {isSavingConfig ? "Saving..." : "Save Configuration"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
