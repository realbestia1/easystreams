FROM node:18-slim

# 1. Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    iproute2 \
    python3 \
    python3-pip \
    python3-venv \
    chromium \
    chromium-driver \
    xauth \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    gnupg2 \
    lsb-release \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Prefer IPv4 when both A and AAAA records are available.
RUN printf 'precedence ::ffff:0:0/96  100\n' >> /etc/gai.conf

# 1.5 Install Cloudflare Warp
RUN curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/cloudflare-client.list && \
    apt-get update && apt-get install -y cloudflare-warp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

# 2. Setup FlareSolverr from source and PATCH IT
RUN git clone https://github.com/FlareSolverr/FlareSolverr.git /app/flaresolverr-src && \
    cd /app/flaresolverr-src && \
    # Patch 1: Force system chromedriver path
    sed -i 's/driver_executable_path=driver_exe_path/driver_executable_path="\/usr\/bin\/chromedriver"/' src/utils.py && \
    # Patch 2: Add headless flags and optimizations
    sed -i "s|options.add_argument('--no-sandbox')|options.add_argument('--no-sandbox'); options.add_argument('--disable-dev-shm-usage'); options.add_argument('--disable-gpu'); options.add_argument('--disable-ipv6'); options.add_argument('--headless=new')|" src/utils.py && \
    # Patch 3: Disable Xvfb by replacing start_xvfb_display() with pass
    sed -i "s|^\([[:space:]]*\)start_xvfb_display()|\1pass|g" src/utils.py && \
    pip3 install --no-cache-dir -r requirements.txt --break-system-packages && \
    cd /app && \
    # Install main project Python dependencies
    pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# 3. Environment Settings
ENV NODE_ENV=production
ENV IN_DOCKER=true
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# 4. Copy Node.js files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Ensure entrypoint is executable
RUN chmod +x entrypoint.sh

EXPOSE 7000

# Use the entrypoint script to start everything
CMD ["./entrypoint.sh"]
