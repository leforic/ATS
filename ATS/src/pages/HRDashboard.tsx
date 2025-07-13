import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Building2,
  LogOut,
  Plus,
  PlusCircle,
  Users,
  Briefcase,
  FileText,
  BarChart4,
  User,
  Clock,
  CheckCircle,
  Archive,
  AlertTriangle,
  Trash2,
  Filter,
  XCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";

interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  applications_count: number;
  created_at: string;
}

export default function HRDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalApplications: 0,
    openJobs: 0,
    closedJobs: 0,
  });
  const [profile, setProfile] = useState<{
    id: string;
    full_name: string;
    email: string;
  } | null>(null);
  const [jobFilter, setJobFilter] = useState<"all" | "open" | "closed">("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null
  );
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
    fetchJobs();

    // Debug: Check database connection and jobs table access
    async function checkDatabase() {
      try {
        console.log("Testing database connection...");
        const { data, error } = await supabase
          .from("jobs")
          .select("id, title, status")
          .limit(10);

        if (error) {
          console.error("Database connection test error:", error);
        } else {
          console.log("Database connection successful, found jobs:", data);
        }
      } catch (err) {
        console.error("Failed to test database:", err);
      }
    }

    checkDatabase();
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

  const fetchJobs = async () => {
    try {
      setLoading(true);
      console.log("Fetching all jobs from database...");

      // Get jobs with application counts
      const { data, error } = await supabase
        .from("jobs")
        .select("*, applications:applications(id)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching jobs:", error);
        throw error;
      }

      console.log("Jobs fetched successfully:", data);

      // Process the data to get application counts
      const jobsWithCounts = data.map((job) => ({
        ...job,
        applications_count: job.applications ? job.applications.length : 0,
      }));

      setJobs(jobsWithCounts);

      // Calculate statistics
      const totalJobs = jobsWithCounts.length;
      const openJobs = jobsWithCounts.filter(
        (job) => job.status === "open"
      ).length;
      const closedJobs = jobsWithCounts.filter(
        (job) => job.status === "closed"
      ).length;
      const totalApplications = jobsWithCounts.reduce(
        (sum, job) => sum + job.applications_count,
        0
      );

      setStats({
        totalJobs,
        totalApplications,
        openJobs,
        closedJobs,
      });
    } catch (error: any) {
      console.error("Failed to fetch jobs:", error);
      toast.error("Failed to load jobs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Validate job ID before making changes to database
  const validateJobChange = (jobId: string, action: string): boolean => {
    try {
      // Check if jobId is valid
      if (!jobId || typeof jobId !== "string" || jobId.trim() === "") {
        console.error(`Invalid job ID for ${action}:`, jobId);
        toast.error(`Cannot ${action} job: Invalid job ID`);
        return false;
      }

      // Check if job exists in our local state
      const jobExists = jobs.some((job) => job.id === jobId);
      if (!jobExists) {
        console.error(`Job not found for ${action}:`, jobId);
        toast.error(`Cannot ${action} job: Job not found`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error validating job for ${action}:`, error);
      return false;
    }
  };

  const closeJob = async (jobId: string) => {
    if (!validateJobChange(jobId, "close")) return;

    try {
      setProcessingAction(jobId);
      console.log("Closing job:", jobId);

      // Try using upsert to ensure the operation completes
      const { data, error } = await supabase
        .from("jobs")
        .update({ status: "closed" })
        .match({ id: jobId }) // Use match instead of eq for better targeting
        .select();

      console.log("Update query result:", { data, error });

      if (error) {
        console.error("Direct update error:", error);
        // Try alternate approach with upsert if update fails
        console.log("Trying upsert as fallback...");
        const { data: upsertData, error: upsertError } = await supabase
          .from("jobs")
          .upsert({ id: jobId, status: "closed" }, { onConflict: "id" });

        if (upsertError) {
          console.error("Upsert fallback error:", upsertError);
          throw upsertError;
        }

        console.log("Upsert fallback result:", upsertData);
      }

      // Force a refresh of jobs data from database
      console.log("Refreshing jobs data...");
      await fetchJobs();

      // Update UI state immediately for responsiveness
      setJobs(
        jobs.map((job) =>
          job.id === jobId ? { ...job, status: "closed" } : job
        )
      );

      // Update statistics
      setStats({
        ...stats,
        openJobs: stats.openJobs - 1,
        closedJobs: stats.closedJobs + 1,
      });

      toast.success("Job has been closed successfully");
    } catch (error: any) {
      console.error("Failed to close job:", error);
      toast.error(`Failed to close job: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  const reopenJob = async (jobId: string) => {
    if (!validateJobChange(jobId, "reopen")) return;

    try {
      setProcessingAction(jobId);
      console.log("Reopening job:", jobId);

      // Try using upsert to ensure the operation completes
      const { data, error } = await supabase
        .from("jobs")
        .update({ status: "open" })
        .match({ id: jobId }) // Use match instead of eq for better targeting
        .select();

      console.log("Update query result:", { data, error });

      if (error) {
        console.error("Direct update error:", error);
        // Try alternate approach with upsert if update fails
        console.log("Trying upsert as fallback...");
        const { data: upsertData, error: upsertError } = await supabase
          .from("jobs")
          .upsert({ id: jobId, status: "open" }, { onConflict: "id" });

        if (upsertError) {
          console.error("Upsert fallback error:", upsertError);
          throw upsertError;
        }

        console.log("Upsert fallback result:", upsertData);
      }

      // Force a refresh of jobs data from database
      console.log("Refreshing jobs data...");
      await fetchJobs();

      // Update UI state immediately for responsiveness
      setJobs(
        jobs.map((job) => (job.id === jobId ? { ...job, status: "open" } : job))
      );

      // Update statistics
      setStats({
        ...stats,
        openJobs: stats.openJobs + 1,
        closedJobs: stats.closedJobs - 1,
      });

      toast.success("Job has been reopened");
    } catch (error: any) {
      console.error("Failed to reopen job:", error);
      toast.error(`Failed to reopen job: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!validateJobChange(jobId, "delete")) return;

    try {
      setProcessingAction(jobId);
      console.log("Attempting to delete job:", jobId);

      // First check if the job has applications
      const job = jobs.find((j) => j.id === jobId);
      if (job && job.applications_count > 0) {
        console.log("Cannot delete job with applications:", job);
        toast.error("Cannot delete a job with applications");
        setDeleteConfirmation(null);
        setProcessingAction(null);
        return;
      }

      // First try a soft delete by updating status to 'deleted'
      console.log("Trying soft delete first...");
      const { data: updateData, error: updateError } = await supabase
        .from("jobs")
        .update({ status: "deleted" })
        .match({ id: jobId })
        .select();

      console.log("Soft delete result:", { updateData, updateError });

      // Then attempt hard delete
      console.log("Attempting hard delete...");
      const { data, error } = await supabase
        .from("jobs")
        .delete()
        .match({ id: jobId });

      console.log("Delete query result:", { data, error });

      if (error) {
        console.error("Direct delete error:", error);
        // If delete fails but soft delete worked, we can consider it a success
        if (updateError) {
          throw error; // Only throw if both operations failed
        } else {
          console.log(
            "Hard delete failed but soft delete succeeded - job is effectively removed"
          );
        }
      }

      // Force a refresh of jobs data from database
      console.log("Refreshing jobs data...");
      await fetchJobs();

      // Update UI state immediately for responsiveness
      const updatedJobs = jobs.filter((j) => j.id !== jobId);
      setJobs(updatedJobs);

      // Update statistics
      if (job) {
        const isOpen = job.status === "open";
        setStats({
          totalJobs: stats.totalJobs - 1,
          openJobs: isOpen ? stats.openJobs - 1 : stats.openJobs,
          closedJobs: isOpen ? stats.closedJobs : stats.closedJobs - 1,
          totalApplications: stats.totalApplications,
        });
      }

      toast.success("Job deleted successfully");
    } catch (error: any) {
      console.error("Failed to delete job:", error);
      toast.error(`Failed to delete job: ${error.message}`);
    } finally {
      setDeleteConfirmation(null);
      setProcessingAction(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Filter jobs based on selected filter
  const filteredJobs =
    jobFilter === "all" ? jobs : jobs.filter((job) => job.status === jobFilter);

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
          {/* Page header */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-5 sm:flex sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  HR Dashboard
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your job postings and track applicants
                </p>
              </div>
              <div className="mt-4 sm:mt-0">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate("/post-job")}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Post New Job
                </motion.button>
              </div>
            </div>
          </div>

          {/* Stats section */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <motion.div
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-white overflow-hidden shadow-sm rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                    <Briefcase className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Jobs
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.totalJobs}
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
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Applications
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.totalApplications}
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
                  <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Positions
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.openJobs}
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
                  <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                    <BarChart4 className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Closed Jobs
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.closedJobs}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Job filter controls */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Your Job Postings
            </h2>

            <div className="inline-flex shadow-sm rounded-md">
              <button
                onClick={() => setJobFilter("all")}
                className={`relative inline-flex items-center px-3 py-1.5 rounded-l-md border text-sm font-medium ${
                  jobFilter === "all"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Filter className="h-4 w-4 mr-1.5" />
                All Jobs
              </button>
              <button
                onClick={() => setJobFilter("open")}
                className={`relative inline-flex items-center px-3 py-1.5 border-t border-b text-sm font-medium ${
                  jobFilter === "open"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Clock className="h-4 w-4 mr-1.5" />
                Active
              </button>
              <button
                onClick={() => setJobFilter("closed")}
                className={`relative inline-flex items-center px-3 py-1.5 rounded-r-md border text-sm font-medium ${
                  jobFilter === "closed"
                    ? "bg-gray-600 text-white border-gray-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Archive className="h-4 w-4 mr-1.5" />
                Closed
              </button>
            </div>
          </div>

          {/* Jobs list */}
          <div>
            {loading ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <div className="inline-flex items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    Loading jobs...
                  </span>
                </div>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <PlusCircle className="h-12 w-12" />
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {jobFilter === "all"
                    ? "No job postings"
                    : jobFilter === "open"
                    ? "No active jobs"
                    : "No closed jobs"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {jobFilter === "all"
                    ? "Get started by creating a new job posting."
                    : jobFilter === "open"
                    ? "All your jobs are currently closed."
                    : "You haven't closed any jobs yet."}
                </p>
                {jobFilter === "all" && (
                  <div className="mt-6">
                    <button
                      onClick={() => navigate("/post-job")}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Post New Job
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={`bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:border-indigo-300 transition-all ${
                      job.status === "closed" ? "bg-gray-50" : ""
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3
                          className={`text-lg font-medium ${
                            job.status === "closed"
                              ? "text-gray-600"
                              : "text-indigo-600"
                          }`}
                        >
                          {job.title}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            job.status === "open"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {job.status === "open" ? (
                            <Clock className="h-3 w-3 mr-1" />
                          ) : (
                            <Archive className="h-3 w-3 mr-1" />
                          )}
                          {job.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-3 mb-4">
                        {job.description.length > 120
                          ? job.description.substring(0, 120) + "..."
                          : job.description}
                      </p>
                      <div className="flex items-center text-sm text-gray-500 mb-4">
                        <Users className="h-4 w-4 mr-1" />
                        <span>
                          {job.applications_count} applicant
                          {job.applications_count !== 1 ? "s" : ""}
                        </span>
                        <span className="mx-2">•</span>
                        <span>
                          Posted {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Job action buttons */}
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => navigate(`/review/${job.id}`)}
                          className={`inline-flex items-center px-3 py-1.5 border ${
                            job.status === "open"
                              ? "border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          } text-sm font-medium rounded-md bg-white transition-colors justify-center`}
                        >
                          <Users className="h-4 w-4 mr-1.5" />
                          View Applications
                        </button>

                        {job.status === "open" ? (
                          <button
                            onClick={() => closeJob(job.id)}
                            disabled={processingAction === job.id}
                            className="inline-flex items-center px-3 py-1.5 border border-orange-600 text-orange-600 hover:bg-orange-50 text-sm font-medium rounded-md bg-white transition-colors justify-center disabled:opacity-50"
                          >
                            {processingAction === job.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-1.5"></div>
                            ) : (
                              <Archive className="h-4 w-4 mr-1.5" />
                            )}
                            Close Job
                          </button>
                        ) : (
                          <button
                            onClick={() => reopenJob(job.id)}
                            disabled={processingAction === job.id}
                            className="inline-flex items-center px-3 py-1.5 border border-green-600 text-green-600 hover:bg-green-50 text-sm font-medium rounded-md bg-white transition-colors justify-center disabled:opacity-50"
                          >
                            {processingAction === job.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-1.5"></div>
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1.5" />
                            )}
                            Reactivate Job
                          </button>
                        )}

                        {/* Delete button only shows if no applications */}
                        {job.applications_count === 0 && (
                          <>
                            {deleteConfirmation === job.id ? (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={() => deleteJob(job.id)}
                                  disabled={processingAction === job.id}
                                  className="flex-1 inline-flex items-center px-3 py-1.5 border border-red-600 text-white bg-red-600 hover:bg-red-700 text-sm font-medium rounded-md transition-colors justify-center disabled:opacity-50"
                                >
                                  {processingAction === job.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1.5"></div>
                                  ) : (
                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                  )}
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmation(null)}
                                  className="flex-1 inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md bg-white transition-colors justify-center"
                                >
                                  <XCircle className="h-4 w-4 mr-1.5" />
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmation(job.id)}
                                className="inline-flex items-center px-3 py-1.5 border border-red-600 text-red-600 hover:bg-red-50 text-sm font-medium rounded-md bg-white transition-colors justify-center"
                              >
                                <Trash2 className="h-4 w-4 mr-1.5" />
                                Delete Job
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
