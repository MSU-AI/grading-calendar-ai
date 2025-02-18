# grading-calendar-ai
# Academic Performance Predictor

A web application that leverages Firebase, OCR, and AI to help students track and predict their academic performance by analyzing their academic documents.

## Features

- PDF document processing for:
  - Course syllabi
  - Current grade reports
  - Academic transcripts
- Real-time grade calculation and performance tracking
- Grade prediction based on historical performance
- Upcoming assignment and exam deadline tracking
- Interactive dashboard with current standing and predictions
- Secure document storage and data management

## Architecture

### Technology Stack

- Frontend: Web Application (React/Angular/Vue)
- Backend: Firebase Cloud Functions
- Database: Firebase Realtime Database/Firestore
- Storage: Firebase Cloud Storage
- AI/ML: OpenAI API
- Document Processing: OCR text extraction

### Data Flow

1. User uploads academic PDFs through the web interface
2. Firebase Cloud Function triggers OCR text extraction
3. Extracted text is processed by OpenAI API to identify:
   - Assignment weights
   - Current grades
   - Important dates
   - Course requirements
4. Structured data is stored in Firebase Database
5. Web application retrieves and displays:
   - Current grade calculation
   - Grade predictions
   - Upcoming deadlines
   - Performance analytics

## Setup

1. Create a Firebase project
2. Enable necessary Firebase services:
   - Cloud Functions
   - Firestore/Realtime Database
   - Cloud Storage
   - Authentication
3. Configure environment variables:
   ```
   OPENAI_API_KEY=your_api_key
   FIREBASE_CONFIG=your_firebase_config
   ```
4. Deploy Firebase Cloud Functions:
   ```bash
   firebase deploy --only functions
   ```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Start Firebase emulators:
   ```bash
   firebase emulators:start
   ```

## Firebase Cloud Functions

The application uses several cloud functions for backend processing:

- `processDocument`: Handles PDF upload and triggers OCR
- `extractData`: Processes OCR output with OpenAI API
- `calculateGrades`: Computes current grades based on weights
- `predictPerformance`: Generates performance predictions

## Security

- All documents are stored securely in Firebase Cloud Storage
- User authentication required for all operations
- Data access restricted through Firebase Security Rules
- Sensitive information encrypted at rest

## Future Enhancements

- Mobile application support
- Grade improvement recommendations
- Course planning assistance
- Integration with learning management systems
- Performance analytics dashboard
- Collaborative study group features

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details