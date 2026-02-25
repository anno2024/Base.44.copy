import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  BookOpen,
  Upload,
  Link as LinkIcon,
  FileText,
  X,
  Sparkles,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";

export default function CreateCourse() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    llm_config: {
      hint_only_mode: true,
      language: "English",
      tone: "friendly",
      max_help_level: "explanation",
      custom_instructions: "",
    },
    content_sources: [],
  });

  const [linkInput, setLinkInput] = useState("");

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const { file_url, content_text } =
        await base44.integrations.Core.UploadFile({ file });
      setFormData((prev) => ({
        ...prev,
        content_sources: [
          ...prev.content_sources,
          {
            name: file.name,
            type: file.type.includes("pdf") ? "pdf" : "document",
            url: file_url,
            content_text,
          },
        ],
      }));
    }
  };

  const addLink = () => {
    if (linkInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        content_sources: [
          ...prev.content_sources,
          {
            name: linkInput,
            type: "link",
            url: linkInput,
          },
        ],
      }));
      setLinkInput("");
    }
  };

  const removeSource = (index) => {
    setFormData((prev) => ({
      ...prev,
      content_sources: prev.content_sources.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const course = await base44.entities.Course.create({
        ...formData,
        instructor_id: user.id,
      });
      navigate(createPageUrl("CourseManagement") + `?id=${course.id}`);
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            to={createPageUrl("Dashboard")}
            className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Create New Course
          </h1>
          <p className="text-slate-500 mt-2">
            Set up your course and configure the AI learning assistant
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-10">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <button
                onClick={() => s < step && setStep(s)}
                className={`h-10 w-10 rounded-full flex items-center justify-center font-medium transition-all ${
                  s === step
                    ? "bg-slate-900 text-white"
                    : s < step
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {s}
              </button>
              {s < 3 && (
                <div
                  className={`flex-1 h-1 rounded-full ${s < step ? "bg-emerald-500" : "bg-slate-200"}`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                </div>
                Course Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Course Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Introduction to Machine Learning"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Course Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., TDT4140"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="rounded-xl h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what students will learn in this course..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="rounded-xl min-h-[120px]"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!formData.name || !formData.code}
                  className="bg-slate-900 hover:bg-slate-800 rounded-xl px-8"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Content Sources */}
        {step === 2 && (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-emerald-600" />
                </div>
                Course Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-slate-500">
                Upload materials the AI will use to answer student questions.
                PDFs, documents, and links to relevant resources.
              </p>

              {/* Upload Area */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-slate-300 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-7 w-7 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-900">
                    Drop files here or click to upload
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    PDF, DOC, DOCX, or TXT files
                  </p>
                </label>
              </div>

              {/* Add Link */}
              <div className="flex gap-3">
                <Input
                  placeholder="Add a link to external content..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="rounded-xl h-11"
                />
                <Button
                  onClick={addLink}
                  variant="outline"
                  className="rounded-xl px-6"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Add Link
                </Button>
              </div>

              {/* Source List */}
              {formData.content_sources.length > 0 && (
                <div className="space-y-2">
                  {formData.content_sources.map((source, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        {source.type === "link" ? (
                          <LinkIcon className="h-4 w-4 text-slate-400" />
                        ) : (
                          <FileText className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-sm text-slate-700 truncate max-w-md">
                          {source.name}
                        </span>
                      </div>
                      <button
                        onClick={() => removeSource(index)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="rounded-xl"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="bg-slate-900 hover:bg-slate-800 rounded-xl px-8"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: AI Configuration */}
        {step === 3 && (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Settings2 className="h-5 w-5 text-purple-600" />
                </div>
                AI Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-slate-500">
                Configure how the AI assistant responds to students.
              </p>

              {/* Hint Only Mode */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-slate-900">
                      Hint-Only Mode
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    AI provides hints and guidance, never direct answers
                  </p>
                </div>
                <Switch
                  checked={formData.llm_config.hint_only_mode}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      llm_config: {
                        ...formData.llm_config,
                        hint_only_mode: checked,
                      },
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Response Language</Label>
                  <Select
                    value={formData.llm_config.language}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        llm_config: { ...formData.llm_config, language: value },
                      })
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
                    value={formData.llm_config.tone}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        llm_config: { ...formData.llm_config, tone: value },
                      })
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
                  value={formData.llm_config.max_help_level}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      llm_config: {
                        ...formData.llm_config,
                        max_help_level: value,
                      },
                    })
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
                <Label>Custom Instructions (Optional)</Label>
                <Textarea
                  placeholder="Add specific instructions for how the AI should behave in this course..."
                  value={formData.llm_config.custom_instructions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      llm_config: {
                        ...formData.llm_config,
                        custom_instructions: e.target.value,
                      },
                    })
                  }
                  className="rounded-xl min-h-[100px]"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="rounded-xl"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl px-8"
                >
                  {isLoading ? "Creating..." : "Create Course"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
