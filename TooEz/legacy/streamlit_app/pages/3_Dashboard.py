import streamlit as st
import requests
import json

API_BASE = "http://127.0.0.1:8000/api"

st.title("Processed Documents")

try:
    docs = requests.get(f"{API_BASE}/documents").json()
except Exception as e:
    st.error(f"Failed to load documents: {e}")
    st.stop()

if not docs:
    st.info("No documents processed yet.")
    st.stop()

doc_map = {
    f"{d['filename']} ({d['created_at']})": d["id"]
    for d in docs
}

selected = st.selectbox("Select a document", list(doc_map.keys()))

doc_id = doc_map[selected]

try:
    doc = requests.get(f"{API_BASE}/documents/{doc_id}").json()
except Exception as e:
    st.error(f"Failed to load document: {e}")
    st.stop()

st.subheader("Extracted Result")
st.json(doc["result"])
