FROM python:3.11-slim

WORKDIR /srv

COPY packages/core_py /srv/packages/core_py
COPY apps/worker/requirements.txt /srv/apps/worker/requirements.txt
RUN cd /srv/apps/worker && pip install --no-cache-dir -r requirements.txt

COPY apps/worker /srv/apps/worker
WORKDIR /srv/apps/worker

CMD ["python", "worker.py"]
