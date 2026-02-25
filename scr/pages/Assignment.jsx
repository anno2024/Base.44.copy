import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Send,
  Loader2,
  CheckCircle,
  Lightbulb,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from 'react-markdown';

export default function Assignment() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const assignmentId = urlParams.get('id');

  const [user, setUser] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: assignment, isLoading } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: async () => {
      const assignments = await base44.entities.Assignment.filter({ id: assignmentId });
      return assignments[0];
    },
    enabled: !!assignmentId
  });

  const { data: course } = useQuery({
    queryKey: ['course', assignment?.course_id],
    queryFn: async () => {
      const courses = await base44.entities.Course.filter({ id: assignment?.course_id });
      return courses[0];
    },
    enabled: !!assignment?.course_id
  });

  const { data: existingSubmission } = useQuery({
    queryKey: ['submission', assignmentId, user?.id],
    queryFn: async () => {
      const submissions = await base44.entities.Submission.filter({ 
        assignment_id: assignmentId,
        student_id: user?.id 
      });
      return submissions[0];
    },
    enabled: !!assignmentId && !!user?.id
  });

  useEffect(() => {
    if (existingSubmission?.answers) {
      const answerMap = {};
      existingSubmission.answers.forEach(a => {
        answerMap[a.question_id] = a.answer_text;
      });
      setAnswers(answerMap);
    }
  }, [existingSubmission]);

  const submitMutation = useMutation({
    mutationFn: async (data) => {
      if (existingSubmission) {
        return base44.entities.Submission.update(existingSubmission.id, data);
      }
      return base44.entities.Submission.create({
        ...data,
        assignment_id: assignmentId,
        student_id: user.id,
        student_email: user.email
      });
    },
    onSuccess: () => queryClient.invalidateQueries(['submission'])
  });

  const handleSubmit = async () => {
    setIsGeneratingFeedback(true);

    const answersArray = Object.entries(answers).map(([questionId, answerText]) => ({
      question_id: questionId,
      answer_text: answerText
    }));

    // Generate AI feedback
    const feedbackPrompt = `You are evaluating a student's assignment submission for the course "${course?.name}".

Assignment: ${assignment.title}
${assignment.description ? `Description: ${assignment.description}` : ''}

Questions and Student Answers:
${assignment.questions?.map((q, i) => `
Question ${i + 1}: ${q.text}
${q.rubric ? `Rubric: ${q.rubric}` : ''}
Student's Answer: ${answers[q.id] || '[No answer provided]'}
`).join('\n')}

Provide constructive feedback in the following JSON format:
{
  "overall_comment": "Brief overall assessment",
  "strengths": ["List of things done well"],
  "improvements": ["List of areas for improvement"],
  "question_feedback": [
    {"question_id": "q_id", "comment": "Specific feedback for this answer", "score": 0-100}
  ]
}

${course?.llm_config?.hint_only_mode ? 'Remember: Do not give away answers. Provide guidance that helps the student improve their understanding.' : ''}`;

    const feedbackResponse = await base44.integrations.Core.InvokeLLM({
      prompt: feedbackPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          overall_comment: { type: "string" },
          strengths: { type: "array", items: { type: "string" } },
          improvements: { type: "array", items: { type: "string" } },
          question_feedback: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_id: { type: "string" },
                comment: { type: "string" },
                score: { type: "number" }
              }
            }
          }
        }
      }
    });

    const timeSpent = Math.round((Date.now() - startTime) / 60000);

    await submitMutation.mutateAsync({
      answers: answersArray,
      feedback: feedbackResponse,
      time_spent_minutes: existingSubmission?.time_spent_minutes 
        ? existingSubmission.time_spent_minutes + timeSpent 
        : timeSpent,
      status: 'submitted'
    });

    setIsGeneratingFeedback(false);
  };

  if (isLoading || !assignment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const feedback = existingSubmission?.feedback;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link to={createPageUrl('StudentCourse') + `?id=${assignment.course_id}`} className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6 group">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Course
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{assignment.title}</h1>
          {assignment.description && (
            <p className="text-slate-500 mt-2">{assignment.description}</p>
          )}
          {assignment.due_date && (
            <Badge variant="outline" className="mt-4 rounded-lg">
              Due: {new Date(assignment.due_date).toLocaleString()}
            </Badge>
          )}
        </div>

        {/* Feedback Section (if submitted) */}
        {feedback && (
          <Card className="border-0 shadow-sm rounded-2xl mb-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <CheckCircle className="h-5 w-5" />
                Feedback on Your Submission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-slate-700">{feedback.overall_comment}</p>
              </div>

              {feedback.strengths?.length > 0 && (
                <div>
                  <h4 className="font-medium text-emerald-700 flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4" />
                    Strengths
                  </h4>
                  <ul className="space-y-1">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.improvements?.length > 0 && (
                <div>
                  <h4 className="font-medium text-amber-700 flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4" />
                    Areas for Improvement
                  </h4>
                  <ul className="space-y-1">
                    {feedback.improvements.map((s, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Questions */}
        <div className="space-y-6">
          {assignment.questions?.map((question, index) => {
            const questionFeedback = feedback?.question_feedback?.find(f => f.question_id === question.id);
            
            return (
              <Card key={question.id} className="border-0 shadow-sm rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-medium">
                      Question {index + 1}
                    </CardTitle>
                    {question.points && (
                      <Badge variant="secondary" className="rounded-lg">
                        {question.points} points
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-700">{question.text}</p>
                  
                  <Textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => setAnswers({...answers, [question.id]: e.target.value})}
                    placeholder="Type your answer here..."
                    className="rounded-xl min-h-[120px]"
                    disabled={existingSubmission?.status === 'submitted'}
                  />

                  {questionFeedback && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-600">Feedback</span>
                        <div className="flex items-center gap-2">
                          <Progress value={questionFeedback.score} className="w-20 h-2" />
                          <span className="text-sm font-medium">{questionFeedback.score}%</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">{questionFeedback.comment}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Submit Button */}
        {existingSubmission?.status !== 'submitted' && (
          <Button 
            onClick={handleSubmit}
            disabled={isGeneratingFeedback || Object.keys(answers).length === 0}
            className="w-full mt-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl h-12"
          >
            {isGeneratingFeedback ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Feedback...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit for Feedback
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}