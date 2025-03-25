# Academic Performance Predictor - Developer Onboarding Guide

Welcome to the Academic Performance Predictor project! This guide will help you get set up, understand the codebase, and start contributing effectively.

## Project Overview

The Academic Performance Predictor is a web application that:
- Processes academic documents (syllabi, transcripts, grade reports)
- Extracts key information using OCR and AI
- Provides grade predictions and analysis
- Helps students track assignment deadlines and performance

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Firebase Cloud Functions (Node.js)
- **Database**: Firebase Firestore
- **Storage**: Firebase Cloud Storage
- **Authentication**: Firebase Authentication
- **AI**: OpenAI API for text processing

## Prerequisites

- Node.js (v16+) and npm
- Firebase CLI
- Git
- A code editor (VS Code recommended)
- A Firebase project with Blaze plan (required for Cloud Functions)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/grading-calendar-ai.git
cd grading-calendar-ai
```

### 2. Install Dependencies

First, install project-wide dependencies:

```bash
npm install
```

Then, install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Finally, install Cloud Functions dependencies:

```bash
cd functions-node
npm install
cd ..
```

### 3. Set Up Firebase

Install the Firebase CLI if you haven't already:

```bash
npm install -g firebase-tools
```

Log in to Firebase:

```bash
firebase login
```

Configure the project to use your Firebase project:

```bash
firebase use --add
```

Select your Firebase project when prompted.

### 4. Set Up Environment Variables

Create a `.env` file in the `functions-node` directory:

```bash
cd functions-node
touch .env
```

Add your OpenAI API key:

```
OPENAI_API_KEY=your_api_key_here
```

Or set it in Firebase using:

```bash
firebase functions:config:set openai.apikey="your_api_key_here"
```

### 5. Run the Project Locally

Start the Firebase emulators:

```bash
firebase emulators:start
```

In a separate terminal, start the frontend development server:

```bash
cd frontend
npm start
```

This will run the app at [http://localhost:3000](http://localhost:3000).

## Project Structure

Here's a breakdown of the main directories and files:

```
/
├── .github/                # GitHub Actions workflows
├── functions-node/         # Firebase Cloud Functions (Node.js)
│   ├── index.js            # Main Cloud Functions implementation
│   └── package.json        # Node.js dependencies for functions
├── frontend/               # React frontend
│   ├── public/             # Static files
│   ├── src/                # Source code
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts (Auth, etc.)
│   │   ├── firebase/       # Firebase configuration
│   │   └── App.tsx         # Main App component
│   └── package.json        # Frontend dependencies
├── firebase.json           # Firebase configuration
├── firestore.rules         # Firestore security rules
└── storage.rules           # Firebase Storage security rules
```

## Key Files for Development

When working on features or bug fixes, you'll primarily be dealing with these files:

### Backend (Cloud Functions)

- **`functions-node/index.js`** - Main file for all backend logic
  - Contains all Cloud Functions that handle document upload, OCR, and prediction
  - AI integration with OpenAI for processing documents
  - Firestore data management

### Frontend Components

- **`frontend/src/components/DocumentManager.tsx`** - Handles document upload and management
- **`frontend/src/components/PredictionPanel.tsx`** - Displays prediction results
- **`frontend/src/components/Dashboard.tsx`** - Main dashboard UI
- **`frontend/src/contexts/AuthContext.tsx`** - Authentication logic

## Testing Your Changes

### 1. Backend (Cloud Functions) Testing

After making changes to Cloud Functions, you can test them in several ways:

1. **Using Firebase Local Emulators:**
   ```bash
   firebase emulators:start
   ```

2. **Using the test-pdf-parse.js script:**
   ```bash
   cd functions-node
   node test-pdf-parse.js path/to/test/file.pdf
   ```

3. **Testing API endpoints directly:**
   - Use the Firebase Functions shell:
   ```bash
   firebase functions:shell
   ```
   - Call a function:
   ```
   extractPdfText({documentId: "your-doc-id"})
   ```

### 2. Frontend Testing

1. **Run the development server:**
   ```bash
   cd frontend
   npm start
   ```

2. **Testing with real data:**
   - Create a test user account
   - Upload test PDF documents
   - Check the Firestore database in the Firebase console

3. **Testing UI interactions:**
   - Test form submissions
   - Verify error messages appear correctly
   - Check responsive design on different screen sizes

## Common Development Tasks

### Adding a New Cloud Function

1. Open `functions-node/index.js`
2. Add your new function using the pattern:
   ```javascript
   exports.yourNewFunction = functions.https.onCall(async (data, context) => {
     // Authenticate user
     if (!context.auth) {
       throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
     }
     
     try {
       // Your function logic here
       return {
         success: true,
         data: yourResult
       };
     } catch (error) {
       console.error('Error in yourNewFunction:', error);
       throw new functions.https.HttpsError('internal', error.message);
     }
   });
   ```

3. Deploy the function:
   ```bash
   firebase deploy --only functions
   ```

### Calling a Cloud Function from the Frontend

In your React component:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

// Later in your component code
const functions = getFunctions();
const yourFunction = httpsCallable(functions, 'yourNewFunction');

// Call the function
const result = await yourFunction({ param1: 'value1' });
```

