import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug output for Supabase configuration
console.log("Supabase URL:", supabaseUrl);
console.log(
  "Supabase key format check:",
  supabaseKey ? "Key exists" : "Key missing"
);

// Create a custom fetch with timeout and retry logic
const customFetch = (...args) => {
  console.log("Supabase fetch:", args[0]);

  // Add timeout to prevent hanging requests
  const fetchWithTimeout = (resource, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    return fetch(resource, {
      ...options,
      signal: controller.signal,
    })
      .then((response) => {
        clearTimeout(timeoutId);
        return response;
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error("Fetch error:", error);
        if (error.name === "AbortError") {
          console.log("Request timed out");
        }
        throw error;
      });
  };

  return fetchWithTimeout(args[0], args[1]);
};

// Create a modified client with additional options for better debugging
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: customFetch,
  },
  // Set longer timeout for supabase client
  realtime: {
    timeout: 20000, // 20 seconds
  },
});
