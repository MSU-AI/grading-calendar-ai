import os
import firebase_admin
from firebase_admin import credentials, storage
import tempfile
from google.cloud import vision
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_vision_api_with_local_pdf(pdf_path):
    """
    Test the Vision API with a local PDF file.
    This function doesn't use Firebase and directly calls the Vision API.
    """
    try:
        # Set up Vision API client
        vision_client = vision.ImageAnnotatorClient()
        
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
        logger.info(full_text[:500])
        
        return full_text
    
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        raise e

def test_with_firebase_storage(service_account_path, project_id, pdf_path):
    """
    Test uploading a PDF to Firebase Storage and extracting text.
    This simulates the full flow of your app.
    """
    try:
        # Initialize Firebase with service account
        cred = credentials.Certificate(service_account_path)
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
        
        # Extract text using Vision API
        text = test_vision_api_with_local_pdf(temp_local_filename)
        
        # Clean up
        os.remove(temp_local_filename)
        
        # Delete the test file from Firebase Storage
        blob.delete()
        logger.info(f"Deleted test file from Firebase Storage")
        
        return text
    
    except Exception as e:
        logger.error(f"Error testing with Firebase Storage: {str(e)}")
        raise e

if __name__ == "__main__":
    # Path to a sample PDF file
    sample_pdf_path = "sample.pdf"  # Replace with your sample PDF
    
    # Test direct Vision API
    logger.info("Testing Vision API directly...")
    text1 = test_vision_api_with_local_pdf(sample_pdf_path)
    
    # Uncomment to test with Firebase Storage
    """
    # Path to your Firebase service account key
    service_account_path = "path/to/your/serviceAccountKey.json"
    
    # Your Firebase project ID
    project_id = "your-project-id"
    
    logger.info("Testing with Firebase Storage...")
    text2 = test_with_firebase_storage(service_account_path, project_id, sample_pdf_path)
    """
