FROM ubuntu:24.04

# System packages: PHP CLI powers the built-in dev server that serves index.php,
# git/curl are needed for source checkout and health checks.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        php-cli \
    && rm -rf /var/lib/apt/lists/*

# Cloud Agents run commands as the `ubuntu` user. The noble base image already
# ships one at uid 1000; guard the creation so the image stays reproducible.
RUN if ! id ubuntu >/dev/null 2>&1; then useradd -m -s /bin/bash ubuntu; fi

USER ubuntu
WORKDIR /home/ubuntu
