from firebase_functions import https_fn, storage_fn
from firebase_admin import firestore, storage
import google.cloud.firestore
from google.cloud import vision
import tempfile
import os
import io
import re
import json
import logging

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
        
        # Get bucket name from file path
        bucket_name = storage.bucket().name
        
        # Set up Vision API client
        vision_client = vision.ImageAnnotatorClient()
        
        # Source and destination URIs
        gcs_source_uri = f"gs://{bucket_name}/{file_path}"
        gcs_destination_uri = f"gs://{bucket_name}/vision-results/{user_id}/{document_type}/"
        
        logger.info(f"Processing PDF from {gcs_source_uri}")
        
        # Configure the batch request
        gcs_source = vision.GcsSource(uri=gcs_source_uri)
        input_config = vision.InputConfig(gcs_source=gcs_source, mime_type="application/pdf")
        
        gcs_destination = vision.GcsDestination(uri=gcs_destination_uri)
        output_config = vision.OutputConfig(gcs_destination=gcs_destination, batch_size=1)
        
        # Configure the feature we want to use (document text detection)
        feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
        
        # Create the async request
        async_request = vision.AsyncAnnotateFileRequest(
            features=[feature], 
            input_config=input_config,
            output_config=output_config
        )
        
        # Make the async batch request
        operation = vision_client.async_batch_annotate_files(requests=[async_request])
        logger.info("Waiting for the Vision API operation to complete...")
        
        # Wait for the operation to complete (timeout after 5 minutes)
        operation.result(timeout=300)
        logger.info("Vision API operation completed")
        
        # Get the results
        storage_client = storage.Client()
        
        # Parse the destination URI to get bucket and prefix
        match = re.match(r"gs://([^/]+)/(.+)", gcs_destination_uri)
        result_bucket_name = match.group(1)
        prefix = match.group(2)
        
        # List the result files
        bucket = storage_client.get_bucket(result_bucket_name)
        blobs = list(bucket.list_blobs(prefix=prefix))
        result_files = [blob for blob in blobs if not blob.name.endswith("/")]
        
        if not result_files:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message="No result files found from Vision API"
            )
        
        # Get the first result file
        output = result_files[0]
        json_string = output.download_as_bytes().decode("utf-8")
        result = json.loads(json_string)
        
        # Extract text from all pages
        full_text = ""
        for page_response in result.get("responses", []):
            if "fullTextAnnotation" in page_response:
                full_text += page_response["fullTextAnnotation"]["text"] + "\n"
        
        logger.info(f"Extracted {len(full_text)} characters of text")
        
        # Update document in Firestore with extracted text
        doc_ref.update({
            "text": full_text,
            "lastExtracted": firestore.SERVER_TIMESTAMP,
            "status": "processed"
        })
        
        # Clean up the result files
        for blob in result_files:
            blob.delete()
            logger.info(f"Deleted result file: {blob.name}")
        
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
