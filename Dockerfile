FROM node:18-slim

# Install system dependencies for FlareSolverr and Chromium
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    tar \
    xvfb \
    # FlareSolverr/Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    fonts-liberation \
    libv4l-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable productions optimizations
ENV NODE_ENV=production
ENV IN_DOCKER=true

# FlareSolverr environment variables
ENV HEADLESS=true
ENV BROWSER_TIMEOUT=60000
ENV DISPLAY=:99

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

EXPOSE 7000

# Start Xvfb and then the addon
CMD Xvfb :99 -screen 0 1024x768x16 & node stremio_addon.js
