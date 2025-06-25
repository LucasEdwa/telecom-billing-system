# Build and run your Docker container for the app

# 1. Build the Docker image (from your project root)
docker build -t telecom-billing-system .

# 2. Run the container (mapping port 3000)
docker run -p 3000:3000 --env-file .env telecom-billing-system

# Or, if using docker-compose (recommended for multi-service projects):
docker-compose up --build

# To stop and remove containers:
docker-compose down

# Troubleshooting: ECONNREFUSED 127.0.0.1:8889 in Docker

- This error means your app container is trying to connect to MySQL at `127.0.0.1:8889`, but in Docker Compose, it should connect to `db:3306`.
- **Solution:**
  1. In your `.env` file (and Docker Compose `environment:`), set:
     ```
     DB_HOST=db
     DB_PORT=3306
     ```
  2. In your code, make sure you use `process.env.DB_HOST` and `process.env.DB_PORT`.
  3. Remove any hardcoded `127.0.0.1` or `8889` from your database connection config.
  4. Rebuild and restart your containers:
     ```bash
     docker-compose down
     docker-compose up --build
     ```

- **Why?**
  - `localhost`/`127.0.0.1` inside the app container refers to itself, not the MySQL container.
  - Use the service name (`db`) as the host to connect containers in the same Docker network.
