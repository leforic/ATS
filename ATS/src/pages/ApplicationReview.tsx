import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import {
  Building2,
  ArrowLeft,
  FileText,
  Briefcase,
  Users,
  Calendar,
  BarChart4,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";

interface Application {
  id: string;
  candidate_name?: string;
  candidate_email?: string;
  resume?: string;
  resume_txt?: string;
  resume_text?: string;
  file_name?: string;
  coverletter?: string;
  status: string;
  created_at: string;
  candidate?: {
    full_name: string;
    email: string;
  };
  parsed_resume?: {
    parsed_data: any;
    match_score: number;
    match_details: any;
  };
}

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
  created_at: string;
  deadline?: string;
}

export default function ApplicationReview() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [applications, setApplications] = useState<Application[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    selected: 0,
    rejected: 0,
    pending: 0,
  });
  const [analyzingApps, setAnalyzingApps] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    if (id) {
      fetchJobAndApplications();
    }
  }, [id]);

  async function fetchJobAndApplications() {
    try {
      setLoading(true);
      setError(null);

      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (jobError) throw jobError;

      if (!jobData) {
        throw new Error("Job not found");
      }

      setJob(jobData);

      // Fetch applications with candidate profiles
      const { data: appData, error: appError } = await supabase
        .from("applications")
        .select(
          `
          *,
          candidate:profiles(id, full_name, email),
          parsed_resume:parsed_resumes(*)
        `
        )
        .eq("job_id", id);

      if (appError) throw appError;

      const formattedApps = appData || [];

      // Log if any applications have missing candidate data for debugging
      const missingCandidateData = formattedApps.filter(
        (app) => !app.candidate
      );
      if (missingCandidateData.length > 0) {
        console.warn(
          `${missingCandidateData.length} applications are missing candidate data`
        );
      }

      setApplications(formattedApps);

      // Calculate statistics
      const total = formattedApps.length;
      const selected = formattedApps.filter(
        (app) => app.status === "selected"
      ).length;
      const rejected = formattedApps.filter(
        (app) => app.status === "rejected"
      ).length;
      const pending = total - selected - rejected;

      setStats({
        total,
        selected,
        rejected,
        pending,
      });
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setError(error.message);
      toast.error(error.message || "Failed to load application data");
    } finally {
      setLoading(false);
    }
  }

  async function analyzeApplications() {
    if (!job || !applications.length) return;

    try {
      setAnalyzingApps(true);
      toast.success(`Analyzing ${applications.length} applications...`);

      let updatedApplications = [...applications];
      let processed = 0;

      // Process applications in batches to avoid overwhelming the server
      for (let i = 0; i < applications.length; i++) {
        const app = applications[i];

        // Skip if already analyzed and has a match score
        if (app.parsed_resume?.match_score > 0) {
          processed++;
          continue;
        }

        try {
          // Get resume text from the appropriate field
          const resumeText =
            app.resume_txt || app.resume_text || "No resume text available.";

          // Create prompt with job description, requirements and application details
          const prompt = `
Job Title: ${job.title}

Job Description:
${job.description}

Job Requirements:
${job.requirements}

Resume Content:
${resumeText}

Cover Letter:
${app.coverletter || "No cover letter provided."}
          
Task: Analyze this application against the job requirements. 
Provide a match score from 0-100 based on how well the candidate's qualifications match the job requirements.
Return ONLY a valid JSON object in this format:
{
  "match_score": [number between 0-100],
  "match_comments": [short explanation of the score],
  "key_skills_present": [list of key skills that match],
  "key_skills_missing": [list of key requirements that aren't met]
}`;

          console.log(`Analyzing application ${i + 1}/${applications.length}`);

          // Send to AI service
          const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama3.2:latest",
              prompt: prompt,
              stream: false,
            }),
          });

          if (!response.ok) {
            console.error(`API error: ${response.status}`);
            continue;
          }

          const data = await response.json();
          console.log("AI response:", data.response);

          // Parse the JSON response
          try {
            // First try direct parsing
            let analysisResult;
            try {
              analysisResult = JSON.parse(data.response.trim());
            } catch (e) {
              // If direct parse fails, try to extract JSON using regex
              const jsonMatch = data.response.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                analysisResult = JSON.parse(jsonStr);
              } else {
                throw new Error("Could not extract JSON from response");
              }
            }

            // Check if we have a valid result with match_score
            if (
              analysisResult &&
              typeof analysisResult.match_score !== "undefined"
            ) {
              // Update this application with the analysis result
              updatedApplications[i] = {
                ...app,
                parsed_resume: {
                  parsed_data: app.parsed_resume?.parsed_data || {},
                  match_score: analysisResult.match_score,
                  match_details: {
                    comments: analysisResult.match_comments,
                    skills_present: analysisResult.key_skills_present,
                    skills_missing: analysisResult.key_skills_missing,
                  },
                },
              };

              // Save to database if needed
              try {
                await supabase.from("parsed_resumes").upsert(
                  {
                    application_id: app.id,
                    parsed_data: app.parsed_resume?.parsed_data || {},
                    match_score: analysisResult.match_score,
                    match_details: {
                      comments: analysisResult.match_comments,
                      skills_present: analysisResult.key_skills_present,
                      skills_missing: analysisResult.key_skills_missing,
                    },
                  },
                  { onConflict: "application_id" }
                );
              } catch (dbError) {
                console.error("Failed to save analysis to database:", dbError);
              }
            }
          } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
          }
        } catch (appError) {
          console.error(`Error analyzing application ${app.id}:`, appError);
        }

        processed++;
        // Update progress every few applications
        if (processed % 3 === 0 || processed === applications.length) {
          toast.success(
            `Analyzed ${processed}/${applications.length} applications`
          );
          // Update the state to show progress
          setApplications([...updatedApplications]);
        }

        // Small delay to avoid overwhelming the AI service
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Final update of applications with all analysis results
      setApplications(updatedApplications);
      setAnalysisComplete(true);
      toast.success("Analysis complete!");
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Analysis failed: " + (error.message || "Unknown error"));
    } finally {
      setAnalyzingApps(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "selected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Selected
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </span>
        );
      case "reviewing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <BarChart4 className="h-3 w-3 mr-1" />
            Reviewing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
    }
  };

  const getDisplayName = (application: Application | null): string => {
    if (!application) return "Unknown Candidate";

    if (application.candidate_name) {
      return application.candidate_name;
    }

    // Try to extract name from resume path if available
    if (application.resume) {
      const parts = application.resume.split("/");
      if (parts.length > 2) {
        // If it's a guest application, try to get from file name
        if (parts.includes("guest")) {
          return "Guest Applicant";
        }
      }
    }

    // If file_name is available, maybe we can extract something useful
    if (application.file_name) {
      return `Applicant (${application.file_name.split(".")[0]})`;
    }

    // If there's a candidate object from the old structure, use it
    if (application.candidate && application.candidate.full_name) {
      return application.candidate.full_name;
    }

    return "Unknown Candidate";
  };

  const getDisplayEmail = (application: Application | null): string => {
    if (!application) return "No email provided";

    if (application.candidate_email) {
      return application.candidate_email;
    }

    // Maybe we can find email in other fields as fallback
    if (application.coverletter && application.coverletter.includes("@")) {
      // Try to extract email from coverletter
      const emailMatch = application.coverletter.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
      );
      if (emailMatch) return emailMatch[0];
    }

    // If there's a candidate object from the old structure, use it
    if (application.candidate && application.candidate.email) {
      return application.candidate.email;
    }

    return "No email provided";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-3 text-sm text-gray-600">
            Loading application data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white shadow-md rounded-lg p-8">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white shadow-md rounded-lg p-8">
          <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">
            Job not found
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            The job you're looking for doesn't exist or may have been removed.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

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
              <div className="sm:flex-auto">
                <h1 className="text-xl font-semibold text-gray-900">
                  Applications for {job.title}
                </h1>
                <p className="mt-2 text-sm text-gray-700">
                  Review and manage candidates who have applied for this
                  position.
                </p>
              </div>
              <div className="flex gap-3 mt-4 sm:mt-0">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </button>
                <button
                  onClick={analyzeApplications}
                  disabled={analyzingApps}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                    analyzingApps
                      ? "bg-gray-400"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors`}
                >
                  {analyzingApps ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <BarChart4 className="h-4 w-4 mr-1.5" />
                      AI Review Applications
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="px-4 sm:px-0"
        >
          {/* Job Header */}
          <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Briefcase className="h-6 w-6 mr-2 text-indigo-600" />
                  {job.title}
                </h2>
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <Calendar className="h-4 w-4 mr-1" />
                  Posted on {new Date(job.created_at).toLocaleDateString()}
                  {job.deadline && (
                    <span className="ml-3 inline-flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Deadline: {new Date(job.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <motion.div
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-white overflow-hidden shadow-sm rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Applications
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.total}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-white overflow-hidden shadow-sm rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Selected
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.selected}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-white overflow-hidden shadow-sm rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Rejected
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.rejected}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-white overflow-hidden shadow-sm rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Pending Review
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.pending}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Job Details Section */}
          <div className="bg-white shadow-sm overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Job Description
                  </h3>
                  <p className="mt-2 text-gray-600 whitespace-pre-line">
                    {job.description}
                  </p>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Requirements
                  </h3>
                  <p className="mt-2 text-gray-600 whitespace-pre-line">
                    {job.requirements}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Applications Section */}
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Applications ({applications.length})
          </h3>

          {applications.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No applications yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Check back later for new applications.
              </p>
            </div>
          ) : (
            <div className="bg-white shadow-sm overflow-hidden sm:rounded-lg">
              <ul className="divide-y divide-gray-200">
                {applications.map((application) => (
                  <motion.li
                    key={application.id}
                    whileHover={{ backgroundColor: "#f9fafb" }}
                    className="px-4 py-5 sm:p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-lg font-medium text-gray-900 truncate">
                          {getDisplayName(application)}
                        </h4>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <span>{getDisplayEmail(application)}</span>
                          <span className="mx-2">•</span>
                          <span>
                            Applied on{" "}
                            {new Date(
                              application.created_at
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center">
                          {getStatusBadge(application.status)}
                          {application.parsed_resume ? (
                            <div className="group relative">
                              <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 cursor-help">
                                Match Score:{" "}
                                {application.parsed_resume.match_score || 0}%
                              </span>

                              {/* Tooltip with additional details */}
                              <div className="absolute left-0 top-full mt-2 w-64 bg-white shadow-lg rounded-md p-3 text-sm z-10 transform -translate-x-1/2 hidden group-hover:block border border-gray-200">
                                <div className="text-gray-900 font-medium mb-1">
                                  Analysis Details
                                </div>

                                {application.parsed_resume.match_details ? (
                                  <>
                                    <div className="text-gray-700 mb-2 text-xs">
                                      {application.parsed_resume.match_details
                                        .comments || "No additional comments"}
                                    </div>

                                    {application.parsed_resume.match_details
                                      .skills_present &&
                                      application.parsed_resume.match_details
                                        .skills_present.length > 0 && (
                                        <div className="mb-2">
                                          <div className="text-green-700 font-medium text-xs mb-1">
                                            Matching Skills:
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {Array.isArray(
                                              application.parsed_resume
                                                .match_details.skills_present
                                            ) ? (
                                              application.parsed_resume.match_details.skills_present.map(
                                                (skill, i) => (
                                                  <span
                                                    key={i}
                                                    className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded"
                                                  >
                                                    {skill}
                                                  </span>
                                                )
                                              )
                                            ) : (
                                              <span className="text-xs text-gray-500">
                                                Data format error
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                    {application.parsed_resume.match_details
                                      .skills_missing &&
                                      application.parsed_resume.match_details
                                        .skills_missing.length > 0 && (
                                        <div>
                                          <div className="text-red-700 font-medium text-xs mb-1">
                                            Missing Skills:
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {Array.isArray(
                                              application.parsed_resume
                                                .match_details.skills_missing
                                            ) ? (
                                              application.parsed_resume.match_details.skills_missing.map(
                                                (skill, i) => (
                                                  <span
                                                    key={i}
                                                    className="text-xs px-1.5 py-0.5 bg-red-50 text-red-700 rounded"
                                                  >
                                                    {skill}
                                                  </span>
                                                )
                                              )
                                            ) : (
                                              <span className="text-xs text-gray-500">
                                                Data format error
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                  </>
                                ) : (
                                  <div className="text-gray-500 text-xs">
                                    No detailed analysis available
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : analysisComplete ? (
                            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              No score available
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="ml-5 flex-shrink-0">
                        <button
                          onClick={() =>
                            navigate(`/applications/${application.id}/review`)
                          }
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-colors"
                        >
                          <FileText className="h-4 w-4 mr-1.5" />
                          Review Details
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
