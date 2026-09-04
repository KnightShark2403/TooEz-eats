import streamlit as st
from streamlit_app.lib.supabase_client import supabase
from streamlit_app.components.uploader import upload_pdf

st.title("📚 Subject Setup")

# TEMP IDs just to test pipeline
student_id = "TEST_STUDENT_ID"

subject = st.text_input("Subject name")
pdf = st.file_uploader("Upload notes (PDF)", type=["pdf"])

if st.button("Process Notes") and pdf:
    subject_row = supabase.table("subjects").insert({
        "student_id": student_id,
        "subject_name": subject
    }).execute()

    subject_id = subject_row.data[0]["id"]

    upload_pdf(student_id, subject_id, pdf)
    st.success("PDF processed and sent to backend ✅")
