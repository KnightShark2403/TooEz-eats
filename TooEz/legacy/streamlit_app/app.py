import streamlit as st
import requests

# ---------------- CONFIG ----------------
API_BASE = "http://127.0.0.1:8000/api"
PROCESS_URL = f"{API_BASE}/process_pdf"
DOCS_URL = f"{API_BASE}/documents"

st.set_page_config(
    page_title="TooEz – PDF Processor",
    layout="wide"
)

# ---------------- SESSION STATE ----------------
if "user_email" not in st.session_state:
    st.session_state.user_email = None

# ---------------- LOGIN ----------------
st.sidebar.title("Login")

email_input = st.sidebar.text_input(
    "Email",
    value=st.session_state.user_email or ""
)

if st.sidebar.button("Login"):
    if not email_input:
        st.sidebar.error("Email is required")
    else:
        st.session_state.user_email = email_input
        st.sidebar.success("Logged in")
        st.rerun()

if not st.session_state.user_email:
    st.title("Please log in to continue")
    st.stop()

# ---------------- MAIN UI ----------------
st.title("TooEz – Persona-based PDF Processor")
st.caption(f"Logged in as: {st.session_state.user_email}")

headers = {
    "user-email": st.session_state.user_email
}

# ---------------- UPLOAD PDF ----------------
st.subheader("Upload PDF")

uploaded_file = st.file_uploader(
    "Choose a PDF file",
    type=["pdf"]
)

if uploaded_file:
    if st.button("Process PDF"):
        with st.spinner("Processing PDF..."):
            try:
                response = requests.post(
                    PROCESS_URL,
                    files={"file": uploaded_file},
                    data={"user_email": st.session_state.user_email},
                    timeout=300
                )
            except Exception as e:
                st.error(f"Backend connection failed: {e}")
                st.stop()

        if response.status_code == 200:
            st.success("PDF processed successfully")
            st.json(response.json())
        else:
            st.error("Backend returned an error")
            st.json(response.json())

# ---------------- DOCUMENT HISTORY ----------------
st.divider()
st.subheader("Your Documents")

try:
    docs_response = requests.get(
        DOCS_URL,
        headers=headers,
        timeout=60
    )
    docs = docs_response.json()
except Exception as e:
    st.error(f"Failed to fetch documents: {e}")
    st.stop()

if not docs:
    st.info("No documents found for this user.")
    st.stop()

# Defensive check
if not isinstance(docs, list):
    st.error("Backend did not return a document list")
    st.json(docs)
    st.stop()

if not docs:
    st.info("No documents found for this user.")
    st.stop()

doc_map = {}
for d in docs:
    if not isinstance(d, dict):
        continue
    label = f"{d.get('filename', 'unknown')} | {d.get('created_at', '')}"
    doc_map[label] = d.get("id")


selected_label = st.selectbox(
    "Select a document",
    list(doc_map.keys())
)

selected_doc_id = doc_map[selected_label]

# ---------------- VIEW DOCUMENT ----------------
try:
    doc_response = requests.get(
        f"{DOCS_URL}/{selected_doc_id}",
        headers=headers,
        timeout=60
    )
    doc = doc_response.json()
except Exception as e:
    st.error(f"Failed to fetch document: {e}")
    st.stop()

st.subheader("Extracted Content")
st.json(doc.get("result", {}))

# ---------------- LOGOUT ----------------
st.sidebar.divider()
if st.sidebar.button("Logout"):
    st.session_state.user_email = None
    st.rerun()
