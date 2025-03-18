from firebase_functions import https_fn
from firebase_admin import firestore, storage
import google.cloud.firestore
import tempfile
import os
import uuid
import base64

@https_fn.on_call()
def upload_and_process_document(req: https_fn.CallableRequest) -> dict:
    """
    Upload and process a document (syllabus or transcript).
    This function combines the storage and OCR functionality.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    document_type = req.data.get("documentType")
    document_base64 = req.data.get("documentBase64")
    
    if not document_type or document_type not in ["syllabus", "transcript"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Valid document type (syllabus or transcript) is required"
        )
    
    if not document_base64:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Document data is required"
        )
    
    try:
        # Generate a unique filename
        filename = f"{uuid.uuid4()}.pdf"
        file_path = f"users/{user_id}/{document_type}/{filename}"
        
        # Upload document to Firebase Storage
        bucket = storage.bucket()
        blob = bucket.blob(file_path)
        
        # Write base64 data to a temporary file
        _, temp_local_filename = tempfile.mkstemp(suffix=".pdf")
        with open(temp_local_filename, "wb") as f:
            f.write(base64.b64decode(document_base64.split(",")[1] if "," in document_base64 else document_base64))
        
        # Upload the file to Firebase Storage
        blob.upload_from_filename(temp_local_filename)
        
        # Clean up temp file
        os.remove(temp_local_filename)
        
        # Store document metadata in Firestore
        db = firestore.client()
        doc_ref = db.collection("users").document(user_id).collection("document_uploads").document()
        
        doc_data = {
            "filePath": file_path,
            "documentType": document_type,
            "uploadedAt": firestore.SERVER_TIMESTAMP,
            "status": "uploaded"
        }
        
        doc_ref.set(doc_data)
        
        return {
            "success": True,
            "documentId": doc_ref.id,
            "filePath": file_path,
            "message": f"{document_type.capitalize()} uploaded successfully. Processing will begin automatically."
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error uploading document: {str(e)}"
        )
