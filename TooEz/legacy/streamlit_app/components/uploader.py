import requests
import streamlit as st

API_URL = "http://127.0.0.1:8000/api/process_pdf"

def upload_pdf(file):
    response = requests.post(
        API_URL,
        files={"file": file},
        data={
            "user_email": st.session_state.user_email
        }
    )
    return response
