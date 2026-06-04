# TechBolt

## How to Run the Project

---

## 1. Clone the Repository

```bash
git clone <your-github-repo-link>
cd Dev_Clash
```

---

## 2. Setup Backend

### Move to Backend Folder

```bash
cd Backend
```

### Create Virtual Environment

```bash
python -m venv venv
```

### Activate Virtual Environment

#### Windows

```bash
venv\Scripts\activate
```

#### Mac/Linux

```bash
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 3. Create `.env` File

Inside the `Backend` folder, create a file named:

```bash
.env
```

Add:

```env
HF_TOKEN=your_huggingface_token
```

---

## 4. Run Backend Server

```bash
uvicorn app.main:app --reload
```

Backend will run on:

```bash
http://127.0.0.1:8000
```

---

## 5. Run Frontend

Open the `Frontend` folder.

Run `index.html` using:

- VS Code Live Server extension

OR

- Open `index.html` directly in browser

---

## 6. API Documentation

After running backend, open:

```bash
http://127.0.0.1:8000/docs
```

to access FastAPI Swagger UI.

---
