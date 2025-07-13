import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  User,
} from "lucide-react";
import { motion } from "framer-motion";

interface Application {
  id: string;
  candidate_name: string;
  candidate_email: string;
  resume: string;
  coverletter: string;
  status: string;
  created_at: string;
}

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
}

export default function ReviewApplications() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "pending" | "selected" | "rejected"
  >("all");

  useEffect(() => {
    fetchJobAndApplications();
  }, [jobId]);

  async function fetchJobAndApplications() {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      const { data: appData, error: appError } = await supabase
        .from("applications")
        .select("*")
        .eq("job_id", jobId);

      if (appError) throw appError;
      setApplications(appData || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(
    applicationId: string,
    status: "selected" | "rejected" | "pending"
  ) {
    if (!applicationId) return;

    try {
      setProcessingAction(applicationId);

      // Update the application status in the database
      const { error } = await supabase
        .from("applications")
        .update({ status })
        .eq("id", applicationId);

      if (error) throw error;

      // Update local state
      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, status } : app))
      );

      toast.success(
        `Candidate ${
          status === "selected"
            ? "accepted"
            : status === "rejected"
            ? "rejected"
            : "status reset"
        }`
      );
    } catch (error: any) {
      console.error("Error updating application status:", error);
      toast.error(`Failed to update status: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  }

  // Filter applications based on selected filter
  const filteredApplications =
    filter === "all"
      ? applications
      : applications.filter((app) => app.status === filter);

  // Calculate counts for each status
  const pendingCount = applications.filter(
    (app) => app.status === "pending"
  ).length;
  const selectedCount = applications.filter(
    (app) => app.status === "selected"
  ).length;
  const rejectedCount = applications.filter(
    (app) => app.status === "rejected"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-600 mb-4">Job not found</p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {job.title} - Applications
          </h1>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Candidate Applications
              </h2>
              <p className="text-sm text-gray-500">
                {applications.length} candidate applications for this position
              </p>
            </div>
            <div className="inline-flex shadow-sm rounded-md">
              <button
                onClick={() => setFilter("all")}
                className={`relative inline-flex items-center px-3 py-1.5 rounded-l-md border text-sm font-medium ${
                  filter === "all"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Filter className="h-4 w-4 mr-1.5" />
                All ({applications.length})
              </button>
              <button
                onClick={() => setFilter("pending")}
                className={`relative inline-flex items-center px-3 py-1.5 border-t border-b text-sm font-medium ${
                  filter === "pending"
                    ? "bg-yellow-500 text-white border-yellow-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Clock className="h-4 w-4 mr-1.5" />
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setFilter("selected")}
                className={`relative inline-flex items-center px-3 py-1.5 border-t border-b text-sm font-medium ${
                  filter === "selected"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Selected ({selectedCount})
              </button>
              <button
                onClick={() => setFilter("rejected")}
                className={`relative inline-flex items-center px-3 py-1.5 rounded-r-md border text-sm font-medium ${
                  filter === "rejected"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Rejected ({rejectedCount})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredApplications.length === 0 ? (
              <div className="text-center py-10">
                <User className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-gray-500">
                  {filter === "all"
                    ? "No applications found for this job"
                    : filter === "pending"
                    ? "No pending applications"
                    : filter === "selected"
                    ? "No selected candidates"
                    : "No rejected candidates"}
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Applied On
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredApplications.map((application) => (
                    <tr key={application.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {application.candidate_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {application.candidate_email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(application.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            application.status === "selected"
                              ? "bg-green-100 text-green-800"
                              : application.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {application.status === "selected"
                            ? "Selected"
                            : application.status === "rejected"
                            ? "Rejected"
                            : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() =>
                            navigate(`/application/${application.id}`)
                          }
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          View Details
                        </button>

                        {application.status !== "selected" && (
                          <button
                            onClick={() =>
                              updateStatus(application.id, "selected")
                            }
                            disabled={processingAction === application.id}
                            className="inline-flex items-center px-3 py-1.5 border border-green-600 text-sm font-medium rounded-md text-green-600 bg-white hover:bg-green-50 disabled:opacity-50"
                          >
                            {processingAction === application.id ? (
                              <div className="animate-spin h-4 w-4 border-b-2 border-green-600 rounded-full mr-1.5"></div>
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1.5" />
                            )}
                            Accept
                          </button>
                        )}

                        {application.status !== "rejected" && (
                          <button
                            onClick={() =>
                              updateStatus(application.id, "rejected")
                            }
                            disabled={processingAction === application.id}
                            className="inline-flex items-center px-3 py-1.5 border border-red-600 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 disabled:opacity-50"
                          >
                            {processingAction === application.id ? (
                              <div className="animate-spin h-4 w-4 border-b-2 border-red-600 rounded-full mr-1.5"></div>
                            ) : (
                              <XCircle className="h-4 w-4 mr-1.5" />
                            )}
                            Reject
                          </button>
                        )}

                        {(application.status === "selected" ||
                          application.status === "rejected") && (
                          <button
                            onClick={() =>
                              updateStatus(application.id, "pending")
                            }
                            disabled={processingAction === application.id}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-500 text-sm font-medium rounded-md text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50"
                          >
                            {processingAction === application.id ? (
                              <div className="animate-spin h-4 w-4 border-b-2 border-gray-500 rounded-full mr-1.5"></div>
                            ) : (
                              <Clock className="h-4 w-4 mr-1.5" />
                            )}
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
