import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Send, 
  Sparkles,
  FileText,
  BookOpen,
  Layers,
  MessageSquare,
  Loader2,
  User,
  Bot
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const CHAT_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_CHAT_TIMEOUT_MS || 60000);

export default function StudentCourse() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get('id');
  const messagesEndRef = useRef(null);
  
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const courses = await base44.entities.Course.filter({ id: courseId });
      return courses[0];
    },
    enabled: !!courseId
  });

  const { data: mySessions = [] } = useQuery({
    queryKey: ['mySessions', courseId, user?.id],
    queryFn: () => base44.entities.ChatSession.filter({ 
      course_id: courseId, 
      student_id: user?.id 
    }, '-created_date'),
    enabled: !!courseId && !!user?.id
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', courseId],
    queryFn: () => base44.entities.Assignment.filter({ course_id: courseId }),
    enabled: !!courseId
  });

  const { data: flashcards = [] } = useQuery({
    queryKey: ['sharedFlashcards', courseId],
    queryFn: () => base44.entities.Flashcard.filter({ course_id: courseId, shared: true }),
    enabled: !!courseId
  });

  const createSessionMutation = useMutation({
    mutationFn: (data) => base44.entities.ChatSession.create(data),
    onSuccess: (session) => {
      setActiveSession(session);
      setSessionStartTime(Date.now());
      queryClient.invalidateQueries(['mySessions']);
    }
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChatSession.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['mySessions'])
  });

  const startNewChat = () => {
    if (!user?.id) return;
    createSessionMutation.mutate({
      course_id: courseId,
      student_id: user.id,
      student_email: user.email,
      title: 'New Conversation',
      messages: [],
      status: 'active'
    });
  };

  const loadSession = (session) => {
    setActiveSession(session);
    setSessionStartTime(Date.now());
  };

  const sendMessage = async () => {
    if (!message.trim() || !activeSession || !courseId) return;
    
    const submittedMessage = message.trim();
    const userMessage = {
      role: 'user',
      content: submittedMessage,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...(activeSession.messages || []), userMessage];
    setActiveSession({...activeSession, messages: updatedMessages});
    setMessage('');
    setIsStreaming(true);

    const token = window.localStorage.getItem('base44_access_token') || '';
    let timeoutId;

    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
      const response = await fetch(`${API_BASE_URL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        signal: controller.signal,
        body: JSON.stringify({
          course_id: courseId,
          message: submittedMessage,
          conversation: updatedMessages
        })
      });
      clearTimeout(timeoutId);

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Chat request failed');
      }

      const assistantMessage = {
        role: 'assistant',
        content: payload?.answer || 'No answer generated.',
        citations: Array.isArray(payload?.citations) ? payload.citations : [],
        timestamp: new Date().toISOString()
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      
      // Calculate duration
      const durationMinutes = sessionStartTime 
        ? Math.round((Date.now() - sessionStartTime) / 60000) 
        : 0;

      await updateSessionMutation.mutateAsync({
        id: activeSession.id,
        data: { 
          messages: finalMessages,
          duration_minutes: durationMinutes,
          title: updatedMessages[0]?.content?.slice(0, 50) || 'Conversation'
        }
      });

      setActiveSession({...activeSession, messages: finalMessages});
    } catch (error) {
      const messageText = error?.name === 'AbortError'
        ? `Request timed out after ${Math.round(CHAT_REQUEST_TIMEOUT_MS / 1000)} seconds.`
        : error.message;
      const assistantMessage = {
        role: 'assistant',
        content: `I hit an error while generating a response: ${messageText}. Please try again.`,
        timestamp: new Date().toISOString()
      };
      const finalMessages = [...updatedMessages, assistantMessage];
      setActiveSession({ ...activeSession, messages: finalMessages });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  if (isLoading || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl('Dashboard')} className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-4 group">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{course.name}</h1>
              <p className="text-slate-500">{course.code}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1 rounded-xl">
            <TabsTrigger value="chat" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <MessageSquare className="h-4 w-4 mr-2" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="assignments" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <FileText className="h-4 w-4 mr-2" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Layers className="h-4 w-4 mr-2" />
              Flashcards
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sessions Sidebar */}
              <div className="lg:col-span-1">
                <Card className="border-0 shadow-sm rounded-2xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Conversations</CardTitle>
                      <Button 
                        size="sm" 
                        onClick={startNewChat}
                        className="bg-slate-900 hover:bg-slate-800 rounded-lg text-xs"
                      >
                        New Chat
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[400px]">
                      {mySessions.length === 0 ? (
                        <div className="text-center py-8 px-4">
                          <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                          <p className="text-sm text-slate-500">Start a new conversation</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {mySessions.map(session => (
                            <button
                              key={session.id}
                              onClick={() => loadSession(session)}
                              className={`w-full text-left p-3 rounded-xl transition-colors ${
                                activeSession?.id === session.id 
                                  ? 'bg-slate-100' 
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {session.title || 'Conversation'}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {session.duration_minutes || 0} min • {new Date(session.created_date).toLocaleDateString()}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Chat Area */}
              <div className="lg:col-span-3">
                <Card className="border-0 shadow-sm rounded-2xl h-[600px] flex flex-col">
                  {!activeSession ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
                          <Sparkles className="h-8 w-8 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2">AI Learning Assistant</h3>
                        <p className="text-slate-500 mb-6 max-w-sm">
                          Get personalized help with course material. Ask questions, get hints, and deepen your understanding.
                        </p>
                        <Button 
                          onClick={startNewChat}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl px-6"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Start Conversation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Messages */}
                      <ScrollArea className="flex-1 p-6">
                        <div className="space-y-6">
                          {activeSession.messages?.length === 0 && (
                            <div className="text-center py-12">
                              <p className="text-slate-500">Ask your first question!</p>
                            </div>
                          )}
                          {activeSession.messages?.map((msg, index) => (
                            <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                              {msg.role === 'assistant' && (
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                  <Bot className="h-4 w-4 text-white" />
                                </div>
                              )}
                              <div className={`max-w-[80%] ${
                                msg.role === 'user' 
                                  ? 'bg-slate-900 text-white rounded-2xl rounded-tr-md px-4 py-3' 
                                  : 'bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3'
                              }`}>
                                {msg.role === 'user' ? (
                                  <p className="text-sm">{msg.content}</p>
                                ) : (
                                  <div>
                                    <ReactMarkdown className="text-sm prose prose-slate prose-sm max-w-none">
                                      {msg.content}
                                    </ReactMarkdown>
                                    {Array.isArray(msg.citations) && msg.citations.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-slate-200">
                                        <p className="text-xs font-semibold text-slate-600 mb-1">Sources</p>
                                        <ul className="text-xs text-slate-600 space-y-1">
                                          {msg.citations.map((citation) => (
                                            <li key={`${citation.id}-${citation.source}-${citation.page ?? 'na'}`}>
                                              [{citation.id}] {citation.source}
                                              {Number.isInteger(citation.page) ? `, page ${citation.page}` : ''}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {msg.role === 'user' && (
                                <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                                  <User className="h-4 w-4 text-slate-600" />
                                </div>
                              )}
                            </div>
                          ))}
                          {isStreaming && (
                            <div className="flex gap-4">
                              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                <Bot className="h-4 w-4 text-white" />
                              </div>
                              <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3">
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      {/* Input */}
                      <div className="p-4 border-t border-slate-100">
                        <div className="flex gap-3">
                          <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ask a question..."
                            className="rounded-xl resize-none min-h-[50px] max-h-[120px]"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                              }
                            }}
                          />
                          <Button 
                            onClick={sendMessage}
                            disabled={!message.trim() || isStreaming}
                            className="bg-slate-900 hover:bg-slate-800 rounded-xl px-4 self-end"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments">
            {assignments.length === 0 ? (
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="py-16 text-center">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No assignments available yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map(assignment => (
                  <Link key={assignment.id} to={createPageUrl('Assignment') + `?id=${assignment.id}`}>
                    <Card className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
                            <p className="text-sm text-slate-500 mt-1">{assignment.questions?.length || 0} questions</p>
                          </div>
                          <Badge variant="outline" className="rounded-lg">
                            {assignment.due_date ? `Due ${new Date(assignment.due_date).toLocaleDateString()}` : 'No deadline'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Flashcards Tab */}
          <TabsContent value="flashcards">
            {flashcards.length === 0 ? (
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="py-16 text-center">
                  <Layers className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No flashcards shared yet</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                <Link to={createPageUrl('StudyFlashcards') + `?courseId=${courseId}`}>
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl mb-6">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Studying ({flashcards.length} cards)
                  </Button>
                </Link>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {flashcards.slice(0, 6).map(card => (
                    <Card key={card.id} className="border-0 shadow-sm rounded-2xl">
                      <CardContent className="p-5">
                        <p className="font-medium text-slate-900 mb-2">{card.front}</p>
                        <Badge variant="secondary" className="text-xs">{card.topic || 'General'}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
