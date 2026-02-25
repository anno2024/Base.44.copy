import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Plus, 
  Trash2,
  GripVertical,
  Save
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function CreateAssignment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get('courseId');
  const assignmentId = urlParams.get('id');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    questions: [],
    due_date: '',
    feedback_structure: {
      categories: ['Accuracy', 'Completeness', 'Understanding'],
      include_suggestions: true,
      include_strengths: true
    }
  });

  const { data: existingAssignment } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: async () => {
      const assignments = await base44.entities.Assignment.filter({ id: assignmentId });
      return assignments[0];
    },
    enabled: !!assignmentId
  });

  useEffect(() => {
    if (existingAssignment) {
      setFormData({
        title: existingAssignment.title || '',
        description: existingAssignment.description || '',
        questions: existingAssignment.questions || [],
        due_date: existingAssignment.due_date || '',
        feedback_structure: existingAssignment.feedback_structure || {
          categories: ['Accuracy', 'Completeness', 'Understanding'],
          include_suggestions: true,
          include_strengths: true
        }
      });
    }
  }, [existingAssignment]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Assignment.create({...data, course_id: courseId}),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignments']);
      navigate(createPageUrl('CourseManagement') + `?id=${courseId}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Assignment.update(assignmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignments']);
      navigate(createPageUrl('CourseManagement') + `?id=${courseId}`);
    }
  });

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [...formData.questions, {
        id: `q_${Date.now()}`,
        text: '',
        type: 'text',
        points: 10,
        rubric: ''
      }]
    });
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setFormData({ ...formData, questions: newQuestions });
  };

  const removeQuestion = (index) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = () => {
    if (assignmentId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link to={createPageUrl('CourseManagement') + `?id=${courseId}`} className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6 group">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Course
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {assignmentId ? 'Edit Assignment' : 'Create Assignment'}
          </h1>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Assignment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Assignment title"
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Instructions for students..."
                  className="rounded-xl min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Questions</CardTitle>
                <Button onClick={addQuestion} variant="outline" className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.questions.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                  <p className="text-slate-500">No questions yet. Click "Add Question" to start.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.questions.map((question, index) => (
                    <div key={question.id} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-700">Question {index + 1}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeQuestion(index)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <Textarea
                          value={question.text}
                          onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                          placeholder="Question text..."
                          className="rounded-xl"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Points</Label>
                            <Input
                              type="number"
                              value={question.points}
                              onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 0)}
                              className="rounded-xl h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Rubric (for AI feedback)</Label>
                            <Input
                              value={question.rubric}
                              onChange={(e) => updateQuestion(index, 'rubric', e.target.value)}
                              placeholder="What should a good answer include?"
                              className="rounded-xl h-9"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feedback Settings */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Feedback Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-900">Include Strengths</p>
                  <p className="text-sm text-slate-500">Highlight what the student did well</p>
                </div>
                <Switch
                  checked={formData.feedback_structure.include_strengths}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    feedback_structure: {...formData.feedback_structure, include_strengths: checked}
                  })}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-900">Include Suggestions</p>
                  <p className="text-sm text-slate-500">Provide improvement suggestions</p>
                </div>
                <Switch
                  checked={formData.feedback_structure.include_suggestions}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    feedback_structure: {...formData.feedback_structure, include_suggestions: checked}
                  })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button 
            onClick={handleSubmit}
            disabled={!formData.title || createMutation.isPending || updateMutation.isPending}
            className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl h-12"
          >
            <Save className="h-4 w-4 mr-2" />
            {assignmentId ? 'Update Assignment' : 'Create Assignment'}
          </Button>
        </div>
      </div>
    </div>
  );
}