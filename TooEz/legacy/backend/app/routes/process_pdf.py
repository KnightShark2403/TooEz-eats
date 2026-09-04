from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Header
from pathlib import Path
import tempfile
import os

from app.services.pdf_parser import process_pdf_pipeline
from app.core.supabase import supabase

router = APIRouter()

# -------------------------
# POST: Process PDF
# -------------------------
@router.post("/process_pdf")
async def process_pdf(
    file: UploadFile = File(...),
    user_email: str = Form(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files supported")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        pdf_path = Path(tmp.name)

    try:
        result = process_pdf_pipeline(pdf_path)
    finally:
        os.remove(pdf_path)

    supabase.table("documents").insert({
        "user_email": user_email,
        "filename": file.filename,
        "result": result
    }).execute()

    return result


# -------------------------
# GET: List documents
# -------------------------
@router.get("/documents")
def list_documents(user_email: str = Header(...)):
    response = (
        supabase
        .table("documents")
        .select("id, filename, created_at")
        .eq("user_email", user_email)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


# -------------------------
# GET: Single document
# -------------------------
@router.get("/documents/{doc_id}")
def get_document(doc_id: str, user_email: str = Header(...)):
    response = (
        supabase
        .table("documents")
        .select("id, filename, result, created_at")
        .eq("id", doc_id)
        .eq("user_email", user_email)
        .single()
        .execute()
    )
    return response.data