### Adding a New React Component

1. Create a new file in `frontend/src/components/`
2. Build your component using React Hooks and TypeScript
3. Import and use it in your parent component

## Common Issues and Solutions

### 1. CORS Issues with Cloud Functions

If you encounter CORS issues, make sure your functions properly handle CORS:

```javascript
// Add to top of your function
response.set('Access-Control-Allow-Origin', '*');
response.set('Access-Control-Allow-Methods', 'GET, POST');
response.set('Access-Control-Allow-Headers', 'Content-Type');
```

### 2. Firebase Authentication Problems

Common issues include:
- Not initializing the Firebase app correctly
- Missing authentication rules
- Not handling auth state properly

Check the AuthContext implementation and Firebase configuration.

### 3. PDF Processing Errors

When dealing with PDF processing:
- Make sure the PDF is valid and not corrupted
- Verify file permissions
- Check if the file size is within Firebase limits
- Review OpenAI API quotas if using AI processing

## Tips and Tricks

1. **Use Firebase Console** - It's your best friend for debugging:
   - View Firestore data
   - Test authentication
   - Monitor Cloud Functions logs
   - Check Storage files

2. **Leverage the Firebase Emulators**:
   - They provide a local development environment
   - Don't incur costs during testing
   - Allow faster iteration

3. **Add console.log statements** in Cloud Functions for debugging:
   ```javascript
   console.log('Function called with data:', JSON.stringify(data));
   ```
   View logs in Firebase console or emulator UI.

4. **Use React Developer Tools** browser extension for debugging React components.

5. **Batch Firestore operations** when working with multiple documents:
   ```javascript
   const batch = db.batch();
   // Add your batch operations
   await batch.commit();
   ```

6. **Test with sample PDFs** of various formats to ensure robust processing.

## Next Steps for Development

Here are some features that could be improved or added:

1. **Better error handling** - More detailed error messages and recovery options
2. **Enhanced PDF extraction** - Improve OCR accuracy and structured data extraction
3. **Real-time updates** - Implement WebSockets for live status updates
4. **Mobile responsive design** - Improve mobile experience
5. **Offline support** - Add offline capabilities using PWA features
6. **User dashboard improvements** - More visualization options for grades
7. **Multi-course support** - Handle multiple courses simultaneously
8. **Integration with LMS** - Connect with Canvas, Blackboard, etc.

## Getting Help

If you encounter any issues:
1. Check Firebase documentation
2. Look at existing code patterns
3. Use console logs for debugging
4. Ask for help in the team chat
5. Use AI tools like Claude or ChatGPT by providing the relevant code context

## Deployment

When ready to deploy your changes:

```bash
# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting
```

Happy coding! Remember, the goal is to make an app that helps students track and improve their academic performance.