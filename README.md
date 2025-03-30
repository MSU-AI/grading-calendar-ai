# Academic Performance Predictor

A web application that leverages Firebase, OCR, and AI to help students track and predict their academic performance by analyzing their academic documents.

## 📚 Overview

Academic Performance Predictor automatically extracts key information from your academic documents (syllabi, grade reports, transcripts) and:

- Calculates your current grade based on completed assignments
- Predicts your final grade using AI and academic history
- Tracks upcoming assignment deadlines
- Provides detailed performance analytics by assignment category

## 📱 User Guide

### Getting Started

1. **Sign Up/Login**: Create an account or sign in using your email or Google account.

2. **Dashboard Overview**: After logging in, you'll see the main dashboard with two primary tabs:
   - Document Manager
   - Grade Prediction

### Document Management

1. **Uploading Documents**:
   - Navigate to the "Document Manager" tab
   - Select document type (Syllabus, Transcript, Grades)
   - Click "Select Documents" to choose PDF files from your device
   - Click "Upload Documents" to submit
   - Tip: Include keywords like "syllabus," "transcript," or "grade" in your filename for automatic categorization

2. **Document Processing Status**:
   - After upload, documents will appear in the "Your Documents" list
   - Documents go through three stages:
     - Uploaded → Extracted → Processed
   - If processing stalls, use the "Process Documents" button

3. **Manual Processing**:
   - For documents that need manual processing, click "Process Document" next to the document name
   - Once documents are extracted, click "Format Documents" to prepare data for analysis

### Grade Prediction

1. **Generating Predictions**:
   - Navigate to the "Grade Prediction" tab
   - Once documents are processed, click the "Predict Grade" button
   - The system will analyze your documents and display results

2. **Understanding Prediction Results**:
   - **Current Grade**: Displays your current grade as a letter and percentage
   - **Grade Range**: Shows minimum and maximum possible grades
   - **Analysis**: Detailed explanation of prediction factors
   - **AI Prediction**: Additional AI-powered analysis considering your academic history
   - **Grade Breakdown**: Performance by category (exams, homework, etc.)

3. **Using Predictions**:
   - Review category performance to identify improvement areas
   - Note the minimum required scores for upcoming assignments
   - Prioritize categories with higher weights for maximum impact

## ✨ Features

- **PDF Document Processing**
  - Upload course syllabi, grade reports, and transcripts
  - Automatic text extraction using OCR
  - AI-powered data categorization and formatting

- **Grade Tracking**
  - Real-time grade calculation based on assignment weights
  - Performance breakdown by category (exams, assignments, etc.)
  - Visual dashboard showing current standing

- **Intelligent Prediction**
  - AI-based grade prediction using:
    - Current performance
    - Assignment difficulty
    - Academic history
    - Remaining coursework
  - Min/max possible grade calculation

- **Security and Privacy**
  - Secure document storage
  - User authentication
  - Data encrypted at rest

## 🛠️ Technology Stack

- **Frontend**: React with TypeScript
- **Backend**: Firebase Cloud Functions (Node.js)
- **Database**: Firebase Firestore
- **Storage**: Firebase Cloud Storage
- **Authentication**: Firebase Authentication
- **AI**: OpenAI API for text processing and prediction

## 🧠 How It Works

1. **Document Upload**: User uploads academic PDFs through the web interface
2. **Text Extraction**: Firebase Cloud Function extracts text using OCR
3. **Data Processing**: OpenAI API processes the extracted text to identify:
   - Assignment weights
   - Current grades
   - Important dates
   - Course requirements
4. **Data Storage**: Structured data is stored in Firebase Database
5. **Visualization**: Web application retrieves and displays:
   - Current grade calculation
   - Grade predictions
   - Upcoming deadlines
   - Performance analytics

## 🔒 Security

- All documents are stored securely in Firebase Cloud Storage
- User authentication required for all operations
- Data access restricted through Firebase Security Rules
- Sensitive information encrypted at rest

## 🚀 Future Enhancements

- Mobile application support
- Grade improvement recommendations
- Course planning assistance
- Integration with learning management systems (Canvas, Blackboard, etc.)
- Collaborative study group features
- PDF annotation and note-taking

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.