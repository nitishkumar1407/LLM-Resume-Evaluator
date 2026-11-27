# TalentLens — LLM Resume Evaluator

A small full-stack resume evaluation app using HTML, CSS, JavaScript, FastAPI, Pydantic, PyMuPDF alternatives (`pypdf` / `python-docx`) and Groq.

## Project structure

```text
llm_resume_evaluator/
├── app.py
├── .gitignore
├── requirements.txt
└── frontend/
    ├── index.html
    ├── styles.css
    └── app.js
```

## 1. Set up the backend

Use Python 3.11+ (the code uses modern type annotations).

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `.env` in the project root:

```env
GROQ_API_KEY=your_actual_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
```

Never commit `.env`.

## 2. Start FastAPI

From the project root:

```bash
uvicorn app:app --reload
```

The API runs at `http://127.0.0.1:8000`. API health check: `http://127.0.0.1:8000/api/health`.

## 3. Open the frontend

Open `frontend/index.html` in your browser, or serve the frontend folder:

```bash
python -m http.server 5500 --directory frontend
```

Then visit `http://127.0.0.1:5500`.

## How it works

1. The browser sends the job description and multiple PDF/DOCX files to `POST /api/analyze`.
2. FastAPI extracts the job requirements with Groq.
3. Each resume is parsed and validated with Pydantic.
4. The model compares each candidate against the job profile and returns a score plus explanation.
5. The backend sorts results and returns all candidates, top two, bottom two and per-file errors.
6. The frontend renders the leaderboard, role snapshot, candidate details and CSV export.

## Notes and limitations

- Processing is sequential to reduce burst rate-limit pressure. The backend retries Groq rate-limit errors with a short exponential delay.
- A batch can contain up to 50 files; each file is limited to 10 MB.
- Scanned/image-only PDFs need OCR; this starter app reports when no text can be extracted.
- Scores are model-generated estimates, not objective measures or hiring decisions. Review evidence and keep a human decision-maker in the loop.
- This starter stores no uploaded resumes in a database; files are processed in memory for the request.
- Before deployment, restrict CORS, add authentication, enforce upload and request limits, add logging, and define retention/deletion policies.
- Do not use protected or sensitive personal characteristics in evaluation.
