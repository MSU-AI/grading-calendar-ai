from firebase_functions import https_fn, storage_fn
from firebase_admin import firestore, storage
import google.cloud.firestore
import tempfile
import os
import io
import pikepdf

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
        # Store basic information in Firestore
        db = firestore.client()
        doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
        doc_ref.set({
            "filePath": file_path,
            "uploadedAt": firestore.SERVER_TIMESTAMP,
            "status": "uploaded"
        })
        
        print(f"PDF uploaded successfully to {file_path}")
        return
    
    finally:
        # Clean up temp file
        os.remove(temp_local_filename)

@https_fn.on_call()
def extract_pdf_text(req: https_fn.CallableRequest) -> dict:
    """
    Extract text from a PDF stored in Firebase Storage.
    This function is called when the predict button is pressed.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    document_type = req.data.get("documentType")
    
    if not document_type or document_type not in ["syllabus", "transcript", "grades"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Valid document type (syllabus, transcript, or grades) is required"
        )
    
    try:
        # Get document info from Firestore
        db = firestore.client()
        doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"{document_type} not found"
            )
        
        doc_data = doc.to_dict()
        file_path = doc_data.get("filePath")
        
        if not file_path:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"File path not found for {document_type}"
            )
        
        # Download PDF from Firebase Storage
        bucket = storage.bucket()
        blob = bucket.blob(file_path)
        pdf_bytes = blob.download_as_bytes()
        
        # Extract text using pikepdf
        text = ""
        with pikepdf.Pdf.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() + "\n"
        
        # Update document in Firestore with extracted text
        doc_ref.update({
            "text": text,
            "lastExtracted": firestore.SERVER_TIMESTAMP,
            "status": "processed"
        })
        
        return {
            "success": True,
            "documentType": document_type,
            "message": f"Successfully extracted text from {document_type}"
        }
    
    except Exception as e:
        print(f"Error extracting text from {document_type}: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error extracting text from {document_type}: {str(e)}"
        )

@https_fn.on_call()
def get_document_info(req: https_fn.CallableRequest) -> dict:
    """
    Get information about an uploaded document.
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
    
    # Get document info from Firestore
    db = firestore.client()
    document_type = file_path.split("/")[2]  # "syllabus" or "transcript"
    doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
    doc = doc_ref.get()
    
    if doc.exists:
        return {"success": True, "data": doc.to_dict()}
    
    raise https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.NOT_FOUND,
        message="Document not found"
    )
