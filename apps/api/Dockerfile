FROM python:3.11-slim

WORKDIR /srv

# Shared domain package first, so Docker's layer cache survives changes to
# apps/api that don't touch packages/core_py.
COPY packages/core_py /srv/packages/core_py
COPY apps/api/requirements.txt /srv/apps/api/requirements.txt
RUN cd /srv/apps/api && pip install --no-cache-dir -r requirements.txt

COPY apps/api /srv/apps/api
WORKDIR /srv/apps/api

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
