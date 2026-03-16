import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Sparkles,
  Check,
  Share2,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ManageFlashcards() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get("courseId");

  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [editingCard, setEditingCard] = useState(null);

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const courses = await base44.entities.Course.filter({ id: courseId });
      return courses[0];
    },
    enabled: !!courseId,
  });

  const { data: flashcards = [], isLoading } = useQuery({
    queryKey: ["flashcards", courseId],
    queryFn: () => base44.entities.Flashcard.filter({ course_id: courseId }),
    enabled: !!courseId,
  });

  const createMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.Flashcard.create({ ...data, course_id: courseId }),
    onSuccess: () => queryClient.invalidateQueries(["flashcards"]),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Flashcard.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(["flashcards"]),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Flashcard.delete(id),
    onSuccess: () => queryClient.invalidateQueries(["flashcards"]),
  });

  const generateFlashcards = async () => {
    setIsGenerating(true);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate 5 educational flashcards for the course "${course?.name}".
${topic ? `Focus on the topic: ${topic}` : ""}
${course?.description ? `Course description: ${course.description}` : ""}

Generate flashcards that test understanding, not just memorization.
Return in this JSON format:
{
  "flashcards": [
    {"front": "Question or concept", "back": "Answer or explanation", "topic": "Topic category", "difficulty": "easy|medium|hard"}
  ]
}`,
      response_json_schema: {
        type: "object",
        properties: {
          flashcards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                front: { type: "string" },
                back: { type: "string" },
                topic: { type: "string" },
                difficulty: { type: "string" },
              },
            },
          },
        },
      },
    });

    for (const card of response.flashcards) {
      await createMutation.mutateAsync({
        front: card.front,
        back: card.back,
        topic: card.topic || topic || "General",
        difficulty: card.difficulty || "medium",
        verified: false,
        shared: false,
      });
    }

    setIsGenerating(false);
    setTopic("");
  };

  const toggleVerified = (card) => {
    updateMutation.mutate({ id: card.id, data: { verified: !card.verified } });
  };

  const toggleShared = (card) => {
    updateMutation.mutate({ id: card.id, data: { shared: !card.shared } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            to={createPageUrl("CourseManagement") + `?id=${courseId}`}
            className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Course
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Manage Flashcards
          </h1>
          <p className="text-slate-500 mt-2">
            Generate, verify, and share flashcards with students
          </p>
        </div>

        {/* Generate Section */}
        <Card className="border-0 shadow-sm rounded-2xl mb-8">
          <CardContent className="p-6">
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label>Generate flashcards for topic (optional)</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Machine Learning basics, Linear Algebra..."
                  className="rounded-xl h-11"
                />
              </div>
              <Button
                onClick={generateFlashcards}
                disabled={isGenerating}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl px-6 h-11"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate 5 Cards
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold text-slate-900">
                {flashcards.length}
              </p>
              <p className="text-sm text-slate-500">Total Cards</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold text-emerald-600">
                {flashcards.filter((f) => f.verified).length}
              </p>
              <p className="text-sm text-slate-500">Verified</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold text-indigo-600">
                {flashcards.filter((f) => f.shared).length}
              </p>
              <p className="text-sm text-slate-500">Shared</p>
            </CardContent>
          </Card>
        </div>

        {/* Flashcards List */}
        {flashcards.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200">
            <CardContent className="py-16 text-center">
              <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                No flashcards yet. Generate some above!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {flashcards.map((card) => (
              <Card key={card.id} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <p className="font-medium text-slate-900 mb-2">
                        {card.front}
                      </p>
                      <p className="text-sm text-slate-600 mb-3">{card.back}</p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="rounded-lg text-xs"
                        >
                          {card.topic || "General"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`rounded-lg text-xs ${
                            card.difficulty === "easy"
                              ? "border-emerald-200 text-emerald-700"
                              : card.difficulty === "hard"
                                ? "border-red-200 text-red-700"
                                : "border-amber-200 text-amber-700"
                          }`}
                        >
                          {card.difficulty}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={card.verified ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleVerified(card)}
                        className={`rounded-lg ${card.verified ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={card.shared ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleShared(card)}
                        className={`rounded-lg ${card.shared ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(card.id)}
                        className="rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
