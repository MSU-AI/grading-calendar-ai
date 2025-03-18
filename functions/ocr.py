from firebase_functions import https_fn, storage_fn
from firebase_admin import firestore, storage
import google.cloud.firestore
import logging
import os
from vision_helper import extract_text_from_pdf

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@storage_fn.on_object_finalized()
def process_uploaded_pdf(event: storage_fn.CloudEvent) -> None:
    """
    Triggered when a PDF is uploaded to Firebase Storage.
    Stores basic information in Firestore.
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
    
    try:
        # Store basic information in Firestore
        db = firestore.client()
        doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
        doc_ref.set({
            "filePath": file_path,
            "uploadedAt": firestore.SERVER_TIMESTAMP,
            "status": "uploaded"
        })
        
        logger.info(f"PDF uploaded successfully to {file_path}")
        return
    
    except Exception as e:
        logger.error(f"Error processing uploaded PDF: {str(e)}")
        return

@https_fn.on_call()
def extract_pdf_text(req: https_fn.CallableRequest) -> dict:
    """
    Extract text from a PDF stored in Firebase Storage using Google Cloud Vision API.
    This function is called manually to process PDFs.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    document_type = req.data.get("documentType")
    
    if not document_type:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Document type is required"
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
        
        # Extract text using Vision API
        full_text = extract_text_from_pdf(file_path)
        
        # Update document in Firestore with extracted text
        doc_ref.update({
            "text": full_text,
            "lastExtracted": firestore.SERVER_TIMESTAMP,
            "status": "processed"
        })
        
        return {
            "success": True,
            "documentType": document_type,
            "message": f"Successfully extracted text from {document_type}"
        }
    
    except Exception as e:
        logger.error(f"Error extracting text from {document_type}: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error extracting text from {document_type}: {str(e)}"
        )

# This function is used to get document info - we'll keep it but simplify
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
    
    document_type = req.data.get("documentType")
    if not document_type:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Document type is required"
        )
    
    user_id = req.auth.uid
    
    # Get document info from Firestore
    db = firestore.client()
    doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
    doc = doc_ref.get()
    
    if doc.exists:
        doc_data = doc.to_dict()
        return {"success": True, "data": doc_data}
    
    return {
        "success": False,
        "message": "Document not found"
    }
