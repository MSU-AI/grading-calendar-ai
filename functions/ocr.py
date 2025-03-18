from firebase_functions import https_fn, storage_fn
from firebase_admin import firestore, storage
import google.cloud.firestore
import fitz  # PyMuPDF
import tempfile
import os
import json
import openai

# Initialize OpenAI client
openai.api_key = os.environ.get("OPENAI_API_KEY")

@storage_fn.on_object_finalized()
def process_uploaded_pdf(event: storage_fn.CloudEvent) -> None:
    """
    Triggered when a PDF is uploaded to Firebase Storage.
    Extracts text and stores it in Firestore.
    """
    bucket = storage.bucket()
    file_path = event.data["name"]
    
    # Only process PDFs in the user's directory
    if not file_path.startswith("users/"):
        return
    
    # Extract user ID and document type from path
    # Expected format: users/{userId}/{documentType}/{filename}.pdf
    path_parts = file_path.split("/")
    if len(path_parts) < 4:
        return
    
    user_id = path_parts[1]
    document_type = path_parts[2]  # "syllabus" or "transcript"
    
    # Download file to temp location
    blob = bucket.blob(file_path)
    _, temp_local_filename = tempfile.mkstemp()
    blob.download_to_filename(temp_local_filename)
    
    # Extract text
    try:
        doc = fitz.open(temp_local_filename)
        text = "\n".join([page.get_text("text") for page in doc])
        
        # Store extracted text in Firestore
        db = firestore.client()
        doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
        doc_ref.set({
            "text": text,
            "filePath": file_path,
            "uploadedAt": firestore.SERVER_TIMESTAMP
        })
        
        # Process based on document type
        if document_type == "syllabus":
            process_syllabus_internal(user_id, text)
        elif document_type == "transcript":
            process_transcript_internal(user_id, text)
    
    finally:
        # Clean up temp file
        os.remove(temp_local_filename)

def process_syllabus_internal(user_id, text):
    """Internal function to process syllabus text."""
    try:
        # Use OpenAI to extract structured data from syllabus
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": 
                 """Extract and format the following information from this syllabus into JSON:
                 - Course Name
                 - Instructor Name
                 - Grade Weight
                 - Assignment Names
                 - Due Dates
                 - Credit Hours
                 
                 Return the data in this JSON format:
                 {
                    "course_name": "...",
                    "instructor": "...",
                    "grade_weights": [{"name": "...", "weight": "..."}],
                    "assignments": ["...", "..."],
                    "due_dates": [{"assignment": "...", "due_date": "..."}],
                    "credit_hours": "..."
                 }
                 """},
                {"role": "user", "content": text}
            ]
        )
        
        # Parse the response
        structured_data = json.loads(response["choices"][0]["message"]["content"])
        
        # Store structured data in Firestore
        db = firestore.client()
        syllabus_ref = db.collection("users").document(user_id).collection("syllabi").document()
        
        syllabus_data = {
            "data": structured_data,
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        
        syllabus_ref.set(syllabus_data)
        
        return structured_data
    
    except Exception as e:
        print(f"Error processing syllabus: {str(e)}")
        return None

def process_transcript_internal(user_id, text):
    """Internal function to process transcript text."""
    try:
        # Use OpenAI to extract structured data from transcript
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": 
                 """Extract and format the following information from this transcript into JSON:
                 - GPA
                 - Previous Grades
                 - Final Grade (if available)
                 
                 Return the data in this JSON format:
                 {
                    "gpa": "...",
                    "previous_grades": [{"course": "...", "grade": "..."}],
                    "final_grade": "..."
                 }
                 """},
                {"role": "user", "content": text}
            ]
        )
        
        # Parse the response
        structured_data = json.loads(response["choices"][0]["message"]["content"])
        
        # Store structured data in Firestore
        db = firestore.client()
        transcript_ref = db.collection("users").document(user_id).collection("transcripts").document()
        
        transcript_data = {
            "data": structured_data,
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        
        transcript_ref.set(transcript_data)
        
        return structured_data
    
    except Exception as e:
        print(f"Error processing transcript: {str(e)}")
        return None

@https_fn.on_call()
def extract_text_from_pdf(req: https_fn.CallableRequest) -> dict:
    """
    Callable function to extract text from PDF using OCR.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    file_path = req.data.get("filePath")
    if not file_path:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="File path is required"
        )
    
    # Check if file path belongs to the user
    user_id = req.auth.uid
    if not file_path.startswith(f"users/{user_id}/"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="You don't have permission to access this file"
        )
    
    # Get text from Firestore if already processed
    db = firestore.client()
    document_type = file_path.split("/")[2]  # "syllabus" or "transcript"
    doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
    doc = doc_ref.get()
    
    if doc.exists:
        return {"text": doc.to_dict().get("text", "")}
    
    # If not processed yet, return error
    raise https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.NOT_FOUND,
        message="Document not processed yet"
    )

@https_fn.on_call()
def process_syllabus(req: https_fn.CallableRequest) -> dict:
    """
    Process syllabus PDF to extract course information.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    # Get syllabus text from Firestore
    db = firestore.client()
    doc_ref = db.collection("users").document(user_id).collection("documents").document("syllabus")
    doc = doc_ref.get()
    
    if not doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Syllabus not found"
        )
    
    # Process syllabus text
    text = doc.to_dict().get("text", "")
    result = process_syllabus_internal(user_id, text)
    
    if result:
        return {"success": True, "data": result}
    else:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Error processing syllabus"
        )

@https_fn.on_call()
def process_transcript(req: https_fn.CallableRequest) -> dict:
    """
    Process transcript PDF to extract grade information.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    # Get transcript text from Firestore
    db = firestore.client()
    doc_ref = db.collection("users").document(user_id).collection("documents").document("transcript")
    doc = doc_ref.get()
    
    if not doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Transcript not found"
        )
    
    # Process transcript text
    text = doc.to_dict().get("text", "")
    result = process_transcript_internal(user_id, text)
    
    if result:
        return {"success": True, "data": result}
    else:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Error processing transcript"
        )
