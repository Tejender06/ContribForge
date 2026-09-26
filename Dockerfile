FROM node:20-bookworm-slim

# Install Python 3, Git, and build tools for multi-language execution
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Symlink py alias to python3 for Python test execution
RUN ln -s /usr/bin/python3 /usr/local/bin/py || true

WORKDIR /app

# Copy package definitions
COPY package*.json ./
COPY contribforge-mcp/package*.json ./contribforge-mcp/
COPY orchestrator/package*.json ./orchestrator/
COPY demo-target-repo/package*.json ./demo-target-repo/

# Install all workspace dependencies
RUN npm install
RUN cd contribforge-mcp && npm install
RUN cd orchestrator && npm install
RUN cd demo-target-repo && npm install

# Copy project files
COPY . .

# Expose port
ENV PORT=4000
ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "orchestrator/server.mjs"]
