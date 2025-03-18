# Firebase Cloud Functions for Grade Prediction

This directory contains the Firebase Cloud Functions for the grade prediction application. These functions handle PDF processing, OCR, grade prediction, and data storage.

## Overview

The application uses Firebase Cloud Functions to:

1. Upload and process PDF documents (syllabus and transcript)
2. Extract text from PDFs using OCR
3. Predict final grades using both ChatGPT and Linear Regression models
4. Store predictions and analyses in Firestore

## Function Categories

### Authentication Functions

- `create_user_profile`: Create a user profile after registration
- `delete_user_data`: Delete a user's data when account is deleted
- `get_user_profile`: Get a user's profile data
- `update_user_profile`: Update a user's profile data

### OCR Functions

- `extract_text_from_pdf`: Extract text from a PDF file
- `process_syllabus`: Process syllabus PDF to extract course information
- `process_transcript`: Process transcript PDF to extract grade information
- `process_uploaded_pdf`: Triggered when a PDF is uploaded to Firebase Storage

### OpenAI API Functions

- `analyze_grades`: Analyze extracted grade data using OpenAI API
- `predict_final_grade`: Predict final grade based on current grades and weights
- `extract_assignments`: Extract upcoming assignments and exams from syllabus

### Storage Functions

- `get_upload_url`: Generate a signed URL for uploading a PDF to Firebase Storage

### ML Prediction Functions

- `predict_with_linear_regression`: Predict final grade using Linear Regression model
- `add_training_data`: Add new training data for the linear regression model

### Combined Prediction Functions

- `get_combined_prediction`: Get combined prediction from both ChatGPT and Linear Regression models
- `get_latest_predictions`: Get the latest predictions for a user

### Document Processing Functions

- `upload_and_process_document`: Upload and process a document (syllabus or transcript)
- `get_document_status`: Get the status of a document upload and processing
- `get_user_documents`: Get all documents uploaded by a user

## Workflow

1. User uploads a syllabus and transcript PDF
2. PDFs are stored in Firebase Storage
3. OCR extracts text from PDFs
4. Extracted text is processed to get structured data
5. Structured data is used to predict final grades
6. Predictions are stored in Firestore

## Database Structure

### Firestore Collections

- `/users/{userId}`: User profile data
- `/users/{userId}/documents/{documentType}`: Extracted text from PDFs
- `/users/{userId}/syllabi/{syllabusId}`: Structured syllabus data
- `/users/{userId}/transcripts/{transcriptId}`: Structured transcript data
- `/users/{userId}/predictions/{predictionId}`: ChatGPT predictions
- `/users/{userId}/ml_predictions/{predictionId}`: Linear Regression predictions
- `/users/{userId}/combined_predictions/{predictionId}`: Combined predictions
- `/users/{userId}/analyses/{analysisId}`: Grade analyses
- `/users/{userId}/assignments/{assignmentsId}`: Extracted assignments
- `/users/{userId}/document_uploads/{documentId}`: Document upload metadata
- `/training_data/students`: Training data for Linear Regression model

### Firebase Storage

- `/users/{userId}/syllabus/{filename}.pdf`: Syllabus PDFs
- `/users/{userId}/transcript/{filename}.pdf`: Transcript PDFs

## Environment Variables

- `OPENAI_API_KEY`: OpenAI API key for ChatGPT predictions

## Dependencies

- `firebase_functions`: Firebase Cloud Functions SDK
- `firebase_admin`: Firebase Admin SDK
- `google-cloud-firestore`: Google Cloud Firestore SDK
- `openai`: OpenAI API SDK
- `numpy`: Numerical computing library
- `scikit-learn`: Machine learning library
- `PyMuPDF`: PDF processing library
- `python-dotenv`: Environment variable management
