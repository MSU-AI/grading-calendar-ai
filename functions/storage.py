from firebase_functions import https_fn
from firebase_admin import storage
import google.cloud.storage
import tempfile
import os
import uuid

@https_fn.on_call()
def get_upload_url(req: https_fn.CallableRequest) -> dict:
    """
    Generate a signed URL for uploading a PDF to Firebase Storage.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    document_type = req.data.get("documentType")
    
    if not document_type or document_type not in ["syllabus", "transcript"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Valid document type (syllabus or transcript) is required"
        )
    
    # Generate a unique filename
    filename = f"{uuid.uuid4()}.pdf"
    file_path = f"users/{user_id}/{document_type}/{filename}"
    
    # Generate signed URL
    bucket = storage.bucket()
    blob = bucket.blob(file_path)
    
    # URL expires in 15 minutes
    url = blob.generate_signed_url(
        version="v4",
        expiration=60 * 15,
        method="PUT",
        content_type="application/pdf"
    )
    
    return {
        "url": url,
        "filePath": file_path
    }
