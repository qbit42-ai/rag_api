FROM ghcr.io/astral-sh/uv:python3.10-bookworm AS main

WORKDIR /app

ENV TINI_VERSION=v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini

# Install pandoc and netcat
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    pandoc \
    netcat-openbsd \
    libgl1 \
    libglib2.0-0 \
    curl jq \
    && rm -rf /var/lib/apt/lists/* && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws

COPY requirements.lite.txt ./requirements.txt
RUN uv pip install --system -r requirements.txt

# Download standard NLTK data, to prevent unstructured from downloading packages at runtime
RUN python -m nltk.downloader -d /app/nltk_data punkt_tab averaged_perceptron_tagger
ENV NLTK_DATA=/app/nltk_data

# Disable Unstructured analytics
ENV SCARF_NO_ANALYTICS=true

COPY . .

COPY ./container/tools /root/tools
RUN chmod +x /root/tools/entrypoint.sh

# we need additional config when the container starts, so we will execute our own script
ENTRYPOINT ["/tini", "--", "/root/tools/entrypoint.sh"]
    
CMD ["python", "main.py"]
