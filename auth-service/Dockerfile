FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Dependencias base para Django + DRF + JWT
RUN pip install --no-cache-dir \
    django \
    djangorestframework \
    djangorestframework-simplejwt \
    django-cors-headers \
    gunicorn

COPY . /app

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:8000"]
