import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Building2,
  LogOut,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Star,
  Search,
  User,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
  status: string;
  created_at: string;
  company?: string;
  location?: string;
}

interface Application {
  id: string;
  status: string;
  created_at: string;
  jobs: Job;
  feedback?: string;
}

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"jobs" | "applications">("jobs");
  const [searchTerm, setSearchTerm] = useState("");
  const [profile, setProfile] = useState<{
    id: string;
    full_name: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    fetchUserProfile();
    fetchJobsAndApplications();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    }
  };

  const fetchJobsAndApplications = async () => {
    try {
      setLoading(true);
      const [jobsResponse, applicationsResponse] = await Promise.all([
        supabase
          .from("jobs")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false }),
        supabase
          .from("applications")
          .select("*, jobs(*)")
          .order("created_at", { ascending: false }),
      ]);

      if (jobsResponse.error) throw jobsResponse.error;
      if (applicationsResponse.error) throw applicationsResponse.error;

      setJobs(jobsResponse.data || []);
      setApplications(applicationsResponse.data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "selected":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "reviewing":
        return <Star className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

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
            <Star className="h-3 w-3 mr-1" />
            Under Review
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "selected":
        return "Congratulations! You have been selected for this position.";
      case "rejected":
        return "Thank you for your interest. We have moved forward with other candidates.";
      case "reviewing":
        return "Your application is currently being reviewed by our team.";
      default:
        return "Your application has been submitted and is pending review.";
    }
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <div className="flex items-center space-x-4">
              {profile && (
                <div className="hidden md:flex items-center">
                  <User className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700">
                    {profile.full_name}
                  </span>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Sign Out
              </button>
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
          {/* Welcome Message */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-sm mb-6">
            <div className="px-6 py-8 sm:px-8">
              <h1 className="text-2xl font-bold text-white mb-2">
                Welcome{profile ? `, ${profile.full_name.split(" ")[0]}` : ""}!
              </h1>
              <p className="text-indigo-100">
                Find the perfect job opportunity and track your applications all
                in one place.
              </p>
            </div>
          </div>

          {/* Search and Tabs */}
          <div className="mb-6 sm:flex sm:items-center sm:justify-between">
            <div className="w-full sm:w-72">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-4 sm:mt-0 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab("jobs")}
                  className={`${
                    activeTab === "jobs"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Briefcase className="h-5 w-5 mr-1.5" />
                  Available Jobs
                </button>
                <button
                  onClick={() => setActiveTab("applications")}
                  className={`${
                    activeTab === "applications"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <FileText className="h-5 w-5 mr-1.5" />
                  My Applications
                </button>
              </nav>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">
                  Loading...
                </span>
              </div>
            </div>
          ) : activeTab === "jobs" ? (
            <div>
              {filteredJobs.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                  <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No jobs available
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Check back later for new opportunities.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredJobs.map((job) => (
                    <motion.div
                      key={job.id}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:border-indigo-300 transition-all"
                    >
                      <div className="p-5">
                        <h3 className="text-lg font-medium text-indigo-600 mb-2 truncate">
                          {job.title}
                        </h3>
                        <div className="flex items-center mb-3 text-sm text-gray-500">
                          <Briefcase className="h-4 w-4 mr-1.5" />
                          <span>{job.company || "ATS Inc."}</span>
                          {job.location && (
                            <>
                              <span className="mx-1.5">•</span>
                              <span>{job.location}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                          {job.description.substring(0, 150)}
                          {job.description.length > 150 ? "..." : ""}
                        </p>
                        <div className="flex justify-between items-center mt-4">
                          <span className="text-xs text-gray-500">
                            Posted{" "}
                            {new Date(job.created_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => navigate(`/jobs/${job.id}`)}
                            className="inline-flex items-center px-3 py-1.5 border border-indigo-600 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 transition-colors"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {applications.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No applications yet
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Start applying for jobs to track your applications here.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {applications.map((application) => (
                    <motion.div
                      key={application.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="bg-white shadow-sm overflow-hidden sm:rounded-lg border border-gray-200"
                    >
                      <div className="px-4 py-5 sm:p-6">
                        <div className="sm:flex sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center">
                              <h3 className="text-lg font-medium text-indigo-600 mr-3">
                                {application.jobs.title}
                              </h3>
                              {getStatusBadge(application.status)}
                            </div>
                            <div className="mt-2 text-sm text-gray-500">
                              <p>
                                Applied on{" "}
                                {new Date(
                                  application.created_at
                                ).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="mt-3">
                              <p className="text-sm text-gray-600">
                                {getStatusText(application.status)}
                              </p>
                              {application.feedback && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                                  <h4 className="text-xs font-medium text-gray-700">
                                    Feedback:
                                  </h4>
                                  <p className="mt-1 text-sm text-gray-600">
                                    {application.feedback}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 sm:mt-0 flex">
                            <button
                              onClick={() =>
                                navigate(`/jobs/${application.jobs.id}`)
                              }
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-colors"
                            >
                              <Briefcase className="h-4 w-4 mr-1.5" />
                              View Job
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
