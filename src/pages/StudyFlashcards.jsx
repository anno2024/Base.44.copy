import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Shuffle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from 'framer-motion';

export default function StudyFlashcards() {
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get('courseId');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [cards, setCards] = useState([]);
  const [studied, setStudied] = useState(new Set());

  const { data: flashcards = [], isLoading } = useQuery({
    queryKey: ['sharedFlashcards', courseId],
    queryFn: () => base44.entities.Flashcard.filter({ course_id: courseId, shared: true }),
    enabled: !!courseId
  });

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const courses = await base44.entities.Course.filter({ id: courseId });
      return courses[0];
    },
    enabled: !!courseId
  });

  useEffect(() => {
    if (flashcards.length > 0) {
      setCards([...flashcards]);
    }
  }, [flashcards]);

  const currentCard = cards[currentIndex];

  const nextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setStudied(prev => new Set([...prev, currentCard?.id]));
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
    }
  };

  const shuffleCards = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setShowAnswer(false);
    setStudied(new Set());
  };

  const resetStudy = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setStudied(new Set());
  };

  const progress = cards.length > 0 ? ((studied.size + (showAnswer ? 1 : 0)) / cards.length) * 100 : 0;

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <Card className="border-0 shadow-sm rounded-2xl max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-slate-500 mb-4">No flashcards available for study</p>
            <Link to={createPageUrl('StudentCourse') + `?id=${courseId}`}>
              <Button className="rounded-xl">Back to Course</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl('StudentCourse') + `?id=${courseId}`} className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6 group">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Course
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Study Flashcards</h1>
              <p className="text-slate-500">{course?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={shuffleCards} className="rounded-lg">
                <Shuffle className="h-4 w-4 mr-2" />
                Shuffle
              </Button>
              <Button variant="outline" size="sm" onClick={resetStudy} className="rounded-lg">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Progress</span>
            <span className="text-sm font-medium">{currentIndex + 1} / {cards.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Flashcard */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard?.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card 
              className="border-0 shadow-lg rounded-3xl overflow-hidden cursor-pointer min-h-[400px] relative"
              onClick={() => setShowAnswer(!showAnswer)}
            >
              <div className={`absolute inset-0 transition-all duration-500 ${showAnswer ? 'opacity-0' : 'opacity-100'}`}>
                <CardContent className="p-8 h-full flex flex-col justify-center items-center text-center bg-gradient-to-br from-white to-slate-50">
                  <div className="mb-4">
                    <Badge variant="secondary" className="rounded-lg">{currentCard?.topic}</Badge>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 rounded-lg ${
                        currentCard?.difficulty === 'easy' ? 'border-emerald-200 text-emerald-700' :
                        currentCard?.difficulty === 'hard' ? 'border-red-200 text-red-700' :
                        'border-amber-200 text-amber-700'
                      }`}
                    >
                      {currentCard?.difficulty}
                    </Badge>
                  </div>
                  <p className="text-xl font-medium text-slate-900 leading-relaxed">{currentCard?.front}</p>
                  <div className="mt-8 flex items-center text-slate-400">
                    <Eye className="h-4 w-4 mr-2" />
                    <span className="text-sm">Click to reveal answer</span>
                  </div>
                </CardContent>
              </div>

              <div className={`absolute inset-0 transition-all duration-500 ${showAnswer ? 'opacity-100' : 'opacity-0'}`}>
                <CardContent className="p-8 h-full flex flex-col justify-center items-center text-center bg-gradient-to-br from-indigo-50 to-purple-50">
                  <p className="text-lg text-slate-700 leading-relaxed">{currentCard?.back}</p>
                  <div className="mt-8 flex items-center text-indigo-400">
                    <EyeOff className="h-4 w-4 mr-2" />
                    <span className="text-sm">Click to hide answer</span>
                  </div>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button 
            variant="outline" 
            onClick={prevCard}
            disabled={currentIndex === 0}
            className="rounded-xl"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <Button 
            onClick={nextCard}
            disabled={currentIndex === cards.length - 1}
            className="bg-slate-900 hover:bg-slate-800 rounded-xl"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Completion */}
        {currentIndex === cards.length - 1 && showAnswer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-center"
          >
            <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
              <CardContent className="p-6">
                <p className="text-emerald-800 font-medium">🎉 You've completed all flashcards!</p>
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Button variant="outline" onClick={resetStudy} className="rounded-xl">
                    Study Again
                  </Button>
                  <Button onClick={shuffleCards} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                    Shuffle & Restart
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}