import os
import tempfile
import logging
import json
import uuid
from google.cloud import vision
from google.oauth2 import service_account
import firebase_admin
from firebase_admin import credentials, storage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path to your service account key file
CREDENTIALS_PATH = "/Users/laithassaf/Documents/grading-calender-ai/grading-calendar-ai/gradingai-firebase-adminsdk-fbsvc-9096e03046.json"
PROJECT_ID = "gradingai"  # Your Firebase project ID

def test_vision_api_with_firebase_storage(pdf_path):
    """
    Test the Vision API using Firebase Storage (which is built on GCS).
    """
    try:
        # Initialize Firebase if not already initialized
        try:
            app = firebase_admin.get_app()
            logger.info("Firebase app already initialized")
        except ValueError:
            cred = credentials.Certificate(CREDENTIALS_PATH)
            app = firebase_admin.initialize_app(cred, {
                'projectId': PROJECT_ID,
                'storageBucket': f"{PROJECT_ID}.appspot.com"
            })
            logger.info("Firebase app initialized")
        
        # Get default bucket name from app config
        bucket_name = app.options.get('storageBucket')
        logger.info(f"Using bucket name: {bucket_name}")
        
        # List all available buckets to verify
        storage_client = storage.storage.Client.from_service_account_json(CREDENTIALS_PATH)
        buckets = list(storage_client.list_buckets())
        logger.info(f"Available buckets: {[b.name for b in buckets]}")
        
        # Try to get the bucket by correct name
        if buckets:
            # Use the first bucket if available
            bucket_name = buckets[0].name
            logger.info(f"Using first available bucket: {bucket_name}")
            
            # Initialize the bucket
            bucket = storage_client.bucket(bucket_name)
        else:
            logger.error("No buckets found in the project")
            return None
        
        # Generate a unique file path
        unique_filename = f"test/vision_test_{uuid.uuid4()}.pdf"
        blob = bucket.blob(unique_filename)
        
        logger.info(f"Uploading PDF to Firebase Storage: {unique_filename}")
        blob.upload_from_filename(pdf_path)
        
        # Get the GCS URI for the file
        gcs_uri = f"gs://{bucket.name}/{unique_filename}"
        logger.info(f"File uploaded to: {gcs_uri}")
        
        # Initialize Vision API client with credentials
        credentials_obj = service_account.Credentials.from_service_account_file(
            CREDENTIALS_PATH,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        vision_client = vision.ImageAnnotatorClient(credentials=credentials_obj)
        
        # Configure input
        gcs_source = vision.GcsSource(uri=gcs_uri)
        input_config = vision.InputConfig(
            gcs_source=gcs_source,
            mime_type="application/pdf"
        )
        
        # Configure output
        output_filename = f"test/vision_output_{uuid.uuid4()}"
        gcs_destination = vision.GcsDestination(uri=f"gs://{bucket.name}/{output_filename}")
        output_config = vision.OutputConfig(
            gcs_destination=gcs_destination,
            batch_size=1
        )
        
        # Configure feature
        feature = vision.Feature(
            type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION
        )
        
        # Create request
        request = vision.AsyncAnnotateFileRequest(
            features=[feature],
            input_config=input_config,
            output_config=output_config
        )
        
        logger.info("Sending request to Vision API...")
        
        # Make the request
        operation = vision_client.async_batch_annotate_files(requests=[request])
        logger.info("Waiting for operation to complete...")
        operation.result(timeout=300)  # Wait up to 5 minutes
        
        logger.info("Vision API request completed")
        
        # Check for output files
        output_prefix = f"{output_filename}/output-"
        blobs = list(bucket.list_blobs(prefix=output_prefix))
        
        logger.info(f"Found {len(blobs)} output files")
        
        # Extract text from all output files
        full_text = ""
        for output_blob in blobs:
            # Download to a temporary file
            _, temp_filename = tempfile.mkstemp(suffix=".json")
            output_blob.download_to_filename(temp_filename)
            
            # Parse the JSON
            with open(temp_filename, 'r') as f:
                content = json.load(f)
            
            # Extract the text
            if 'responses' in content:
                for response in content['responses']:
                    if 'fullTextAnnotation' in response:
                        full_text += response['fullTextAnnotation']['text'] + "\n"
            
            # Clean up temp file
            os.remove(temp_filename)
            
            # Clean up output blob
            output_blob.delete()
        
        # Clean up the original PDF
        blob.delete()
        
        logger.info(f"Extracted {len(full_text)} characters from PDF")
        
        # Print the first 500 characters
        if full_text:
            logger.info("First 500 characters of extracted text:")
            logger.info(full_text[:500])
        else:
            logger.info("No text was extracted")
        
        return full_text
    
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        raise e

if __name__ == "__main__":
    # Path to your sample PDF file
    sample_pdf_path = "/Users/laithassaf/Downloads/SSR_TSRPT (1).pdf"
    
    # Verify the file exists
    if not os.path.exists(sample_pdf_path):
        logger.error(f"PDF file not found at: {sample_pdf_path}")
    else:
        logger.info(f"PDF file found: {sample_pdf_path}")
        
        # Test Vision API with Firebase Storage
        logger.info("Testing Vision API with Firebase Storage...")
        text = test_vision_api_with_firebase_storage(sample_pdf_path)