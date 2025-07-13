import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Award,
  Clock,
  XCircle,
  AlertCircle,
  Briefcase,
  GraduationCap,
  FileText,
  User,
  Mail,
  Calendar,
  BarChart4,
  AlertTriangle,
  CheckSquare,
  Phone,
  Linkedin,
  Github,
  Globe,
  HelpCircle,
  ThumbsUp,
  TrendingUp,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";

interface Application {
  id: string;
  resume: string;
  coverletter: string;
  status: string;
  candidate_name: string;
  candidate_email: string;
  job_id: string;
  created_at: string;
  storage_status?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  resume_bucket?: string;
  resume_text?: string;
  resume_txt?: string;
  is_pdf?: boolean;
  text_extraction_method?: string;
}

interface AnalysisResult {
  skills_extracted: string[]; // Array of specific skills found in the resume
  skills_match: string;
  skills_match_comments: string;
  missing_skills: string[]; // Skills required but missing from the resume
  key_qualifications: string; // Summary of key qualifications
  achievements: string; // Notable achievements from the resume
  job_fit_score: string; // Score for how well candidate fits the job
  job_fit_analysis: string; // Detailed analysis of job fit
  resumetone: string;
  overall_score: string;
  recommendation: string;
  // New fields from enhanced analysis
  career_trajectory?: string;
  education_relevance?: string;
  interview_questions?: string[];
  strengths?: string[];
  areas_of_concern?: string[];
}

// Define a type for the resume info object
interface ResumeAvailabilityInfo {
  available: boolean;
  reason?: string;
  path?: string;
  bucket?: string;
  isPdf?: boolean;
  text?: string;
  extraction_method?: string;
  metadata?: {
    name: string;
    size: number;
    type: string;
  };
}

// Add motion variants for animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Add the resumeInfo interface and default value
// Near the top of the file with other interfaces
interface ResumeInfo {
  available: boolean;
  isPdf?: boolean;
  text?: string;
  extraction_method?: string;
}

