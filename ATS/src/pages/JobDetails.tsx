import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import {
  Building2,
  ArrowLeft,
  Calendar,
  Clock,
  Briefcase,
  MapPin,
  DollarSign,
  FileText,
  Share2,
  BookmarkPlus,
  Upload,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import Tesseract from "tesseract.js";
// Fix the mammoth import - remove require and prepare for dynamic import
// We'll import mammoth dynamically in the function that needs it

// Add a type workaround for the Tesseract Worker
type TesseractWorker = any;

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
  status: string;
  created_at: string;
  company?: string;
  location?: string;
  salary_range?: string;
  work_type?: string;
  deadline?: string;
}

export default function JobDetails() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    linkedIn: "",
    portfolio: "",
  });
  const [resumeText, setResumeText] = useState<string>("");
  const [isPdfFile, setIsPdfFile] = useState(false);
  const [extractionMethod, setExtractionMethod] = useState<string>("none");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      checkAuthStatus();
    }
  }, [jobId]);

  const checkAuthStatus = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const loggedIn = !!data.user;
      setIsLoggedIn(loggedIn);

      if (loggedIn && data.user) {
        // Check if user has already applied
        checkApplicationStatus();

        // Pre-fill form data from user profile
        try {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

          if (profileError) {
            console.error("Error fetching profile:", profileError);
            return;
          }

          // If profile exists, use it to fill the form
          if (profileData) {
            setFormData({
              ...formData,
              fullName: profileData.full_name || "",
              email: data.user.email || "",
              phone: profileData.phone || "",
              linkedIn: profileData.linkedin || "",
              portfolio: profileData.portfolio || "",
            });
          } else {
            // If no profile exists yet but user is logged in, at least use their email
            setFormData({
              ...formData,
              email: data.user.email || "",
            });
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsLoggedIn(false);
    }
  };

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch job details");
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", jobId)
        .eq("candidate_email", user.email)
        .maybeSingle();

      if (error) throw error;

      setHasApplied(!!data);
    } catch (error: any) {
      console.error("Error checking application status:", error);
    }
  };

  // Add this function to sanitize text before saving to database
  const sanitizeText = (text: string): string => {
    if (!text) return "";

    // Replace problematic characters
    return (
      text
        // Remove control characters
        .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
        // Replace tabs with spaces
        .replace(/\t/g, " ")
        // Replace multiple spaces with single space
        .replace(/\s+/g, " ")
        // Limit length to prevent very large submissions
        .substring(0, 100000)
    );
  };

  // Simple text extraction from text-based files
  const extractTextFromTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;

          // Check if we got raw PDF binary data (starts with %PDF-)
          if (text.startsWith("%PDF-")) {
            console.log(
              "Detected raw PDF binary data when trying direct text extraction"
            );
            // Reject with a specific error so we can handle it in the calling function
            reject(new Error("PDF_BINARY_DATA"));
            return;
          }

          resolve(sanitizeText(text));
        } catch (error) {
          console.error("Error extracting text:", error);
          reject(error);
        }
      };

      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        reject(error);
      };

      reader.readAsText(file);
    });
  };

  // Extract text from PDF using OCR
  const extractTextFromPdfWithOcr = async (file: File): Promise<string> => {
    setIsOcrProcessing(true);
    setOcrProgress(0);
    let worker: TesseractWorker = null;

    try {
      // Create a URL for the file
      const fileUrl = URL.createObjectURL(file);

      toast("Processing PDF with OCR. This may take a moment...", {
        icon: "🔍",
        duration: 5000,
      });

      // Create a worker with the right API usage for v6
      worker = await Tesseract.createWorker();
      // These methods should be called on the worker instance
      await worker.loadLanguage("eng");
      await worker.initialize("eng");

      // Track progress separately with a custom scheduler
      const progressTracker = setInterval(() => {
        const progressPercent = Math.round(Math.random() * 80) + 10; // Simulate progress
        setOcrProgress(progressPercent);

        toast.dismiss("ocr-progress");
        toast.loading(`OCR Processing: ${progressPercent}%`, {
          id: "ocr-progress",
        });
      }, 2000);

      // Recognize text from the PDF
      const result = await worker.recognize(fileUrl);

      // Clear the interval and set progress to 100%
      clearInterval(progressTracker);
      setOcrProgress(100);

      // Clean up
      URL.revokeObjectURL(fileUrl);
      toast.dismiss("ocr-progress");
      toast.success("OCR processing complete!");

      // Enhance the OCR results if we have meaningful text
      const enhancedText = await enhanceOcrResultWithAi(result.data.text);
      return enhancedText;
    } catch (error) {
      console.error("OCR processing error:", error);
      toast.error("OCR processing failed. Please try a different file.");
      throw error;
    } finally {
      // Make sure we terminate the worker
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          console.error("Error terminating worker:", e);
        }
      }
      setIsOcrProcessing(false);
    }
  };

  // Direct handling of PDF data to extract text using PDF.js library
  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      console.log("Attempting PDF text extraction");

      // First try to read as plain text (works for text-based PDFs)
      try {
        const textResult = await extractTextFromTextFile(file);

        // If we got meaningful text content, use it
        if (textResult && textResult.trim().length > 100) {
          console.log("Successfully extracted text directly from PDF");
          return textResult;
        }

        // If we got text but it's too short, try OCR
        console.log(
          "Direct text extraction yielded insufficient content, trying OCR"
        );
        return await extractTextFromPdfWithOcr(file);
      } catch (error: any) {
        // If we detected raw PDF binary data, go straight to OCR
        if (error.message === "PDF_BINARY_DATA") {
          console.log("Detected PDF binary data, proceeding with OCR");
          return await extractTextFromPdfWithOcr(file);
        }

        // For other errors, also try OCR as a fallback
        console.error("Error in direct text extraction:", error);
        return await extractTextFromPdfWithOcr(file);
      }
    } catch (error) {
      console.error("Error extracting text from PDF:", error);
      // If all methods fail, try OCR as last resort
      return await extractTextFromPdfWithOcr(file);
    }
  };

  // Add this function to handle Word documents specifically
  const extractTextFromWordDocument = async (file: File): Promise<string> => {
    setIsOcrProcessing(true);
    setOcrProgress(10);

    try {
      toast("Processing Word document...", {
        icon: "📄",
        duration: 3000,
      });

      // Read the file as ArrayBuffer
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      setOcrProgress(30);

      // Use mammoth to extract text from the Word document
      toast.loading("Extracting text from Word document...", {
        id: "word-process",
      });

      // Dynamically import mammoth
      const mammoth = await import("mammoth");

      // Extract text from the Word document using mammoth
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;

      setOcrProgress(80);

      // Enhance the text with AI if it's substantial
      let finalText = text;
      if (text && text.length > 100) {
        try {
          finalText = await enhanceOcrResultWithAi(text);
        } catch (enhanceError) {
          console.error("Failed to enhance Word document text:", enhanceError);
          // Continue with the original text if enhancement fails
        }
      }

      setOcrProgress(100);
      toast.dismiss("word-process");
      toast.success("Successfully extracted text from Word document");

      return sanitizeText(finalText);
    } catch (error) {
      console.error("Error extracting text from Word document:", error);
      toast.dismiss("word-process");
      toast.error("Failed to extract text from Word document");

      throw error;
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Update the handleFileChange function to properly identify and handle Word documents
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File is too large. Please select a file under 10MB.");
        return;
      }

      // Check if it's a PDF file
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      // Check if it's a Word document
      const isWordDoc =
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword" ||
        file.name.toLowerCase().endsWith(".docx") ||
        file.name.toLowerCase().endsWith(".doc");

      setIsPdfFile(isPdf);
      setResumeFile(file);

      try {
        toast.loading("Processing file...", { id: "processing-resume" });

        let text;

        if (isPdf) {
          setExtractionMethod("pdf_extraction");
          text = await extractTextFromPdf(file);
        } else if (isWordDoc) {
          // Use our Word document handler with mammoth.js
          setExtractionMethod("word_document");
          text = await extractTextFromWordDocument(file);
        } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
          setExtractionMethod("text_file");
          text = await extractTextFromTextFile(file);
        } else {
          // Unknown file type, try as text
          setExtractionMethod("unknown_file");
          text = await extractTextFromTextFile(file);
        }

        setResumeText(text);
        toast.dismiss("processing-resume");
        toast.success("Successfully processed file");
      } catch (error) {
        console.error("Error processing file:", error);
        toast.dismiss("processing-resume");
        toast.error("Failed to process file. Please try a different format.");

        // Set basic file information as fallback
        const fallbackText = `Could not extract text from ${file.name} (${
          file.type || "unknown type"
        })
        
File size: ${Math.round(file.size / 1024)} KB
Last modified: ${new Date(file.lastModified).toLocaleString()}

[The file content could not be automatically extracted. Please try a different file format (like .txt) or ensure the file is not corrupted or password protected.]`;

        setResumeText(fallbackText);
        setExtractionMethod("failed");
      }
    }
  };

  // Handle OCR completion with AI enhancement for better results
  const enhanceOcrResultWithAi = async (text: string): Promise<string> => {
    try {
      toast.loading("Improving OCR results...", { id: "ocr-enhancement" });

      // Call AI service to enhance OCR results
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2:latest",
          prompt: `You're an AI assistant that helps to structure and clean up OCR-processed resume text.
          
The following text was extracted from a resume using OCR, which means it might have formatting issues, misrecognized characters, and other problems.

Your task is to clean and structure this text to make it more readable and usable. Please:
1. Fix obvious OCR errors (misrecognized characters, weird spacing)
2. Identify and properly format resume sections (EDUCATION, EXPERIENCE, SKILLS, etc.)
3. Preserve all information, but make it more readable
4. Remove any page numbers or irrelevant artifacts from the OCR process

Original OCR text:
${text}

Cleaned and structured resume text:`,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const enhancedText = data.response;

        // If enhanced text is meaningful, use it instead
        if (enhancedText && enhancedText.length > text.length / 2) {
          toast.success("Enhanced OCR results with AI processing", {
            id: "ocr-enhancement",
          });
          return sanitizeText(enhancedText);
        } else {
          // Fallback to original OCR text
          toast.dismiss("ocr-enhancement");
          return sanitizeText(text);
        }
      } else {
        // If AI processing fails, use original OCR text
        toast.dismiss("ocr-enhancement");
        toast.error("Could not enhance OCR results, using raw extraction");
        return sanitizeText(text);
      }
    } catch (enhancementError) {
      console.error("Failed to enhance OCR results:", enhancementError);
      toast.dismiss("ocr-enhancement");
      // Use original OCR text as fallback
      return sanitizeText(text);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!resumeFile) {
      toast.error("Please upload your resume");
      return;
    }

    // For non-logged in users, validate required fields
    if (!isLoggedIn) {
      if (!formData.fullName.trim()) {
        toast.error("Please enter your full name");
        return;
      }
      if (!formData.email.trim()) {
        toast.error("Please enter your email address");
        return;
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error("Please enter a valid email address");
        return;
      }
    }

    try {
      setSubmitting(true);

      let userId = null;
      let profile = null;

      // Get current user if logged in
      if (isLoggedIn) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          toast.error("You must be logged in to apply");
          navigate("/login");
          return;
        }

        userId = user.id;

        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;
        profile = profileData;
      }

      console.log(
        "Extracting and storing resume text only - not saving the actual file"
      );

      // Get file metadata for reference purposes only
      const fileName = resumeFile.name;
      const fileSize = resumeFile.size;
      const fileType = resumeFile.type;

      // No actual file path since we're not storing the file
      const referenceId = `resume_${Date.now()}_${fileName.replace(
        /\s+/g,
        "_"
      )}`;

      // Prepare the sanitized resume text
      const resumeTextSanitized = sanitizeText(resumeText);

      console.log("Resume text length:", resumeTextSanitized.length);
      console.log("PDF extraction complete:", isPdfFile);

      // Check if we have meaningful text content
      const hasTextContent = resumeTextSanitized.length > 100; // Arbitrary threshold
      if (!hasTextContent && isPdfFile) {
        toast(
          "Limited text was extracted from your PDF. AI analysis may be less accurate.",
          {
            icon: "⚠️",
          }
        );
      }

      const { data: applicationData, error: applicationError } = await supabase
        .from("applications")
        .insert([
          {
            job_id: jobId,
            resume: referenceId, // Just a reference ID, not an actual file path
            resume_txt: resumeTextSanitized, // This is the primary data we'll use
            file_name: fileName,
            file_size: fileSize,
            file_type: fileType,
            is_pdf: isPdfFile,
            storage_status: "text_only", // Indicate we're not storing the file
            text_extraction_method: extractionMethod || "unknown",
            coverletter: coverLetter ? sanitizeText(coverLetter) : "",
            status: "pending",
            candidate_name: isLoggedIn ? profile.full_name : formData.fullName,
            candidate_email: isLoggedIn ? profile.email : formData.email,
            candidate_phone: isLoggedIn ? profile.phone : formData.phone,
            candidate_linkedin: formData.linkedIn,
            candidate_portfolio: formData.portfolio,
          },
        ])
        .select();

      if (applicationError) {
        console.error("Application creation error:", applicationError);
        throw new Error(
          applicationError.message || "Failed to save application"
        );
      }

      console.log("Application data created:", applicationData);

      toast.success("Application submitted successfully!");
      setHasApplied(true);
      setResumeFile(null);
      setCoverLetter("");
      setResumeText("");
    } catch (error: any) {
      console.error("Application submission error:", error);
      toast.error(error.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-3 text-sm text-gray-600">Loading job details...</p>
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
            onClick={() => navigate("/cdashboard")}
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
              <button
                onClick={() => navigate("/cdashboard")}
                className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Jobs
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Job Details Section */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">
                        {job.title}
                      </h1>
                      <div className="mt-1 flex flex-wrap items-center text-sm text-gray-600 gap-x-4 gap-y-2">
                        {job.company && (
                          <span className="flex items-center">
                            <Building2 className="h-4 w-4 mr-1.5 text-gray-400" />
                            {job.company}
                          </span>
                        )}
                        {job.location && (
                          <span className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1.5 text-gray-400" />
                            {job.location}
                          </span>
                        )}
                        {job.work_type && (
                          <span className="flex items-center">
                            <Briefcase className="h-4 w-4 mr-1.5 text-gray-400" />
                            {job.work_type}
                          </span>
                        )}
                        {job.salary_range && (
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1.5 text-gray-400" />
                            {job.salary_range}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100">
                        <Share2 className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100">
                        <BookmarkPlus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap mt-4 gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {job.status}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Calendar className="h-3 w-3 mr-1" />
                      Posted {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    {job.deadline && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Apply by {new Date(job.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="prose max-w-none">
                    <h2 className="text-lg font-medium text-gray-900 mb-3">
                      Job Description
                    </h2>
                    <div className="text-gray-600 whitespace-pre-line mb-6">
                      {job.description}
                    </div>

                    <h2 className="text-lg font-medium text-gray-900 mb-3">
                      Requirements
                    </h2>
                    <div className="text-gray-600 whitespace-pre-line">
                      {job.requirements}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Section */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow-sm rounded-lg overflow-hidden sticky top-24">
                <div className="px-6 py-5 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">
                    Apply for this position
                  </h2>
                </div>

                <div className="px-6 py-5">
                  {hasApplied ? (
                    <div className="text-center py-4">
                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                        <FileText className="h-6 w-6 text-green-600" />
                      </div>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        Application Submitted
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        You have already applied for this position. We'll notify
                        you when there's an update.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {!isLoggedIn && (
                        <div className="bg-yellow-50 px-4 py-3 rounded-md mb-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <AlertCircle className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm text-yellow-700">
                                You are applying as a guest.
                                <a
                                  href="/login"
                                  className="font-medium underline text-yellow-700 hover:text-yellow-600 ml-1"
                                >
                                  Login
                                </a>{" "}
                                for a better experience.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Personal Information Section */}
                      {!isLoggedIn && (
                        <fieldset className="border border-gray-200 rounded-md p-4">
                          <legend className="text-sm font-medium text-gray-700 px-2">
                            Personal Information
                          </legend>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label
                                htmlFor="fullName"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Full Name{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                required
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                placeholder="Enter your full name"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Email <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                placeholder="your.email@example.com"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="phone"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                placeholder="+1 (123) 456-7890"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="linkedIn"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                LinkedIn Profile
                              </label>
                              <input
                                type="url"
                                id="linkedIn"
                                name="linkedIn"
                                value={formData.linkedIn}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                placeholder="https://linkedin.com/in/yourprofile"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label
                                htmlFor="portfolio"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Portfolio / Website
                              </label>
                              <input
                                type="url"
                                id="portfolio"
                                name="portfolio"
                                value={formData.portfolio}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                placeholder="https://your-website.com"
                              />
                            </div>
                          </div>
                        </fieldset>
                      )}

                      <div>
                        <label
                          htmlFor="resume"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Resume/CV <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                          <div className="space-y-1 text-center">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                              <label
                                htmlFor="resume-upload"
                                className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none"
                              >
                                <span>Upload a file</span>
                                <input
                                  id="resume-upload"
                                  name="resume-upload"
                                  type="file"
                                  className="sr-only"
                                  accept=".pdf,.doc,.docx,.txt"
                                  onChange={handleFileChange}
                                />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">
                              PDF, DOC, DOCX, TXT up to 10MB
                            </p>
                            <p className="text-xs text-amber-600 mt-2">
                              Note: For privacy and efficiency, only the text
                              from your resume is extracted and stored. The
                              actual resume file is not saved.
                            </p>
                          </div>
                        </div>
                        {resumeFile && (
                          <p className="mt-2 text-sm text-green-600">
                            Selected file: {resumeFile.name}
                          </p>
                        )}

                        {/* OCR Progress Bar */}
                        {isOcrProcessing && (
                          <div className="mt-3 space-y-2">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${ocrProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                              OCR Processing: {ocrProgress}%
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="cover-letter"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Cover Letter (Optional)
                        </label>
                        <textarea
                          id="cover-letter"
                          name="cover-letter"
                          rows={4}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="Explain why you're a great fit for this role..."
                          value={coverLetter}
                          onChange={(e) => setCoverLetter(e.target.value)}
                        />
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={submitting || isOcrProcessing}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {submitting ? (
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
                            Submitting Application...
                          </div>
                        ) : isOcrProcessing ? (
                          "Processing Document..."
                        ) : (
                          "Submit Application"
                        )}
                      </motion.button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
