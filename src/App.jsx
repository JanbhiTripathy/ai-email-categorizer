import React, { useState } from 'react';

// --- Helper Components ---

// Icon for the header
const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-white">
    <rect width="20" height="16" x="2" y="4" rx="2"></rect>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
  </svg>
);

// Spinner for loading state
const LoadingSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// Component to display the result category with a nice badge style
const CategoryBadge = ({ category }) => {
  const getCategoryClass = (cat) => {
    switch (cat.toLowerCase()) {
      case 'primary':
        return 'bg-blue-100 text-blue-800 border-blue-400';
      case 'promotions':
        return 'bg-green-100 text-green-800 border-green-400';
      case 'social':
        return 'bg-yellow-100 text-yellow-800 border-yellow-400';
      case 'updates':
        return 'bg-purple-100 text-purple-800 border-purple-400';
      case 'forums':
        return 'bg-teal-100 text-teal-800 border-teal-400';
      case 'spam':
        return 'bg-red-100 text-red-800 border-red-400';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-400';
    }
  };

  if (!category) return null;

  return (
    <div className={`mt-6 rounded-lg p-4 border-l-4 shadow-md ${getCategoryClass(category)}`}>
      <p className="font-semibold text-lg">Email Category:</p>
      <p className="text-2xl font-bold">{category}</p>
    </div>
  );
};


// --- Main App Component ---
export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [emailText, setEmailText] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // This is a sample email to show the user how it works
  const sampleEmail = `Subject: Your order #12345 has shipped!

Hi there,

Great news! Your recent order from Gadget Galaxy has been shipped and is on its way to you.

You can track your package here: [Tracking Link]

It's expected to arrive in 3-5 business days. We hope you enjoy your new gadget!

Thanks for shopping with us,
The Gadget Galaxy Team`;

  const handleCategorize = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Google AI API Key.');
      return;
    }
    if (!emailText.trim()) {
      setError('Please paste an email into the text box.');
      return;
    }

    setIsLoading(true);
    setError('');
    setCategory('');

    // **UPDATED PROMPT:** Now includes Updates and Forums categories.
    const fullPrompt = `You are an expert email classifier that categorizes emails similar to Gmail. Your task is to categorize the given email into one of the following six categories: "Primary", "Promotions", "Social", "Updates", "Forums", or "Spam".

- "Primary": Important, personal conversations between individuals.
- "Promotions": Marketing emails, offers, and newsletters.
- "Social": Notifications from social media platforms like Facebook, X, and LinkedIn.
- "Updates": Automated transactional emails like order confirmations, shipping notices, bills, or flight alerts.
- "Forums": Messages from mailing lists, online groups, and discussion boards.
- "Spam": Unsolicited, irrelevant, or malicious emails.

Analyze the content below and respond with ONLY the category name and nothing else.

---
EMAIL CONTENT:
${emailText}
---`;
    
    // The Gemini API call
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [{
                    text: fullPrompt
                }]
            }]
        };

        // Retry logic with exponential backoff
        let response;
        let attempts = 0;
        const maxAttempts = 5;
        while(attempts < maxAttempts) {
            try {
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    break; // Success
                }
                
                if (response.status === 401) {
                    throw new Error('API request failed with status 401. Check your API Key.');
                }

                if (response.status === 400) {
                     const errorData = await response.json();
                     console.error("API Error Details:", errorData);
                     throw new Error('API request failed with status 400 (Bad Request).');
                }

                if (response.status === 429 || response.status >= 500) {
                    // Throttling or server error, so we retry
                    const delay = Math.pow(2, attempts) * 1000 + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    attempts++;
                } else {
                    // Other client-side error, don't retry
                    throw new Error(`API request failed with status ${response.status}`);
                }
            } catch (networkError) {
                 if (networkError.message.includes('401') || networkError.message.includes('400')) throw networkError; // Don't retry
                 if (attempts >= maxAttempts - 1) throw networkError;
                 const delay = Math.pow(2, attempts) * 1000 + Math.random() * 1000;
                 await new Promise(resolve => setTimeout(resolve, delay));
                 attempts++;
            }
        }
        
        if (!response || !response.ok) {
           throw new Error('Failed to get a response from the API after multiple attempts.');
        }

        const result = await response.json();
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
          // Clean up the response to ensure it's just the category name
          const cleanedCategory = generatedText.trim().replace(/[^a-zA-Z]/g, "");
          setCategory(cleanedCategory);
        } else {
          throw new Error("The AI returned an empty response.");
        }

    } catch (err) {
      console.error("API call failed:", err);
      setError(err.message || 'An error occurred while categorizing the email. Please try again.');
      setCategory('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen flex flex-col items-center p-4 sm:p-6 text-white font-sans">
      <div className="w-full max-w-3xl">

        {/* --- Header --- */}
        <header className="flex items-center justify-center gap-3 p-4 bg-gray-800 rounded-t-xl shadow-lg">
          <MailIcon />
          <h1 className="text-3xl font-bold tracking-tight text-white">AI Email Categorizer</h1>
        </header>

        <main className="bg-gray-800 bg-opacity-50 p-6 sm:p-8 rounded-b-xl shadow-2xl backdrop-blur-sm border border-gray-700">
          <p className="text-gray-300 text-lg mb-4 text-center">
            Paste the full content of an email below and let our AI determine its category.
          </p>
          
          {/* --- API Key Input Area --- */}
           <div className="mb-4">
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-400 mb-1">
                Google AI API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key here"
                className="w-full p-2 bg-gray-900 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 text-gray-200"
              />
               <p className="text-xs text-gray-500 mt-1">
                You can get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
              </p>
            </div>

          {/* --- Email Input Area --- */}
          <div className="relative">
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Paste your email subject and body here..."
              className="w-full h-64 p-4 bg-gray-900 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 text-gray-200 resize-none"
            />
            <button
                onClick={() => setEmailText(sampleEmail)}
                className="absolute bottom-3 right-3 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-1 px-2 rounded-md transition-colors"
            >
                Try Sample
            </button>
          </div>
          

          {/* --- Action Button --- */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleCategorize}
              disabled={isLoading}
              className="flex items-center justify-center w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-bold text-lg text-white transition-all duration-300 transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  Categorizing...
                </>
              ) : (
                'Categorize Email'
              )}
            </button>
          </div>

          {/* --- Error and Result Display --- */}
          {error && <p className="mt-4 text-center text-red-400 font-semibold">{error}</p>}
          
          <div className="mt-6 min-h-[100px]">
             <CategoryBadge category={category} />
          </div>

        </main>
        
        {/* --- Footer --- */}
        <footer className="text-center mt-8 text-gray-500 text-sm">
            <p>Powered by Google's Gemini AI</p>
        </footer>
      </div>
    </div>
  );
}

