from firebase_functions import https_fn
from firebase_admin import initialize_app
from auth import (
    create_user_profile,
    delete_user_data,
    get_user_profile,
    update_user_profile
)

# Initialize Firebase app
initialize_app()

# Re-export authentication functions
__all__ = [
    'create_user_profile',
    'delete_user_data',
    'get_user_profile',
    'update_user_profile'
]