export default function ApplicationInsights() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [job, setJob] = useState<{
    id: string;
    title: string;
    description: string;
    requirements: string;
  } | null>(null);
  const [rawInsights, setRawInsights] = useState("");
  const [parsedInsights, setParsedInsights] = useState<AnalysisResult | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [structuredResume, setStructuredResume] = useState<Record<
    string,
    string
  > | null>(null);
  const [enhancedResume, setEnhancedResume] = useState<any>(null);
  // Add the resumeInfo state variable in the component
  // In the ApplicationInsights component, near other useState hooks
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo>({
    available: false,
  });
  // In the component, add a state to track if analysis has been attempted
  const [analysisAttempted, setAnalysisAttempted] = useState(false);

  useEffect(() => {
    if (id) {
      fetchApplication();
    }
  }, [id]);

  async function fetchApplication() {
    setLoading(true);

    try {
      // Fetch application
      const { data: appData, error: appError } = await supabase
        .from("applications")
        .select("*, job:jobs(*)")
        .eq("id", id)
        .single();

      if (appError) throw appError;

      setApplication(appData);
      setJob(appData.job);

      // Check resume availability
      const resumeInfo = checkResumeAvailability(appData);

      // Set resumeInfo state
      setResumeInfo({
        available: resumeInfo.available,
        isPdf: resumeInfo.isPdf,
        text: resumeInfo.text,
        extraction_method: resumeInfo.extraction_method,
      });

      // If resume text is available directly, use it
      if (resumeInfo.available && resumeInfo.text) {
        console.log("Using resume text from database");
        structureResume(resumeInfo.text);

        // Only analyze if we don't have insights yet and haven't attempted analysis
        if (!parsedInsights && !rawInsights && !analysisAttempted) {
          setAnalysisAttempted(true);
          await analyzeResume(resumeInfo.text);
        }
        return;
      }

      // Legacy code path for files in storage
      if (resumeInfo.available && resumeInfo.path && resumeInfo.bucket) {
        try {
          const { data, error } = await supabase.storage
            .from(resumeInfo.bucket)
            .download(resumeInfo.path);

          if (error) throw error;

          // Read as text
          const text = await data.text();
          structureResume(text);

          // Only analyze if we don't have insights yet and haven't attempted analysis
          if (!parsedInsights && !rawInsights && !analysisAttempted) {
            setAnalysisAttempted(true);
            await analyzeResume(text);
          }
        } catch (downloadError) {
          console.error("Failed to download resume:", downloadError);
          toast.error("Failed to download resume");
        }
      }
    } catch (error) {
      console.error("Error fetching application:", error);
      toast.error("Failed to load application");
    } finally {
      setLoading(false);
    }
  }

  // Update the structureResume function to better parse resume content
  function structureResume(text: string) {
    if (!text || text.length < 10) {
      console.log("Resume text is too short to structure");
      setStructuredResume(null);
      return;
    }

    console.log("Structuring resume text", text.substring(0, 100) + "...");

    try {
      // Enhanced text cleaning for better section detection
      const cleanText = text
        // Replace multiple whitespace characters with a single space
        .replace(/\s+/g, " ")
        // Add newlines after likely section headers (improved regex)
        .replace(/([A-Z][A-Z\s]{2,}:?)(\s|$)/g, "$1\n")
        // Add newlines after lines ending with colon
        .replace(/(:\s*)(\w)/g, ":\n$2")
        // Add newlines after sentences to improve readability
        .replace(/\.(\s)/g, ".\n$1");

      // Enhanced section detection - more comprehensive list with variations
      const sectionTitles = [
        // Personal info sections
        "PROFILE",
        "ABOUT",
        "SUMMARY",
        "OBJECTIVE",
        "CAREER OBJECTIVE",
        "PROFESSIONAL SUMMARY",
        // Education sections
        "EDUCATION",
        "ACADEMIC BACKGROUND",
        "ACADEMIC QUALIFICATIONS",
        "EDUCATIONAL QUALIFICATIONS",
        // Experience sections
        "EXPERIENCE",
        "WORK EXPERIENCE",
        "EMPLOYMENT HISTORY",
        "PROFESSIONAL EXPERIENCE",
        "WORK HISTORY",
        // Skills sections
        "SKILLS",
        "TECHNICAL SKILLS",
        "CORE COMPETENCIES",
        "KEY SKILLS",
        "EXPERTISE",
        "QUALIFICATIONS",
        // Project sections
        "PROJECTS",
        "PROJECT EXPERIENCE",
        "PERSONAL PROJECTS",
        "ACADEMIC PROJECTS",
        // Achievement sections
        "ACHIEVEMENTS",
        "ACCOMPLISHMENTS",
        "AWARDS",
        "HONORS",
        "RECOGNITIONS",
        // Other common sections
        "CERTIFICATIONS",
        "CERTIFICATES",
        "LANGUAGES",
        "INTERESTS",
        "HOBBIES",
        "REFERENCES",
        "PUBLICATIONS",
        "RESEARCH",
        "VOLUNTEER EXPERIENCE",
        "EXTRACURRICULAR ACTIVITIES",
        "LEADERSHIP",
      ];

      // Case-insensitive regex for section titles with improved boundary detection
      const titlePattern = sectionTitles.join("|");
      const titleRegex = new RegExp(
        `(^|\\n)\\s*(?<title>(${titlePattern})[:\\s-]*)(?:\\n|$)`,
        "i"
      );

      // Find all section titles and their positions
      const matches = [...cleanText.matchAll(new RegExp(titleRegex, "gi"))];

      const sections: Record<string, string> = {};

      if (matches.length === 0) {
        // If no standard sections found, try to create logical sections based on text structure
        const paragraphs = cleanText.split(/\n\s*\n/);

        // If we have multiple paragraphs, use them as sections
        if (paragraphs.length > 1) {
          paragraphs.forEach((para, index) => {
            if (para.trim()) {
              // Try to infer a section name from the first line
              const firstLine = para.split("\n")[0].trim();
              // If the first line is short, use it as a title
              const title =
                firstLine.length < 30 ? firstLine : `Section ${index + 1}`;
              sections[title] = para.replace(firstLine, "").trim();
            }
          });
        } else {
          // If just one paragraph or no clear structure, use a simple division
          sections["RESUME CONTENT"] = cleanText;
        }
      } else {
        // Process standard sections with improved extraction
        matches.forEach((match, index) => {
          const sectionTitle = match.groups?.title?.trim() || "UNKNOWN";
          const startIdx = match.index + match[0].length;
          const endIdx =
            index < matches.length - 1
              ? matches[index + 1].index
              : cleanText.length;

          let sectionContent = cleanText.substring(startIdx, endIdx).trim();

          // Remove bullet points for cleaner display while preserving structure
          sectionContent = sectionContent
            .replace(/•\s+/g, "• ")
            .replace(/\*\s+/g, "* ")
            .replace(/[\-\–]\s+/g, "- ");

          if (sectionContent) {
            // Clean up section title - remove colons, dashes and normalize case
            const cleanTitle = sectionTitle
              .replace(/[:\s-]+$/, "")
              .toUpperCase();
            sections[cleanTitle] = sectionContent;
          }
        });

        // If no sections were successfully extracted, create a fallback
        if (Object.keys(sections).length === 0) {
          sections["CONTENT"] = cleanText;
        }
      }

      console.log("Structured resume sections:", Object.keys(sections));
      setStructuredResume(sections);

      // Now that we've structured the resume, let's also send it for AI enhancement
      enhanceResumeContent(text, sections);
    } catch (error) {
      console.error("Error structuring resume:", error);
      // Fallback to simple format
      setStructuredResume({
        "RESUME CONTENT": text,
      });
    }
  }

  // Modify the enhanceResumeContent function to process complex objects
  async function enhanceResumeContent(
    rawText: string,
    sections: Record<string, string>
  ) {
    try {
      // This won't set the analyzing state to avoid UI flicker -
      // this is a supplementary enhancement while the main analysis also runs

      const prompt = `
Resume Enhancement Task:
You're an expert resume analyst. I'm providing a resume that may have OCR extraction issues or formatting problems.
Please enhance and structure this resume, extracting all valuable information in a clean format.

Input Resume:
${rawText.substring(0, 4000)}

Current Structure (if detected):
${Object.entries(sections)
  .map(
    ([key, value]) =>
      `${key}:\n${value.substring(0, 200)}${value.length > 200 ? "..." : ""}`
  )
  .join("\n\n")}

Tasks:
1. Fix any OCR errors or formatting issues
2. Extract structured information (name, contact, education, experience, skills, etc.)
3. For skills section, identify technical skills, soft skills, and proficiency levels where possible
4. For education, clearly format degrees, institutions, dates, and GPAs
5. For experience, identify company names, roles, dates, and key responsibilities

Output the enhanced resume as a structured JSON object with the following format:
{
  "personal_info": {
    "name": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "github": "",
    "location": "",
    "website": ""
  },
  "summary": "",
  "education": [
    {
      "institution": "",
      "degree": "",
      "field": "",
      "date_range": "",
      "gpa": "",
      "achievements": []
    }
  ],
  "experience": [
    {
      "company": "",
      "position": "",
      "date_range": "",
      "responsibilities": [],
      "achievements": []
    }
  ],
  "skills": {
    "technical": [],
    "soft": [],
    "languages": [],
    "tools": []
  },
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": [],
      "url": ""
    }
  ],
  "certifications": [],
  "achievements": []
}

Only output the JSON object, no additional text or explanations.
`;

      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2:latest",
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const output = data.response;

      try {
        // Try to parse the JSON output
        const jsonOutput = output.trim();
        let enhancedResumeData;

        try {
          enhancedResumeData = JSON.parse(jsonOutput);
        } catch (parseError) {
          console.error("Failed to parse enhanced resume JSON:", parseError);

          // Try to clean common JSON syntax issues before parsing
          const cleanedJson = jsonOutput
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted property names
            .replace(/:\s*'([^']*)'/g, ':"$1"') // Replace single quotes with double quotes
            .replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas

          console.log("Attempting to parse cleaned resume JSON");
          enhancedResumeData = JSON.parse(cleanedJson);
        }

        // Process complex objects in the enhanced resume data
        const processedResumeData = processComplexObjects(enhancedResumeData);

        // Fix array handling for specific fields
        if (
          processedResumeData.education &&
          !Array.isArray(processedResumeData.education)
        ) {
          processedResumeData.education = [processedResumeData.education];
        }

        if (
          processedResumeData.experience &&
          !Array.isArray(processedResumeData.experience)
        ) {
          processedResumeData.experience = [processedResumeData.experience];
        }

        if (
          processedResumeData.projects &&
          !Array.isArray(processedResumeData.projects)
        ) {
          processedResumeData.projects = [processedResumeData.projects];
        }

        if (
          processedResumeData.certifications &&
          !Array.isArray(processedResumeData.certifications)
        ) {
          processedResumeData.certifications =
            processedResumeData.certifications
              .split(",")
              .map((item: string) => item.trim());
        }

        if (
          processedResumeData.achievements &&
          !Array.isArray(processedResumeData.achievements)
        ) {
          if (typeof processedResumeData.achievements === "string") {
            processedResumeData.achievements = processedResumeData.achievements
              .split(",")
              .map((item: string) => item.trim());
          } else {
            processedResumeData.achievements = [
              processedResumeData.achievements,
            ];
          }
        }

        // Store the enhanced resume in a state variable
        setEnhancedResume(processedResumeData);
        console.log("Enhanced resume structure:", processedResumeData);
      } catch (parseError) {
        console.error(
          "All enhanced resume JSON parse attempts failed:",
          parseError
        );
      }
    } catch (error) {
      console.error("Error enhancing resume content:", error);
    }
  }

  // Update the processComplexObjects function to handle potential null values
  const processComplexObjects = (data: any): any => {
    if (!data) return null;

    // If it's an array, process each item
    if (Array.isArray(data)) {
      return data.map((item) => processComplexObjects(item));
    }

    // If it's an object, process each property
    if (typeof data === "object" && data !== null) {
      const result: Record<string, any> = {};

      for (const [key, value] of Object.entries(data)) {
        result[key] = processComplexObjects(value);
      }

      return result;
    }

    // Return primitives as is
    return data;
  };

  // Fix the analyzeResume function to properly handle JSON parsing
  async function analyzeResume(resumeText: string) {
    setAnalyzing(true);
    try {
      // Same prompt as before
      const prompt = `Resume Analysis
      You are an expert talent acquisition AI assistant tasked with providing a comprehensive analysis of a candidate's resume for a specific job position.
      
      Note: This text may have been extracted from a PDF or document, so there might be formatting issues. Please do your best to analyze it despite potential formatting problems.
      
      Resume text:
      ${resumeText.substring(0, 4000)}
      
      Job Title: ${job?.title || "Not specified"}
      
      Job Requirements:
      ${job?.requirements || "Not specified"}
      
      Job Description:
      ${job?.description || "Not specified"}
      
      Your task:
      1. Extract a comprehensive list of the candidate's skills with evidence from their resume
      2. Identify which key skills from the job requirements are missing in the resume
      3. Analyze the depth and relevance of the candidate's experience for this specific role
      4. Assess the candidate's educational background and its relevance to the position
      5. Identify notable achievements that demonstrate value for this role
      6. Evaluate the candidate's career progression and growth potential
      7. Assess the resume's overall presentation and professionalism
      8. Provide a detailed job fit analysis with specific examples from the resume
      9. Offer specific interview questions based on potential areas to explore
      
      Output Format:
      {
        "skills_extracted": ["skill1", "skill2", "skill3", ...],
        "skills_match": "1-10 score",
        "skills_match_comments": "Detailed analysis of skills match with specific examples from the resume",
        "missing_skills": ["missing1", "missing2", ...],
        "key_qualifications": "Summary of candidate's key qualifications with specific details from resume",
        "achievements": "Notable achievements from the resume with quantifiable metrics where available",
        "job_fit_score": "1-10 score",
        "job_fit_analysis": "Detailed analysis of fit for this specific position with evidence",
        "career_trajectory": "Analysis of candidate's career progression and potential for growth",
        "education_relevance": "Analysis of how the candidate's education supports their qualifications",
        "resumetone": "Analysis of resume tone, presentation quality, and professionalism",
        "overall_score": "1-10 score",
        "recommendation": "Your hiring recommendation with specific justification",
        "interview_questions": ["question1", "question2", "question3"],
        "strengths": ["strength1", "strength2", "strength3"],
        "areas_of_concern": ["concern1", "concern2"]
      }
      
      IMPORTANT: Return ONLY the JSON object with no additional text, commentary, or explanation before or after.
      `;

      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2:latest",
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const output = data.response;
      setRawInsights(output);

      // Try to parse the JSON output
      try {
        // Log the raw output for debugging
        console.log("Raw AI output:", output);

        // Method 1: Try direct parsing first
        try {
          const jsonOutput = output.trim();
          let result;

          try {
            result = JSON.parse(jsonOutput);
          } catch (parseError) {
            console.error("Direct JSON parse failed:", parseError);

            // Try to clean common JSON syntax issues before parsing
            const cleanedJson = jsonOutput
              .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted property names
              .replace(/:\s*'([^']*)'/g, ':"$1"') // Replace single quotes with double quotes
              .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
              .replace(/(\w+):/g, '"$1":') // Ensure all keys are quoted
              .replace(/:\s*"([^"]*)'\s*/g, ':"$1"'); // Fix mixed quotes

            console.log("Attempting to parse cleaned JSON");
            result = JSON.parse(cleanedJson);
          }

          // Process the result and force any nested objects into strings
          const processedResult: AnalysisResult = {
            skills_extracted: ensureArray(result.skills_extracted),
            skills_match: String(result.skills_match || "5").replace(
              /[^0-9]/g,
              ""
            ),
            skills_match_comments: String(result.skills_match_comments || ""),
            missing_skills: ensureArray(result.missing_skills),
            key_qualifications:
              typeof result.key_qualifications === "object"
                ? JSON.stringify(result.key_qualifications)
                : String(result.key_qualifications || ""),
            achievements:
              typeof result.achievements === "object"
                ? JSON.stringify(result.achievements)
                : String(result.achievements || ""),
            job_fit_score: String(result.job_fit_score || "5").replace(
              /[^0-9]/g,
              ""
            ),
            job_fit_analysis:
              typeof result.job_fit_analysis === "object"
                ? JSON.stringify(result.job_fit_analysis)
                : String(result.job_fit_analysis || ""),
            resumetone:
              typeof result.resumetone === "object"
                ? JSON.stringify(result.resumetone)
                : String(result.resumetone || ""),
            overall_score: String(result.overall_score || "5").replace(
              /[^0-9]/g,
              ""
            ),
            recommendation: String(result.recommendation || ""),
            career_trajectory:
              typeof result.career_trajectory === "object"
                ? JSON.stringify(result.career_trajectory)
                : String(result.career_trajectory || ""),
            education_relevance:
              typeof result.education_relevance === "object"
                ? JSON.stringify(result.education_relevance)
                : String(result.education_relevance || ""),
            interview_questions: ensureArray(result.interview_questions),
            strengths: ensureArray(result.strengths),
            areas_of_concern: ensureArray(result.areas_of_concern),
          };

          setParsedInsights(processedResult);
          return;
        } catch (directParseError) {
          console.error("All JSON parse attempts failed:", directParseError);
        }

        // Method 2: Fallback to regex extraction
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const jsonStr = jsonMatch[0];
            const cleanedJsonStr = jsonStr
              .replace(/[\n\r\t]/g, " ")
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]")
              .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
              .replace(/:\s*['"]([^'"]*)['"](\s*[},])/g, ':"$1"$2')
              .replace(/(\w+):/g, '"$1":') // Ensure all keys are quoted
              .replace(/:\s*"([^"]*)'\s*/g, ':"$1"'); // Fix mixed quotes

            const result = JSON.parse(cleanedJsonStr);

            // Create processed result similar to method 1
            // Just use basic values and stringify any complex objects
            const processedResult: AnalysisResult = {
              skills_extracted: ensureArray(result.skills_extracted),
              skills_match: String(result.skills_match || "5").replace(
                /[^0-9]/g,
                ""
              ),
              skills_match_comments: String(result.skills_match_comments || ""),
              missing_skills: ensureArray(result.missing_skills),
              key_qualifications:
                typeof result.key_qualifications === "object"
                  ? JSON.stringify(result.key_qualifications)
                  : String(result.key_qualifications || ""),
              achievements:
                typeof result.achievements === "object"
                  ? JSON.stringify(result.achievements)
                  : String(result.achievements || ""),
              job_fit_score: String(result.job_fit_score || "5").replace(
                /[^0-9]/g,
                ""
              ),
              job_fit_analysis:
                typeof result.job_fit_analysis === "object"
                  ? JSON.stringify(result.job_fit_analysis)
                  : String(result.job_fit_analysis || ""),
              resumetone:
                typeof result.resumetone === "object"
                  ? JSON.stringify(result.resumetone)
                  : String(result.resumetone || ""),
              overall_score: String(result.overall_score || "5").replace(
                /[^0-9]/g,
                ""
              ),
              recommendation: String(result.recommendation || ""),
              career_trajectory:
                typeof result.career_trajectory === "object"
                  ? JSON.stringify(result.career_trajectory)
                  : String(result.career_trajectory || ""),
              education_relevance:
                typeof result.education_relevance === "object"
                  ? JSON.stringify(result.education_relevance)
                  : String(result.education_relevance || ""),
              interview_questions: ensureArray(result.interview_questions),
              strengths: ensureArray(result.strengths),
              areas_of_concern: ensureArray(result.areas_of_concern),
            };

            setParsedInsights(processedResult);
            return;
          } catch (extractError) {
            console.error("JSON extraction error:", extractError);
          }
        }

        // Method 3: Use default values as fallback
        setParsedInsights({
          skills_extracted: [],
          skills_match: "5",
          skills_match_comments: "Unable to analyze skills match.",
          missing_skills: [],
          key_qualifications: "Could not extract key qualifications.",
          achievements: "Could not extract achievements.",
          job_fit_score: "5",
          job_fit_analysis: "Unable to analyze job fit.",
          resumetone: "Could not analyze resume tone.",
          overall_score: "5",
          recommendation: "Manual review recommended.",
          interview_questions: [],
          strengths: [],
          areas_of_concern: [],
        });
      } catch (error) {
        console.error("Error parsing JSON from AI output:", error);
        setParsedInsights({
          skills_extracted: [],
          skills_match: "5",
          skills_match_comments: "Analysis failed. Please review manually.",
          missing_skills: [],
          key_qualifications: "Analysis failed. Please review manually.",
          achievements: "Analysis failed. Please review manually.",
          job_fit_score: "5",
          job_fit_analysis: "Analysis failed. Please review manually.",
          resumetone: "Analysis failed. Please review manually.",
          overall_score: "5",
          recommendation: "Review manually as automated analysis failed.",
          interview_questions: [],
          strengths: [],
          areas_of_concern: [],
        });
      }
    } catch (error: any) {
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  // Add a helper function to ensure values are arrays
  function ensureArray(value: any): any[] {
    if (value === null || value === undefined) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string") {
      if (value.trim() === "") return [];
      return value.split(",").map((s) => s.trim());
    }

    // If it's an object, wrap it in an array
    if (typeof value === "object") {
      return [value];
    }

    return [value]; // Convert any other type to an array with one item
  }

  async function updateStatus(status: "selected" | "rejected") {
    if (!application) return;

    try {
      setUpdating(true);

      // Update the application status in the database
      const { error } = await supabase
        .from("applications")
        .update({ status })
        .eq("id", application.id);

      if (error) throw error;

      // Update the local state to reflect the new status
      setApplication({
        ...application,
        status,
      });

      toast.success(
        `Candidate ${status === "selected" ? "accepted" : "rejected"}!`
      );

      // Navigate back to the job's applications page
      if (application.job_id) {
        navigate(`/review/${application.job_id}`);
      } else {
        navigate(-1);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdating(false);
    }
  }

  // Update the function that checks for resume availability to check for resume_txt
  const checkResumeAvailability = (application: Application) => {
    // If we have resume_txt that was properly extracted (more than just basic info)
    if (application.resume_txt && application.resume_txt.length > 100) {
      return {
        available: true,
        reason: application.is_pdf
          ? "PDF resume with extracted text"
          : "Resume text stored directly in database",
        isPdf: !!application.is_pdf,
        text: application.resume_txt,
        extraction_method: application.text_extraction_method || "unknown",
      };
    }

    // Legacy fallback for resume_text field (if present)
    if (application.resume_text && application.resume_text.length > 100) {
      return {
        available: true,
        reason: "Resume text from legacy field",
        isPdf: !!application.is_pdf,
        text: application.resume_text,
        extraction_method: application.text_extraction_method || "unknown",
      };
    }

    // If it's a PDF but with limited extraction
    if (
      application.is_pdf &&
      (application.resume_txt || application.resume_text)
    ) {
      return {
        available: true,
        reason: "PDF resume with limited text extraction",
        isPdf: true,
        text: application.resume_txt || application.resume_text || "",
        metadata: {
          name: application.file_name || "resume.pdf",
          size: application.file_size || 0,
          type: application.file_type || "application/pdf",
        },
      };
    }

    // Check if we have storage_status field and it's set to text_extracted or text_only
    if (
      (application.storage_status === "text_extracted" ||
        application.storage_status === "text_only") &&
      (application.resume_txt || application.resume_text)
    ) {
      return {
        available: true,
        reason: "Resume text extracted",
        text: application.resume_txt || application.resume_text || "",
      };
    }

    // Legacy checks for old storage method
    if (application.storage_status === "pending_upload") {
      return {
        available: false,
        reason: "Storage unavailable - resume details saved as metadata",
      };
    }

    // Check if we have file_name and file_size metadata
    if (application.file_name && application.file_size) {
      return {
        available: false,
        reason: "Resume file information saved",
        metadata: {
          name: application.file_name,
          size: application.file_size,
          type: application.file_type || "Unknown",
        },
      };
    }

    // Check if resume path exists but without storage info
    if (application.resume && !application.resume_bucket) {
      return {
        available: false,
        reason: "Resume path saved but storage unavailable",
      };
    }

    // If resume field and bucket exist, assume file is available
    if (application.resume && application.resume_bucket) {
      return {
        available: true,
        path: application.resume,
        bucket: application.resume_bucket,
      };
    }

    return { available: false, reason: "No resume information" };
  };

  // Add this component to display missing file info with better details
  const ResumeUnavailableMessage = ({
    resumeInfo,
  }: {
    resumeInfo: ResumeInfo;
  }) => {
    const [showDetails, setShowDetails] = useState(false);

    return (
      <div className="p-4 bg-gray-50 rounded-md">
        <div className="flex items-center text-amber-600 mb-2">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <h4 className="font-medium">Resume Not Available</h4>
        </div>
        <p className="text-gray-600">
          The candidate's resume could not be processed or was not provided.
        </p>
      </div>
    );
  };

  // Update the PdfResumeWarning component parameter type to allow undefined
  const PdfResumeWarning = ({
    extractionMethod,
  }: {
    extractionMethod?: string;
  }) => (
    <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-100">
      <div className="flex items-start">
        <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-blue-700">
            PDF Resume Detected
          </h4>
          <p className="text-xs text-blue-600 mt-1">
            {extractionMethod === "ocr"
              ? "This resume was processed using OCR technology. Some formatting or content may have been altered during extraction."
              : "This resume was processed using PDF text extraction. The structure may differ from the original document."}
          </p>
        </div>
      </div>
    </div>
  );

  // Add a new component to display the enhanced resume
  const EnhancedResumeView = ({ enhancedResume }: { enhancedResume: any }) => {
    if (!enhancedResume) return null;

    return (
      <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-6">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="h-5 w-5 mr-2 text-indigo-600" />
            Enhanced Resume View
          </h3>
        </div>

        <div className="p-6">
          {/* Personal Info Section */}
          {enhancedResume.personal_info && (
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {enhancedResume.personal_info.name || "Candidate"}
                  </h2>
                  {enhancedResume.personal_info.location && (
                    <p className="text-gray-600 mt-1">
                      {enhancedResume.personal_info.location}
                    </p>
                  )}
                </div>

                <div className="mt-3 md:mt-0 flex flex-col space-y-1 text-sm">
                  {enhancedResume.personal_info.email && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-500" />
                      <a
                        href={`mailto:${enhancedResume.personal_info.email}`}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        {enhancedResume.personal_info.email}
                      </a>
                    </div>
                  )}
                  {enhancedResume.personal_info.phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-500" />
                      <span>{enhancedResume.personal_info.phone}</span>
                    </div>
                  )}
                  {enhancedResume.personal_info.linkedin && (
                    <div className="flex items-center">
                      <Linkedin className="h-4 w-4 mr-2 text-gray-500" />
                      <a
                        href={`https://linkedin.com/in/${enhancedResume.personal_info.linkedin.replace(
                          /^.*\/in\//,
                          ""
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  {enhancedResume.personal_info.github && (
                    <div className="flex items-center">
                      <Github className="h-4 w-4 mr-2 text-gray-500" />
                      <a
                        href={`https://github.com/${enhancedResume.personal_info.github.replace(
                          /^.*github.com\//,
                          ""
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        GitHub Profile
                      </a>
                    </div>
                  )}
                  {enhancedResume.personal_info.website && (
                    <div className="flex items-center">
                      <Globe className="h-4 w-4 mr-2 text-gray-500" />
                      <a
                        href={enhancedResume.personal_info.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        Personal Website
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {enhancedResume.summary && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-gray-700 italic">
                    {enhancedResume.summary}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Skills Section */}
          {enhancedResume.skills && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                Skills & Competencies
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enhancedResume.skills.technical &&
                  enhancedResume.skills.technical.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">
                        Technical Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {enhancedResume.skills.technical.map(
                          (skill: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded"
                            >
                              {skill}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {enhancedResume.skills.tools &&
                  enhancedResume.skills.tools.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">
                        Tools & Technologies
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {enhancedResume.skills.tools.map(
                          (tool: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded"
                            >
                              {tool}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {enhancedResume.skills.soft &&
                  enhancedResume.skills.soft.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">
                        Soft Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {enhancedResume.skills.soft.map(
                          (skill: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded"
                            >
                              {skill}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {enhancedResume.skills.languages &&
                  enhancedResume.skills.languages.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">
                        Languages
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {enhancedResume.skills.languages.map(
                          (language: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded"
                            >
                              {language}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Education Section */}
          {enhancedResume.education && enhancedResume.education.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                Education
              </h3>

              <div className="space-y-4">
                {enhancedResume.education.map((edu: any, idx: number) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex flex-col md:flex-row md:justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {typeof edu.institution === "string"
                            ? edu.institution
                            : "Institution"}
                        </h4>
                        <p className="text-indigo-700">
                          {typeof edu.degree === "string" ? edu.degree : ""}
                          {typeof edu.field === "string" && edu.field
                            ? `, ${edu.field}`
                            : ""}
                        </p>
                      </div>
                      {typeof edu.date_range === "string" && edu.date_range && (
                        <div className="text-sm text-gray-500 mt-1 md:mt-0">
                          {edu.date_range}
                        </div>
                      )}
                    </div>

                    {typeof edu.gpa === "string" && edu.gpa && (
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">GPA:</span> {edu.gpa}
                      </p>
                    )}

                    {/* Other educational details that might be objects */}
                    {Object.entries(edu).map(([key, value]) => {
                      // Skip already rendered fields
                      if (
                        [
                          "institution",
                          "degree",
                          "field",
                          "date_range",
                          "gpa",
                          "achievements",
                        ].includes(key)
                      ) {
                        return null;
                      }

                      // Render other fields that might be objects or complex data
                      if (
                        value !== null &&
                        value !== undefined &&
                        typeof value !== "string" &&
                        !Array.isArray(value)
                      ) {
                        return (
                          <div key={key} className="mt-2">
                            <p className="text-sm font-medium text-gray-700">
                              {key}:
                            </p>
                            <div className="p-2 bg-white rounded mt-1">
                              {renderContent(value)}
                            </div>
                          </div>
                        );
                      } else if (typeof value === "string" && value) {
                        return (
                          <div key={key} className="mt-2">
                            <p className="text-sm">
                              <span className="font-medium">{key}:</span>{" "}
                              {value}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })}

                    {edu.achievements &&
                      Array.isArray(edu.achievements) &&
                      edu.achievements.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700">
                            Achievements:
                          </p>
                          <ul className="list-disc ml-5 mt-1 text-sm text-gray-600">
                            {edu.achievements.map(
                              (achievement: any, i: number) => (
                                <li key={i}>
                                  {typeof achievement === "string"
                                    ? achievement
                                    : renderContent(achievement)}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Experience Section */}
          {enhancedResume.experience &&
            enhancedResume.experience.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                  Professional Experience
                </h3>

                <div className="space-y-4">
                  {enhancedResume.experience.map((exp: any, idx: number) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex flex-col md:flex-row md:justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {typeof exp.company === "string"
                              ? exp.company
                              : "Company"}
                          </h4>
                          <p className="text-indigo-700">
                            {typeof exp.position === "string"
                              ? exp.position
                              : "Position"}
                          </p>
                        </div>
                        {typeof exp.date_range === "string" &&
                          exp.date_range && (
                            <div className="text-sm text-gray-500 mt-1 md:mt-0">
                              {exp.date_range}
                            </div>
                          )}
                      </div>

                      {/* Other experience details that might be objects */}
                      {Object.entries(exp).map(([key, value]) => {
                        // Skip already rendered fields
                        if (
                          [
                            "company",
                            "position",
                            "date_range",
                            "responsibilities",
                            "achievements",
                          ].includes(key)
                        ) {
                          return null;
                        }

                        // Render other fields that might be objects or complex data
                        if (
                          value !== null &&
                          value !== undefined &&
                          typeof value !== "string" &&
                          !Array.isArray(value)
                        ) {
                          return (
                            <div key={key} className="mt-2">
                              <p className="text-sm font-medium text-gray-700">
                                {key}:
                              </p>
                              <div className="p-2 bg-white rounded mt-1">
                                {renderContent(value)}
                              </div>
                            </div>
                          );
                        } else if (typeof value === "string" && value) {
                          return (
                            <div key={key} className="mt-2">
                              <p className="text-sm">
                                <span className="font-medium">{key}:</span>{" "}
                                {value}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })}

                      {exp.responsibilities &&
                        Array.isArray(exp.responsibilities) &&
                        exp.responsibilities.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-700">
                              Responsibilities:
                            </p>
                            <ul className="list-disc ml-5 mt-1 text-sm text-gray-600">
                              {exp.responsibilities.map(
                                (responsibility: any, i: number) => (
                                  <li key={i}>
                                    {typeof responsibility === "string"
                                      ? responsibility
                                      : renderContent(responsibility)}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                      {exp.achievements &&
                        Array.isArray(exp.achievements) &&
                        exp.achievements.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-700">
                              Key Achievements:
                            </p>
                            <ul className="list-disc ml-5 mt-1 text-sm text-gray-600">
                              {exp.achievements.map(
                                (achievement: any, i: number) => (
                                  <li key={i}>
                                    {typeof achievement === "string"
                                      ? achievement
                                      : renderContent(achievement)}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Projects Section */}
          {enhancedResume.projects && enhancedResume.projects.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                Projects
              </h3>

              <div className="space-y-4">
                {enhancedResume.projects.map((project: any, idx: number) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex flex-col md:flex-row md:justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {project.name}
                        </h4>
                      </div>
                      {project.url && (
                        <div className="text-sm text-indigo-600 hover:text-indigo-800 mt-1 md:mt-0">
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Project
                          </a>
                        </div>
                      )}
                    </div>

                    {project.description && (
                      <p className="mt-2 text-sm text-gray-600">
                        {project.description}
                      </p>
                    )}

                    {project.technologies &&
                      project.technologies.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {project.technologies.map(
                            (tech: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded"
                              >
                                {tech}
                              </span>
                            )
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications & Achievements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enhancedResume.certifications &&
              enhancedResume.certifications.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                    Certifications
                  </h3>

                  <ul className="list-disc ml-5 text-gray-600 space-y-2">
                    {enhancedResume.certifications.map(
                      (cert: any, idx: number) => (
                        <li key={idx}>
                          {typeof cert === "string"
                            ? cert
                            : typeof cert === "object" && cert !== null
                            ? renderContent(cert)
                            : String(cert)}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

            {enhancedResume.achievements &&
              enhancedResume.achievements.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                    Achievements
                  </h3>

                  <ul className="list-disc ml-5 text-gray-600 space-y-2">
                    {enhancedResume.achievements.map(
                      (achievement: any, idx: number) => (
                        <li key={idx}>
                          {typeof achievement === "string"
                            ? achievement
                            : typeof achievement === "object" &&
                              achievement !== null
                            ? renderContent(achievement)
                            : String(achievement)}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
          </div>
        </div>
      </div>
    );
  };

  // Update the renderContent function to handle arrays of objects properly
  const renderContent = (content: any): React.ReactNode => {
    if (content === null || content === undefined) {
      return null;
    }

    if (
      typeof content === "string" ||
      typeof content === "number" ||
      typeof content === "boolean"
    ) {
      return String(content);
    }

    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded-md">
              {renderContent(item)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof content === "object") {
      // Handle special cases with name properties (common in achievements/certifications)
      if (content.name) {
        return (
          <div className="space-y-1">
            <div className="font-medium">{content.name}</div>
            {Object.entries(content)
              .filter(([key]) => key !== "name")
              .map(([key, value], idx) => (
                <div key={idx} className="ml-2 text-sm">
                  <span className="font-medium text-gray-700">{key}:</span>{" "}
                  {renderContent(value)}
                </div>
              ))}
          </div>
        );
      }

      return (
        <div className="space-y-1">
          {Object.entries(content).map(([key, value], idx) => (
            <div key={idx} className="ml-2">
              <span className="font-medium text-gray-700">{key}:</span>{" "}
              {renderContent(value)}
            </div>
          ))}
        </div>
      );
    }

    // Fallback for any other type
    return String(content);
  };

  // Helper function to render the analysis status badge
  const renderStatusBadge = (status: string, text: string) => {
    if (status.toLowerCase() === "yes") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="h-3 w-3 mr-1" />
          {text}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          {text}
        </span>
      );
    }
  };

  // Add a helper function to safely try parsing JSON strings
  function tryParseJson(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return jsonString;
    }
  }

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

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white shadow-md rounded-lg p-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="text-lg font-medium text-gray-900 mt-4">
            Application not found
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Applications
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
              <FileText className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                Candidate Insights
              </span>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Applications
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
          {/* Candidate Header */}
          <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <User className="h-6 w-6 mr-2 text-indigo-600" />
                  {application.candidate_name}
                </h2>
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <Mail className="h-4 w-4 mr-1" />
                  {application.candidate_email}
                  <span className="mx-2">•</span>
                  <Calendar className="h-4 w-4 mr-1" />
                  Applied on{" "}
                  {new Date(
                    application.created_at || Date.now()
                  ).toLocaleDateString()}
                </div>
              </div>
              <div className="mt-4 sm:mt-0">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${
                    application.status === "selected"
                      ? "bg-green-100 text-green-800"
                      : application.status === "rejected"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {application.status === "selected" ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : application.status === "rejected" ? (
                    <XCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {application.status === "selected"
                    ? "Selected"
                    : application.status === "rejected"
                    ? "Rejected"
                    : "Pending"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Structured Resume */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-6">
                <div className="border-b border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-indigo-600" />
                    Resume Details
                  </h3>
                </div>
                <div className="p-6">
                  {enhancedResume ? (
                    <EnhancedResumeView enhancedResume={enhancedResume} />
                  ) : (
                    <div className="flex items-center justify-center py-10">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 mx-auto text-indigo-500 animate-spin mb-4" />
                        <p className="text-gray-500">
                          Processing resume data...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Cover Letter Section */}
                  {application.coverletter && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="text-md font-semibold text-gray-800 mb-2 flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-indigo-500" />
                        Cover Letter
                      </h4>
                      <div className="whitespace-pre-line text-gray-600 max-h-60 overflow-y-auto bg-gray-50 p-3 rounded-md">
                        {application.coverletter}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - AI Analysis */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                <div className="border-b border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <BarChart4 className="h-5 w-5 mr-2 text-indigo-600" />
                    AI Analysis & Insights
                  </h3>
                </div>

                <div className="p-6">
                  {analyzing ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
                      <p className="text-gray-500">Analyzing resume...</p>
                    </div>
                  ) : parsedInsights ? (
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: {
                            staggerChildren: 0.1,
                          },
                        },
                      }}
                      className="space-y-5"
                    >
                      {/* Overall Score Card */}
                      {parsedInsights.overall_score && (
                        <motion.div
                          variants={{
                            hidden: { opacity: 0, y: 5 },
                            visible: { opacity: 1, y: 0 },
                          }}
                          className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-lg shadow-sm"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-indigo-800 flex items-center text-base">
                              <Award className="h-5 w-5 mr-2 text-indigo-600" />
                              Overall Score
                            </h4>
                            <div className="bg-white w-14 h-14 rounded-full flex items-center justify-center shadow-sm border border-indigo-100">
                              <span className="text-xl font-bold text-indigo-700">
                                {parsedInsights.overall_score}/10
                              </span>
                            </div>
                          </div>

                          {parsedInsights.recommendation && (
                            <div className="mt-3 bg-white p-4 rounded-lg border border-indigo-100 text-sm text-indigo-700 leading-relaxed">
                              <p className="font-medium text-indigo-800 mb-2">
                                Recommendation:
                              </p>
                              {parsedInsights.recommendation}
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Skills Analysis */}
                      <div className="bg-white p-4 rounded-lg border border-gray-100">
                        <div className="mb-3 flex items-center justify-between">
                          <h5 className="font-medium text-gray-700 flex items-center">
                            <GraduationCap className="h-4 w-4 mr-2 text-gray-600" />
                            Skills Assessment
                          </h5>
                          {renderStatusBadge(
                            parsedInsights.skills_match,
                            parseInt(parsedInsights.skills_match) >= 7
                              ? "Strong Match"
                              : parseInt(parsedInsights.skills_match) >= 5
                              ? "Moderate Match"
                              : "Weak Match"
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {parsedInsights.skills_extracted?.length > 0 ? (
                            parsedInsights.skills_extracted.map(
                              (skill: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full"
                                >
                                  {skill}
                                </span>
                              )
                            )
                          ) : (
                            <p className="text-sm text-gray-500">
                              No skills detected
                            </p>
                          )}
                        </div>

                        <div className="mt-3">
                          <p className="text-sm text-gray-600">
                            {parsedInsights.skills_match_comments}
                          </p>
                        </div>

                        {parsedInsights.missing_skills &&
                          parsedInsights.missing_skills.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <h6 className="text-xs font-medium text-gray-700 mb-2">
                                Missing Skills:
                              </h6>
                              <div className="flex flex-wrap gap-2">
                                {parsedInsights.missing_skills.map(
                                  (skill: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full"
                                    >
                                      {skill}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Job Fit Analysis */}
                      <div className="bg-white p-4 rounded-lg border border-gray-100">
                        <div className="mb-3 flex items-center justify-between">
                          <h5 className="font-medium text-gray-700 flex items-center">
                            <Briefcase className="h-4 w-4 mr-2 text-gray-600" />
                            Job Fit Analysis
                          </h5>
                          {renderStatusBadge(
                            parsedInsights.job_fit_score,
                            parseInt(parsedInsights.job_fit_score) >= 7
                              ? "Strong Fit"
                              : parseInt(parsedInsights.job_fit_score) >= 5
                              ? "Moderate Fit"
                              : "Poor Fit"
                          )}
                        </div>
                        <div className="mt-3 p-4 rounded-md text-sm bg-gray-50 text-gray-700">
                          <div className="space-y-4">
                            <div>
                              <span className="font-medium text-gray-800">
                                Key Qualifications:
                              </span>{" "}
                              {typeof parsedInsights.key_qualifications ===
                              "string" ? (
                                parsedInsights.key_qualifications.startsWith(
                                  "{"
                                ) ||
                                parsedInsights.key_qualifications.startsWith(
                                  "["
                                ) ? (
                                  <div className="mt-2 pl-4">
                                    {renderContent(
                                      tryParseJson(
                                        parsedInsights.key_qualifications
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-1">
                                    {parsedInsights.key_qualifications}
                                  </div>
                                )
                              ) : (
                                <div className="mt-2 pl-4">
                                  {renderContent(
                                    parsedInsights.key_qualifications
                                  )}
                                </div>
                              )}
                            </div>

                            <div>
                              <span className="font-medium text-gray-800">
                                Notable Achievements:
                              </span>{" "}
                              {typeof parsedInsights.achievements ===
                              "string" ? (
                                parsedInsights.achievements.startsWith("{") ||
                                parsedInsights.achievements.startsWith("[") ? (
                                  <div className="mt-2 pl-4">
                                    {renderContent(
                                      tryParseJson(parsedInsights.achievements)
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-1">
                                    {parsedInsights.achievements}
                                  </div>
                                )
                              ) : (
                                <div className="mt-2 pl-4">
                                  {renderContent(parsedInsights.achievements)}
                                </div>
                              )}
                            </div>

                            <div>
                              <span className="font-medium text-gray-800">
                                Assessment:
                              </span>{" "}
                              {typeof parsedInsights.job_fit_analysis ===
                              "string" ? (
                                parsedInsights.job_fit_analysis.startsWith(
                                  "{"
                                ) ||
                                parsedInsights.job_fit_analysis.startsWith(
                                  "["
                                ) ? (
                                  <div className="mt-2 pl-4">
                                    {renderContent(
                                      tryParseJson(
                                        parsedInsights.job_fit_analysis
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-1">
                                    {parsedInsights.job_fit_analysis}
                                  </div>
                                )
                              ) : (
                                <div className="mt-2 pl-4">
                                  {renderContent(
                                    parsedInsights.job_fit_analysis
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interview Questions */}
                      {parsedInsights.interview_questions &&
                        parsedInsights.interview_questions.length > 0 && (
                          <div className="bg-white p-4 rounded-lg border border-gray-100">
                            <div className="mb-3">
                              <h5 className="font-medium text-gray-700 flex items-center">
                                <HelpCircle className="h-4 w-4 mr-2 text-gray-600" />
                                Suggested Interview Questions
                              </h5>
                            </div>
                            <div className="p-4 rounded-md bg-blue-50">
                              <ol className="list-decimal ml-5 text-blue-700 space-y-3">
                                {parsedInsights.interview_questions.map(
                                  (question: any, idx: number) => (
                                    <li key={idx} className="pl-1">
                                      {typeof question === "string"
                                        ? question
                                        : typeof question === "object" &&
                                          question !== null &&
                                          question.question
                                        ? question.question
                                        : typeof question === "object"
                                        ? renderContent(question)
                                        : String(question)}
                                    </li>
                                  )
                                )}
                              </ol>
                            </div>
                          </div>
                        )}

                      {/* Strengths & Areas of Concern */}
                      {((parsedInsights.strengths &&
                        parsedInsights.strengths.length > 0) ||
                        (parsedInsights.areas_of_concern &&
                          parsedInsights.areas_of_concern.length > 0)) && (
                        <div className="grid grid-cols-1 gap-4">
                          {parsedInsights.strengths &&
                            parsedInsights.strengths.length > 0 && (
                              <div className="bg-white p-4 rounded-lg border border-gray-100">
                                <h5 className="font-medium text-gray-700 flex items-center mb-3">
                                  <ThumbsUp className="h-4 w-4 mr-2 text-green-600" />
                                  Key Strengths
                                </h5>
                                <ul className="p-4 bg-green-50 rounded-md text-sm space-y-2 list-disc ml-5 text-green-700">
                                  {parsedInsights.strengths.map(
                                    (strength: string, idx: number) => (
                                      <li key={idx}>{strength}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                          {parsedInsights.areas_of_concern &&
                            parsedInsights.areas_of_concern.length > 0 && (
                              <div className="bg-white p-4 rounded-lg border border-gray-100">
                                <h5 className="font-medium text-gray-700 flex items-center mb-3">
                                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
                                  Areas to Explore
                                </h5>
                                <ul className="p-4 bg-amber-50 rounded-md text-sm space-y-2 list-disc ml-5 text-amber-700">
                                  {parsedInsights.areas_of_concern.map(
                                    (concern: string, idx: number) => (
                                      <li key={idx}>{concern}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                        </div>
                      )}
                    </motion.div>
                  ) : rawInsights ? (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <p className="text-yellow-700 text-sm font-medium mb-2">
                        Analysis output couldn't be properly formatted
                      </p>
                      <div className="mt-3 p-4 bg-white rounded border border-yellow-200 whitespace-pre-wrap text-sm text-gray-700 max-h-80 overflow-y-auto shadow-sm">
                        {rawInsights}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <AlertCircle className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-2 text-gray-500">
                        No analysis available
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {(parsedInsights || rawInsights) && (
                  <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => updateStatus("selected")}
                        disabled={updating}
                        className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Accept Candidate
                      </button>
                      <button
                        onClick={() => updateStatus("rejected")}
                        disabled={updating}
                        className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Reject Candidate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
