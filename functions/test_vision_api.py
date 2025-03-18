import os
import tempfile
import logging
from google.cloud import vision
from google.oauth2 import service_account
import firebase_admin
from firebase_admin import credentials, storage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path to your service account key file
# Replace this with the actual path to your downloaded service account key
CREDENTIALS_PATH = "path/to/your-service-account-key.json"

def test_vision_api_with_local_pdf(pdf_path):
    """
    Test the Vision API with a local PDF file.
    This function doesn't use Firebase and directly calls the Vision API.
    """
    try:
        # Set up credentials
        credentials = service_account.Credentials.from_service_account_file(
            CREDENTIALS_PATH,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        
        # Set up Vision API client with explicit credentials
        vision_client = vision.ImageAnnotatorClient(credentials=credentials)
        
        logger.info(f"Reading PDF file: {pdf_path}")
        
        # Read the PDF file
        with open(pdf_path, "rb") as pdf_file:
            content = pdf_file.read()
        
        # Configure input
        input_config = vision.InputConfig(
            content=content,
            mime_type="application/pdf"
        )
        
        # Configure feature
        feature = vision.Feature(
            type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION
        )
        
        # Configure output
        output_config = vision.OutputConfig(
            batch_size=1  # Process one page at a time
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
        result = operation.result(timeout=180)  # Wait up to 3 minutes
        
        logger.info("Vision API request completed")
        
        # Extract text from all pages
        full_text = ""
        for response in result.responses:
            for page in response.pages:
                full_text += page.full_text_annotation.text + "\n"
        
        logger.info(f"Extracted {len(full_text)} characters from PDF")
        
        # Print the first 500 characters of the extracted text
        logger.info(f"First 500 characters of extracted text:")
        logger.info(full_text[:500] if len(full_text) > 0 else "No text extracted")
        
        return full_text
    
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        raise e

def test_with_firebase_storage(project_id, pdf_path):
    """
    Test uploading a PDF to Firebase Storage and extracting text.
    This simulates the full flow of your app.
    """
    try:
        # Check if Firebase app is already initialized
        try:
            firebase_admin.get_app()
        except ValueError:
            # Initialize Firebase with service account
            cred = credentials.Certificate(CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred, {
                'projectId': project_id,
                'storageBucket': f"{project_id}.appspot.com"
            })
        
        # Upload PDF to Firebase Storage
        bucket = storage.bucket()
        test_file_path = f"test/sample_pdf_{os.path.basename(pdf_path)}"
        blob = bucket.blob(test_file_path)
        blob.upload_from_filename(pdf_path)
        
        logger.info(f"Uploaded PDF to Firebase Storage: {test_file_path}")
        
        # Download the PDF from Firebase Storage
        _, temp_local_filename = tempfile.mkstemp(suffix=".pdf")
        blob.download_to_filename(temp_local_filename)
        
        logger.info(f"Downloaded PDF to {temp_local_filename}")
        
        # Set up credentials (same as in test_vision_api_with_local_pdf)
        credentials_obj = service_account.Credentials.from_service_account_file(
            CREDENTIALS_PATH,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        
        # Set up Vision API client with explicit credentials
        vision_client = vision.ImageAnnotatorClient(credentials=credentials_obj)
        
        # Read the PDF file
        with open(temp_local_filename, "rb") as pdf_file:
            content = pdf_file.read()
        
        # Configure input
        input_config = vision.InputConfig(
            content=content,
            mime_type="application/pdf"
        )
        
        # Configure feature
        feature = vision.Feature(
            type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION
        )
        
        # Configure output
        output_config = vision.OutputConfig(
            batch_size=1  # Process one page at a time
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
        result = operation.result(timeout=180)  # Wait up to 3 minutes
        
        logger.info("Vision API request completed")
        
        # Extract text from all pages
        full_text = ""
        for response in result.responses:
            for page in response.pages:
                full_text += page.full_text_annotation.text + "\n"
        
        logger.info(f"Extracted {len(full_text)} characters from PDF")
        
        # Clean up
        os.remove(temp_local_filename)
        
        # Delete the test file from Firebase Storage
        blob.delete()
        logger.info(f"Deleted test file from Firebase Storage")
        
        return full_text
    
    except Exception as e:
        logger.error(f"Error testing with Firebase Storage: {str(e)}")
        raise e

if __name__ == "__main__":
    # Path to your sample PDF file - update this to your local syllabus path
    sample_pdf_path = "D:/Programs/ai-grading/grading-calendar-ai/backend/P_Cubed_Syllabus_SPRING2025.pdf"
    
    # Verify the file exists
    if not os.path.exists(sample_pdf_path):
        logger.error(f"PDF file not found at: {sample_pdf_path}")
    else:
        logger.info(f"PDF file found: {sample_pdf_path}")
        
        # Test direct Vision API
        logger.info("Testing Vision API directly...")
        text1 = test_vision_api_with_local_pdf(sample_pdf_path)
        
        # If you want to test with Firebase Storage, uncomment this section
        # and replace with your project ID
        """
        # Your Firebase project ID
        project_id = "gradingai"
        
        logger.info("Testing with Firebase Storage...")
        text2 = test_with_firebase_storage(project_id, sample_pdf_path)
        """