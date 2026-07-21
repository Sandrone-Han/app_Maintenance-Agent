docker load -i maintenance-scheduler-images.tar
docker compose --env-file .env.production up -d oracle
docker compose --env-file .env.production run --rm backend npm run db:setup
docker compose --env-file .env.production up -d

Write-Host ""
Write-Host "Started. Open http://localhost:8080"
