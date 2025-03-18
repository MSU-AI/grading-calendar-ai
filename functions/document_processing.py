from firebase_functions import https_fn
from firebase_admin import firestore, storage
import google.cloud.firestore
import tempfile
import os
import uuid
import json
from datetime import datetime

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
            import base64
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

@https_fn.on_call()
def get_document_status(req: https_fn.CallableRequest) -> dict:
    """
    Get the status of a document upload and processing.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    document_id = req.data.get("documentId")
    
    if not document_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Document ID is required"
        )
    
    try:
        # Get document status from Firestore
        db = firestore.client()
        doc_ref = db.collection("users").document(user_id).collection("document_uploads").document(document_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Document not found"
            )
        
        doc_data = doc.to_dict()
        
        # Check if document has been processed
        document_type = doc_data.get("documentType")
        if document_type:
            processed_doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
            processed_doc = processed_doc_ref.get()
            
            if processed_doc.exists:
                processed_data = processed_doc.to_dict()
                if processed_data.get("filePath") == doc_data.get("filePath"):
                    doc_data["status"] = "processed"
                    
                    # Update status in Firestore
                    doc_ref.update({"status": "processed"})
        
        return {
            "success": True,
            "document": doc_data
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error getting document status: {str(e)}"
        )

@https_fn.on_call()
def get_user_documents(req: https_fn.CallableRequest) -> dict:
    """
    Get all documents uploaded by a user.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    try:
        # Get documents from Firestore
        db = firestore.client()
        docs = db.collection("users").document(user_id).collection("document_uploads").order_by("uploadedAt", direction=firestore.Query.DESCENDING).stream()
        
        documents = []
        for doc in docs:
            doc_data = doc.to_dict()
            doc_data["id"] = doc.id
            documents.append(doc_data)
        
        return {
            "success": True,
            "documents": documents
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error getting user documents: {str(e)}"
        )
