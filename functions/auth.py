from firebase_functions import https_fn
from firebase_admin import firestore, auth
import google.cloud.firestore
import json

@https_fn.on_call()
def create_user_profile(req: https_fn.CallableRequest) -> dict:
    """
    Callable function to create a user profile.
    Called after user registration.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    try:
        # Get user data from Firebase Auth
        user = auth.get_user(req.auth.uid)
        
        # Create user profile in Firestore
        firestore_client: google.cloud.firestore.Client = firestore.client()
        user_ref = firestore_client.collection('users').document(user.uid)
        
        user_data = {
            'displayName': user.display_name or '',
            'email': user.email,
            'photoURL': user.photo_url or '',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'lastLogin': firestore.SERVER_TIMESTAMP,
            'role': 'student',  # Default role
            'courses': []  # Empty list of courses initially
        }
        
        user_ref.set(user_data)
        
        return {"success": True, "message": "User profile created successfully"}
        
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error creating user profile: {str(e)}"
        )

@https_fn.on_call()
def delete_user_data(req: https_fn.CallableRequest) -> dict:
    """
    Callable function to delete a user's data.
    Called before deleting a user account.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    try:
        # Delete user profile from Firestore
        firestore_client: google.cloud.firestore.Client = firestore.client()
        user_ref = firestore_client.collection('users').document(req.auth.uid)
        
        # Delete the user document
        user_ref.delete()
        
        return {"success": True, "message": "User data deleted successfully"}
        
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error deleting user data: {str(e)}"
        )

@https_fn.on_request()
def get_user_profile(req: https_fn.Request) -> https_fn.Response:
    """
    Get a user's profile data from Firestore.
    Requires authentication token in Authorization header.
    """
    # Check if request has authorization header
    if not req.headers.get('Authorization'):
        return https_fn.Response(
            json.dumps({'error': 'No authorization token provided'}),
            status=401,
            headers={'Content-Type': 'application/json'}
        )
    
    try:
        # Verify the Firebase ID token
        id_token = req.headers['Authorization'].split('Bearer ')[1]
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        
        # Get user profile from Firestore
        firestore_client: google.cloud.firestore.Client = firestore.client()
        user_doc = firestore_client.collection('users').document(uid).get()
        
        if not user_doc.exists:
            return https_fn.Response(
                json.dumps({'error': 'User profile not found'}),
                status=404,
                headers={'Content-Type': 'application/json'}
            )
        
        # Update last login time
        user_doc.reference.update({
            'lastLogin': firestore.SERVER_TIMESTAMP
        })
        
        # Return user profile data
        return https_fn.Response(
            json.dumps(user_doc.to_dict(), default=str),
            headers={'Content-Type': 'application/json'}
        )
        
    except Exception as e:
        return https_fn.Response(
            json.dumps({'error': str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

@https_fn.on_request()
def update_user_profile(req: https_fn.Request) -> https_fn.Response:
    """
    Update a user's profile data in Firestore.
    Requires authentication token in Authorization header.
    """
    # Check if request has authorization header
    if not req.headers.get('Authorization'):
        return https_fn.Response(
            json.dumps({'error': 'No authorization token provided'}),
            status=401,
            headers={'Content-Type': 'application/json'}
        )
    
    try:
        # Verify the Firebase ID token
        id_token = req.headers['Authorization'].split('Bearer ')[1]
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        
        # Get update data from request body
        try:
            update_data = json.loads(req.data.decode())
        except json.JSONDecodeError:
            return https_fn.Response(
                json.dumps({'error': 'Invalid JSON in request body'}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        # Remove any fields that shouldn't be updated by users
        protected_fields = ['email', 'createdAt', 'role']
        for field in protected_fields:
            update_data.pop(field, None)
        
        # Update user profile in Firestore
        firestore_client: google.cloud.firestore.Client = firestore.client()
        user_ref = firestore_client.collection('users').document(uid)
        user_ref.update(update_data)
        
        # Get and return updated profile
        updated_profile = user_ref.get()
        return https_fn.Response(
            json.dumps(updated_profile.to_dict(), default=str),
            headers={'Content-Type': 'application/json'}
        )
        
    except Exception as e:
        return https_fn.Response(
            json.dumps({'error': str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )
