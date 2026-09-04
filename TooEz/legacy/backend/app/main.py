from dotenv import load_dotenv
load_dotenv()

import os
print("DEBUG SUPABASE_URL:", os.getenv("SUPABASE_URL"))
print("DEBUG SUPABASE_SERVICE_KEY:", bool(os.getenv("SUPABASE_SERVICE_KEY")))

from fastapi import FastAPI
from app.routes.process_pdf import router as process_pdf_router

app = FastAPI(title="TooEZ Backend")

# Register routes
app.include_router(
    process_pdf_router,
    prefix="/api",
    tags=["PDF Processing"]
)

@app.get("/")
def health():
    return {"status": "ok"}
