FROM apify/actor-node-playwright-chrome:20

# Copy package files
COPY --chown=myuser package*.json ./

# Install production dependencies only
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

# Copy source
COPY --chown=myuser . ./

# Run actor
CMD ["npm", "start", "--silent"]
