# Academic Performance Predictor - Developer Onboarding Guide

Welcome to the Academic Performance Predictor project! This guide will help team members understand the codebase and start contributing effectively.

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
- Git
- A code editor (VS Code recommended)

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

### 3. Run the Project Locally

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

## Testing Cloud Functions

**Important:** To test Cloud Functions, you need access to the Firebase project. Contact the project owner to be added as a collaborator. Once added, you'll be able to test functions directly against the Firebase infrastructure.

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

3. **Testing with the frontend:**
   - Make changes to the functions
   - Run the emulator
   - Use the web app to test the functionality

### 2. Frontend Testing

1. **Run the development server:**
   ```bash
   cd frontend
   npm start
   ```

2. **Testing with real data:**
   - Create a test user account
   - Upload test PDF documents
   - Check the app's response and UI

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

3. Test your function locally with the emulator

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
- Not handling auth state properly
- Issues with login/logout functionality
- Problems with protected routes

Check the AuthContext implementation and make sure you're correctly using the authentication hooks.

### 3. PDF Processing Errors

When dealing with PDF processing:
- Make sure the PDF is valid and not corrupted
- Test with different file sizes
- Add proper error handling for PDF processing failures

## Tips and Tricks

1. **Use Firebase Console for Debugging** - If you have access, it's great for:
   - Viewing Firestore data
   - Testing authentication
   - Monitoring Cloud Functions logs
   - Checking Storage files

2. **Leverage the Firebase Emulators**:
   - They provide a local development environment
   - Allow faster iteration
   - Don't require full Firebase access for basic testing

3. **Add console.log statements** in Cloud Functions for debugging:
   ```javascript
   console.log('Function called with data:', JSON.stringify(data));
   ```
   View logs in the emulator UI.

4. **Use React Developer Tools** browser extension for debugging React components.

5. **Test with sample PDFs** of various formats to ensure robust processing.

6. **Use AI tools for assistance** - You can use AI tools like Claude or ChatGPT to help with coding by providing context from the files. The [AI Digest](https://github.com/khromov/ai-digest) tool mentioned in the intro can help with this.

## Feature Development Ideas

Here are some features that could be improved or added:

1. **Better error handling** - More detailed error messages and recovery options
2. **Enhanced PDF extraction** - Improve OCR accuracy and structured data extraction
3. **Real-time updates** - Implement WebSockets for live status updates
4. **Mobile responsive design** - Improve mobile experience
5. **User dashboard improvements** - More visualization options for grades
6. **Multi-course support** - Handle multiple courses simultaneously
7. **Advanced prediction features** - Add more sophisticated grade prediction algorithms

## Getting Help

If you encounter any issues:
1. Check Firebase documentation
2. Look at existing code patterns
3. Use console logs for debugging
4. Ask for help in the team chat
5. Use AI tools by providing the relevant code context
6. Contact the project owner for Firebase access issues

## Submitting Your Changes

When you've completed your feature or bug fix:

1. Create a branch with a descriptive name
2. Commit your changes with clear messages
3. Push your branch
4. Create a pull request
5. Provide details about what you changed and how to test it

Happy coding! Remember, the goal is to make an app that helps students track and improve their academic performance.