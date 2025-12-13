FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir flask
COPY server.py /app/server.py
EXPOSE 8787
CMD ["python", "/app/server.py"]
