import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import {
  Building2,
  ArrowLeft,
  Briefcase,
  MapPin,
  DollarSign,
  Calendar,
  Wand2,
  Sparkles,
  Info,
  Layers,
  List,
  CheckCircle,
  X,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";

export default function JobPost() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [showAIPreview, setShowAIPreview] = useState(false);
  const [aiFormattedDescription, setAiFormattedDescription] = useState("");
  const [aiFormattedRequirements, setAiFormattedRequirements] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    location: "",
    salary_range: "",
    work_type: "Full-time",
    deadline: "",
    description: "",
    requirements: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // AI-powered job description formatter
  const formatWithAI = async () => {
    if (!formData.description.trim() && !formData.requirements.trim()) {
      toast.error("Please add some job description and requirements first");
      return;
    }

    try {
      setAiProcessing(true);

      // We'll use a prompt to format the job description and requirements
      // This would typically call an external AI service like GPT or your own endpoint
      const prompt = `Format the following job description and requirements to be professional, well-structured, and appealing to candidates:
      
      Job Title: ${formData.title}
      Company: ${formData.company}
      Job Type: ${formData.work_type}
      
      Description:
      ${formData.description}
      
      Requirements:
      ${formData.requirements}
      
      Format both the description and requirements in a clean, professional way. Use bullet points where appropriate. Highlight key responsibilities and qualifications. Make sure the tone is professional and inviting.
      
      Return the formatted content in this JSON structure:
      {
        "formatted_description": "formatted text here",
        "formatted_requirements": "formatted text here"
      }`;

      // Call your AI service - replace this with your actual API endpoint
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2:latest",
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data = await response.json();

      try {
        // Try to parse the AI response as JSON
        // If it's not valid JSON, we'll use regex to extract the content
        let jsonResponse;
        try {
          // First try direct parsing in case we get clean JSON
          jsonResponse = JSON.parse(data.response);
        } catch (parseError) {
          // If that fails, try to extract JSON using regex
          const jsonMatch = data.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonResponse = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("Could not parse AI response");
          }
        }

        // Set the formatted content
        setAiFormattedDescription(jsonResponse.formatted_description || "");
        setAiFormattedRequirements(jsonResponse.formatted_requirements || "");
        setShowAIPreview(true);

        toast.success("Job description formatted successfully!");
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        toast.error("Could not format the job description. Please try again.");
      }
    } catch (error: any) {
      console.error("AI formatting error:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setAiProcessing(false);
    }
  };

  // Use the AI-formatted content
  const applyAIFormatting = () => {
    setFormData({
      ...formData,
      description: aiFormattedDescription,
      requirements: aiFormattedRequirements,
    });
    setShowAIPreview(false);
    toast.success("AI-enhanced content applied to the form!");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to post a job");
      }

      // Get user profile to check if HR
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== "hr") {
        throw new Error("Only HR users can post jobs");
      }

      // Insert the job
      const { data, error } = await supabase
        .from("jobs")
        .insert([
          {
            title: formData.title,
            description: formData.description,
            requirements: formData.requirements,
            company: formData.company || null,
            location: formData.location || null,
            salary_range: formData.salary_range || null,
            work_type: formData.work_type || "Full-time",
            deadline: formData.deadline || null,
            posted_by: user.id,
            status: "open",
          },
        ])
        .select();

      if (error) throw error;

      toast.success("Job posted successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                ATS Suite
              </span>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="px-4 sm:px-0"
        >
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Briefcase className="h-6 w-6 mr-2 text-indigo-600" />
                Post a New Job
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Create a new job posting to attract candidates
              </p>
            </div>

            <div className="px-6 py-5">
              {/* AI preview modal */}
              {showAIPreview && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                  >
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <Sparkles className="h-5 w-5 mr-2 text-indigo-600" />
                        AI-Enhanced Job Description
                      </h3>
                      <button
                        onClick={() => setShowAIPreview(false)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="px-6 py-4">
                      <div className="mb-4">
                        <h4 className="text-md font-medium text-gray-800 mb-2 flex items-center">
                          <Layers className="h-4 w-4 mr-2 text-indigo-500" />
                          Description
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-md text-gray-700 whitespace-pre-line">
                          {aiFormattedDescription}
                        </div>
                      </div>
                      <div className="mb-4">
                        <h4 className="text-md font-medium text-gray-800 mb-2 flex items-center">
                          <List className="h-4 w-4 mr-2 text-indigo-500" />
                          Requirements
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-md text-gray-700 whitespace-pre-line">
                          {aiFormattedRequirements}
                        </div>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-md flex items-start mt-4">
                        <Info className="h-5 w-5 mr-2 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-700">
                          Review the AI-generated content above. You can apply
                          this formatting to your job description or close this
                          preview and continue editing manually.
                        </p>
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                      <button
                        onClick={() => setShowAIPreview(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={applyAIFormatting}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 flex items-center"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Apply AI Formatting
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-indigo-50 border border-indigo-100 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Info className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-indigo-800">
                        Create an attractive job listing
                      </h3>
                      <div className="mt-2 text-sm text-indigo-700">
                        <p>
                          Well-crafted job descriptions attract 3x more
                          qualified candidates. Our AI assistant can help polish
                          your description for better results.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="title"
                        id="title"
                        required
                        value={formData.title}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="e.g., Senior Software Engineer"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label
                      htmlFor="company"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Company Name
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="company"
                        id="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        placeholder="e.g., Acme Inc."
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label
                      htmlFor="location"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Location
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="location"
                        id="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        placeholder="e.g., New York, NY or Remote"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="work_type"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Employment Type
                    </label>
                    <div className="mt-1">
                      <select
                        id="work_type"
                        name="work_type"
                        value={formData.work_type}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      >
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                        <option value="Internship">Internship</option>
                        <option value="Freelance">Freelance</option>
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="salary_range"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Salary Range
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="salary_range"
                        id="salary_range"
                        value={formData.salary_range}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        placeholder="e.g., $80,000 - $100,000"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="deadline"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Application Deadline
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="date"
                        name="deadline"
                        id="deadline"
                        value={formData.deadline}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <div className="flex justify-between items-center">
                      <label
                        htmlFor="description"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Job Description <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={formatWithAI}
                        disabled={
                          aiProcessing ||
                          (!formData.description.trim() &&
                            !formData.requirements.trim())
                        }
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {aiProcessing ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-700 mr-1"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-3 w-3 mr-1" />
                            Enhance with AI
                          </>
                        )}
                      </button>
                    </div>
                    <div className="mt-1">
                      <textarea
                        id="description"
                        name="description"
                        rows={6}
                        required
                        value={formData.description}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                        placeholder="Describe the job responsibilities, expectations, and company culture..."
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Provide a detailed description of the job role and
                      responsibilities.
                    </p>
                  </div>

                  <div className="sm:col-span-6">
                    <label
                      htmlFor="requirements"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Requirements <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <textarea
                        id="requirements"
                        name="requirements"
                        rows={6}
                        required
                        value={formData.requirements}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                        placeholder="List the required qualifications, skills, and experience..."
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      List specific skills, education, and experience required
                      for this job.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="mr-3 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Posting Job...
                      </div>
                    ) : (
                      "Post Job"
                    )}
                  </motion.button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
