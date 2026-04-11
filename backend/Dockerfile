FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY backend/ ./backend/
COPY master_data/ ./master_data/
COPY visualizations/ ./visualizations/
COPY report.txt ./report.txt

# Copy saved model artifacts if they exist
COPY backend/ml/saved_model/ ./backend/ml/saved_model/

# Copy NLP data if it exists
COPY backend/nlp/news_data/ ./backend/nlp/news_data/

ENV PYTHONPATH=/app
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
